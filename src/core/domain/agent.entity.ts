import { v4 as uuidv4 } from "uuid";
import { AgentState } from "./agent-state.entity";
import { Prompt } from "./prompt.entity";
import { Tool } from "./tool.entity";
import { Message } from "./message.entity";
import { KnowledgeBase } from "./knowledge-base.entity";
import {
  ModelServicePort,
  ToolCallResult,
} from "@ports/model/model-service.port";
import { Observable, Subject } from "rxjs";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { Logger } from "@nestjs/common";

// Tool execution constants
const MAX_RECURSION_DEPTH_ON_ERRORS = 3;
const DEFAULT_TOOL_EXECUTION_TEMPERATURE = 0.7;

// Error messages
const TOOL_NOT_FOUND_ERROR = "Error: Tool '%s' not found";
const TOOL_EXECUTION_ERROR = "Error executing tool: %s";
const MAX_RECURSION_ERROR = "I've encountered multiple errors while trying to execute tools. Please try a different approach or check if the tools are working correctly.";
const TOOL_RESULTS_PROCESSING_ERROR = "I encountered an error processing the tool results: %s";

export class Agent {
  private readonly logger = new Logger(Agent.name);
  public readonly id: string;
  public name: string;
  public description: string;
  public modelId: string;
  private _states: AgentState[];
  public systemPrompt: Prompt;
  private _tools: Tool[];
  private _knowledgeBase: KnowledgeBase;
  public createdAt: Date;
  public updatedAt: Date;
  private modelService?: ModelServicePort;
  private vectorDB?: VectorDBPort;
  private _workspaceConfig: WorkspaceConfig;
  private _toolsLoaded: boolean = false;
  private _knowledgeBaseLoaded: boolean = false;

  constructor(
    params: {
      id?: string;
      name: string;
      description: string;
      modelId: string;
      systemPrompt: Prompt;
      tools?: Tool[];
      modelService?: ModelServicePort;
      vectorDB?: VectorDBPort;
      knowledgeBase?: KnowledgeBase;
      workspaceConfig: WorkspaceConfig;
      states?: AgentState[];
    }
  ) {
    this.id = params.id || uuidv4();
    this.name = params.name;
    this.description = params.description;
    this.modelId = params.modelId;
    this.systemPrompt = params.systemPrompt;
    this._tools = params.tools || [];
    this._toolsLoaded = params.tools !== undefined;
    this.modelService = params.modelService;
    this.vectorDB = params.vectorDB;
    this._workspaceConfig = params.workspaceConfig;

    // Initialize states
    this._states = params.states || [];
    
    // If no states provided, create a default one
    if (this._states.length === 0) {
      const defaultState = new AgentState({ 
        agentId: this.id,
      });
      this._states = [defaultState];
    }

    this._knowledgeBase = params.knowledgeBase || new KnowledgeBase({
      agentId: this.id,
      name: `${this.name}'s Knowledge Base`,
      description: `Knowledge base for agent ${this.name}`,
      modelService: this.modelService,
      vectorDB: this.vectorDB,
    });
    this._knowledgeBaseLoaded = params.knowledgeBase !== undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    this.logger.debug(`Agent initialized: ${this.name} (${this.id}) with ${this._tools.length} tools. Model: ${this.modelId}, Description: ${this.description}`);
  }

  public get states(): AgentState[] {
    return this._states;
  }

  public get workspaceConfig(): WorkspaceConfig {
    return this._workspaceConfig;
  }

  public getStateById(stateId: string): AgentState | undefined {
    return this._states.find(state => state.id === stateId);
  }

  public async processMessage(
    message: Message,
    options?: {
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<Message | Observable<Partial<Message>>> {
    if (!this.modelService) {
      throw new Error("Model service not initialized");
    }

    // Get the StateId from the message
    const stateId = message.stateId;
    if (!stateId) {
      throw new Error("Message must have a stateId");
    }

    // Find the state
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No state found with ID: ${stateId}`);
    }

    // Record the incoming message in conversation history
    state.addToConversation(message);

    console.log("History:", state.conversationHistory);

    const requestOptions = {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    };

    if (options?.stream) {
      return this.processStreamingMessage(message, state, requestOptions);
    } else {
      return this.processStandardMessage(message, state, requestOptions);
    }
  }

  private async processStandardMessage(
    message: Message,
    state: AgentState,
    options: any
  ): Promise<Message> {
    this.logger.debug(`Generating standard response for agent ${this.id}. Conversation history length: ${state.conversationHistory.length}, Available tools: ${this.tools.map(t => t.name).join(', ')}`);
    const response = await this.modelService!.generateResponse(
      state.conversationHistory,
      this.systemPrompt,
      this.tools,
      options
    );

    // Create a message from the response
    const responseMessage = new Message({
      role: "assistant",
      content: response.message.content,
      stateId: message.stateId,
      toolCalls: response.toolCalls?.map((tc) => ({
        id: tc.toolId,
        name: tc.toolName,
        arguments: tc.arguments,
      })),
    });

    this.logger.debug(`Generated response for agent ${this.id}. Content length: ${response.message.content.length}, Tool calls: ${response.toolCalls?.length || 0} (${response.toolCalls?.map(tc => tc.toolName).join(', ') || 'none'})`);

    // Add the initial response to conversation history
    state.addToConversation(responseMessage);

    // Handle any tool calls and get the final response
    if (response.toolCalls && response.toolCalls.length > 0) {
      this.logger.debug(`Executing ${response.toolCalls.length} tool calls for agent ${this.id}. Tools: ${response.toolCalls.map(tc => `${tc.toolName}(${JSON.stringify(tc.arguments)})`).join(', ')}`);
      return this.executeToolCalls(
        responseMessage,
        state,
        response.toolCalls,
        message.stateId
      );
    }

    return responseMessage;
  }

  private processStreamingMessage(
    message: Message,
    state: AgentState,
    options: any,
    responseSubject?: Subject<Partial<Message>>
  ): Observable<Partial<Message>> {
    this.logger.debug(`Starting streaming response for agent ${this.id}. Options: ${JSON.stringify(options)}, Recursive call: ${!!responseSubject}`);
    // If no subject provided, we're at the root level
    const subject = responseSubject || new Subject<Partial<Message>>();
    const collectedToolCalls: ToolCallResult[] = [];
    let streamingContent = "";

    // Ensure we have a valid Observable from the model service
    const streamingObs = this.modelService!.generateStreamingResponse(
      state.conversationHistory,
      this.systemPrompt,
      this.tools,
      options
    );

    if (!streamingObs || typeof streamingObs.subscribe !== 'function') {
      this.logger.error(`Invalid streaming response from model service for agent ${this.id}`);
      subject.error(new Error('Invalid streaming response from model service'));
      return subject.asObservable();
    }

    // Create a promise to track the completion of the streaming process
    const streamingPromise = new Promise<void>((resolve, reject) => {
      streamingObs.subscribe({
        next: (responseChunk) => {
          const messageChunk: Partial<Message> = {};

          if (responseChunk.message?.content) {
            streamingContent += responseChunk.message.content;
            messageChunk.content = responseChunk.message.content;
          }

          if (responseChunk.toolCalls) {
            messageChunk.toolCalls = responseChunk.toolCalls.map((tc) => ({
              id: tc.toolId,
              name: tc.toolName,
              arguments: tc.arguments,
            }));

            responseChunk.toolCalls.forEach((tc) => {
              if (!collectedToolCalls.some((collected) => collected.toolId === tc.toolId)) {
                collectedToolCalls.push(tc);
              }
            });
          }

          if (responseChunk.metadata) {
            messageChunk.metadata = responseChunk.metadata;
          }

          if (messageChunk.content) {
            subject.next(messageChunk);
          }
        },
        complete: async () => {
          const streamingMessage = new Message({
            role: "assistant",
            content: streamingContent,
            stateId: message.stateId,
            toolCalls: collectedToolCalls.map((tc) => ({
              id: tc.toolId,
              name: tc.toolName,
              arguments: tc.arguments,
            })),
          });

          this.logger.debug(`Streaming response completed for agent ${this.id}. Content length: ${streamingContent.length}, Tool calls: ${collectedToolCalls.length} (${collectedToolCalls.map(tc => tc.toolName).join(', ') || 'none'})`);

          state.addToConversation(streamingMessage);

          if (collectedToolCalls.length > 0) {
            try {
              await this.executeToolCallsForStreaming(
                streamingMessage,
                state,
                collectedToolCalls,
                message.stateId,
                subject
              );
            } catch (error) {
              this.logger.error(`Error in tool calls execution for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Tool calls: ${collectedToolCalls.map(tc => tc.toolName).join(', ')}`);
              subject.next({
                content: `Error processing tool calls: ${error.message}`,
                metadata: { error: error.message },
              });
            }
          }

          // Complete the subject regardless of whether it's a root or nested stream
          subject.complete();
          resolve();
        },
        error: (error) => {
          this.logger.error(`Streaming error for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Content so far: "${streamingContent.substring(0, 100)}${streamingContent.length > 100 ? '...' : ''}"`);
          subject.next({
            content: `Error in streaming response: ${error.message}`,
            metadata: { error: error.message },
          });
          if (!responseSubject) {
            subject.complete();
          }
          reject(error);
        },
      });
    });

    // If this is a recursive call, wait for the streaming to complete
    if (responseSubject) {
      streamingPromise.catch(error => {
        this.logger.error(`Error in recursive streaming for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Parent State ID: ${message.stateId}`);
      });
    } else {
      // For root level, ensure we wait for all streaming to complete
      streamingPromise.then(() => {}).catch(error => {
        this.logger.error(`Error in root streaming for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, State ID: ${message.stateId}`);
      });
    }

    return subject.asObservable();
  }

  private async executeToolCallsForStreaming(
    assistantMessage: Message,
    state: AgentState,
    toolCalls: ToolCallResult[],
    stateId: string,
    responseSubject: Subject<Partial<Message>>,
    recursionDepth: number = 0
  ): Promise<void> {
    this.logger.debug(`Executing ${toolCalls.length} tool calls for streaming response for agent ${this.id}. Tools: ${toolCalls.map(tc => `${tc.toolName}(${JSON.stringify(tc.arguments)})`).join(', ')}, Recursion depth: ${recursionDepth}`);
    const toolResults = [];
    let hasErrors = false;

    for (const toolCall of toolCalls) {
      const tool = this.tools.find((t) => t.name === toolCall.toolName);

      if (!tool) {
        this.logger.warn(`Tool not found: ${toolCall.toolName} for agent ${this.id}. Available tools: ${this.tools.map(t => t.name).join(', ')}`);
        toolResults.push({
          toolId: toolCall.toolId,
          result: TOOL_NOT_FOUND_ERROR.replace("%s", toolCall.toolName),
          isError: true
        });
        hasErrors = true;
        continue;
      }

      try {
        this.logger.debug(`Executing tool ${toolCall.toolName} for agent ${this.id}. Arguments: ${JSON.stringify(toolCall.arguments)}`);
        const result = await tool.execute(toolCall.arguments, this);
        toolResults.push({
          toolId: toolCall.toolId,
          result: result,
          isError: false
        });
        this.logger.debug(`Tool ${toolCall.toolName} executed successfully for agent ${this.id}. Result type: ${typeof result}, Result length: ${typeof result === 'string' ? result.length : 'N/A'}`);
      } catch (error) {
        this.logger.error(`Tool execution failed for ${toolCall.toolName} on agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Arguments: ${JSON.stringify(toolCall.arguments)}`);
        toolResults.push({
          toolId: toolCall.toolId,
          result: TOOL_EXECUTION_ERROR.replace("%s", error.message),
          isError: true
        });
        hasErrors = true;
      }
    }

    // Create a single message with all tool results
    const toolResponseMessage = new Message({
      role: "tool",
      content: JSON.stringify(toolResults),
      stateId: stateId,
      toolCallId: toolCalls[0].toolId, // Use the first tool call ID as reference
      toolName: toolCalls[0].toolName, // Use the first tool name as reference
      isToolError: hasErrors
    });

    state.addToConversation(toolResponseMessage);

    if (hasErrors && recursionDepth >= MAX_RECURSION_DEPTH_ON_ERRORS) {
      this.logger.warn(`Max recursion depth reached for agent ${this.id}. Depth: ${recursionDepth}, Errors: ${toolResults.filter(r => r.isError).map(r => r.toolId).join(', ')}`);
      responseSubject.next({
        content: MAX_RECURSION_ERROR,
      });
      return;
    }

    // Recursively process the next streaming response with the same subject
    this.logger.debug(`Processing recursive streaming response for agent ${this.id}. Previous content length: ${assistantMessage.content.length}, Tool results: ${toolResults.length}`);
    const recursiveStream = this.processStreamingMessage(
      assistantMessage,
      state,
      { temperature: DEFAULT_TOOL_EXECUTION_TEMPERATURE },
      responseSubject
    );

    // Subscribe to the recursive stream to ensure it runs
    await new Promise<void>((resolve, reject) => {
      const subscription = recursiveStream.subscribe({
        complete: () => {
          subscription.unsubscribe();
          resolve();
        },
        error: (error) => {
          this.logger.error(`Recursive stream error for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Previous content: "${assistantMessage.content.substring(0, 100)}${assistantMessage.content.length > 100 ? '...' : ''}"`);
          subscription.unsubscribe();
          reject(error);
        }
      });
    });
  }

  private async executeToolCalls(
    assistantMessage: Message,
    state: AgentState,
    toolCalls: ToolCallResult[],
    stateId: string,
    recursionDepth: number = 0
  ): Promise<Message> {
    this.logger.debug(`Executing ${toolCalls.length} tool calls for agent ${this.id}. Tools: ${toolCalls.map(tc => `${tc.toolName}(${JSON.stringify(tc.arguments)})`).join(', ')}, Recursion depth: ${recursionDepth}`);
    const toolResults = [];
    let hasErrors = false;

    for (const toolCall of toolCalls) {
      const tool = this.tools.find((t) => t.name === toolCall.toolName);

      if (!tool) {
        this.logger.warn(`Tool not found: ${toolCall.toolName} for agent ${this.id}. Available tools: ${this.tools.map(t => t.name).join(', ')}`);
        toolResults.push({
          toolId: toolCall.toolId,
          result: TOOL_NOT_FOUND_ERROR.replace("%s", toolCall.toolName),
          isError: true
        });
        hasErrors = true;
        continue;
      }

      try {
        this.logger.debug(`Executing tool ${toolCall.toolName} for agent ${this.id}. Arguments: ${JSON.stringify(toolCall.arguments)}`);
        const result = await tool.execute(toolCall.arguments, this);
        toolResults.push({
          toolId: toolCall.toolId,
          result: result,
          isError: false
        });
        this.logger.debug(`Tool ${toolCall.toolName} executed successfully for agent ${this.id}. Result type: ${typeof result}, Result length: ${typeof result === 'string' ? result.length : 'N/A'}`);
      } catch (error) {
        this.logger.error(`Tool execution failed for ${toolCall.toolName} on agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Arguments: ${JSON.stringify(toolCall.arguments)}`);
        toolResults.push({
          toolId: toolCall.toolId,
          result: TOOL_EXECUTION_ERROR.replace("%s", error.message),
          isError: true
        });
        hasErrors = true;
      }
    }

    const toolResponseMessage = new Message({
      role: "tool",
      content: JSON.stringify(toolResults),
      stateId: stateId,
      toolCallId: toolCalls[0].toolId,
      toolName: toolCalls[0].toolName,
      isToolError: hasErrors
    });

    state.addToConversation(toolResponseMessage);

    if (toolResults.length > 0) {
      try {
        this.logger.debug(`Generating follow-up response for agent ${this.id}. Previous content length: ${assistantMessage.content.length}, Tool results: ${toolResults.length}, Has errors: ${hasErrors}`);
        const followUpResponse = await this.modelService!.generateResponse(
          state.conversationHistory,
          this.systemPrompt,
          this.tools,
          { temperature: DEFAULT_TOOL_EXECUTION_TEMPERATURE }
        );

        const followUpMessage = new Message({
          role: "assistant",
          content: followUpResponse.message.content,
          stateId: stateId,
          toolCalls: followUpResponse.toolCalls?.map((tc) => ({
            id: tc.toolId,
            name: tc.toolName,
            arguments: tc.arguments,
          })),
        });

        this.logger.debug(`Generated follow-up response for agent ${this.id}. Content length: ${followUpResponse.message.content.length}, Tool calls: ${followUpResponse.toolCalls?.length || 0} (${followUpResponse.toolCalls?.map(tc => tc.toolName).join(', ') || 'none'})`);

        state.addToConversation(followUpMessage);

        if (followUpResponse.toolCalls && followUpResponse.toolCalls.length > 0) {
          const nextRecursionDepth = hasErrors ? recursionDepth + 1 : recursionDepth;
          
          if (hasErrors && nextRecursionDepth >= MAX_RECURSION_DEPTH_ON_ERRORS) {
            this.logger.warn(`Max recursion depth reached for agent ${this.id}. Depth: ${nextRecursionDepth}, Previous errors: ${toolResults.filter(r => r.isError).map(r => r.toolId).join(', ')}`);
            return new Message({
              role: "assistant",
              content: MAX_RECURSION_ERROR,
              stateId: stateId,
            });
          }

          return this.executeToolCalls(
            followUpMessage,
            state,
            followUpResponse.toolCalls,
            stateId,
            nextRecursionDepth
          );
        }

        return followUpMessage;
      } catch (error) {
        this.logger.error(`Error processing tool results for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Tool results: ${toolResults.length}, Has errors: ${hasErrors}`);
        const errorMessage = new Message({
          role: "assistant",
          content: TOOL_RESULTS_PROCESSING_ERROR.replace("%s", error.message),
          stateId: stateId,
        });
        state.addToConversation(errorMessage);
        return errorMessage;
      }
    }

    return assistantMessage;
  }

  public get tools(): Tool[] {
    return this._tools;
  }

  public set tools(tools: Tool[]) {
    this._tools = tools;
    this._toolsLoaded = true;
  }

  public get knowledgeBase(): KnowledgeBase {
    return this._knowledgeBase;
  }

  public set knowledgeBase(kb: KnowledgeBase) {
    this._knowledgeBase = kb;
    this._knowledgeBaseLoaded = true;
  }

  public areToolsLoaded(): boolean {
    return this._toolsLoaded;
  }

  public isKnowledgeBaseLoaded(): boolean {
    return this._knowledgeBaseLoaded;
  }

  public areServicesInitialized(): boolean {
    return !!this.modelService && !!this.vectorDB;
  }

  public async setServices(
    modelService: ModelServicePort,
    vectorDB: VectorDBPort,
    workspaceConfig: WorkspaceConfig
  ): Promise<void> {
    this.modelService = modelService;
    this.vectorDB = vectorDB;
    this._workspaceConfig = workspaceConfig;
    this.knowledgeBase.setServices(modelService, vectorDB);
  }

  public registerTool(tool: Tool): void {
    this.logger.debug(`Registering tool ${tool.name} for agent ${this.id}. Tool ID: ${tool.id}, Parameters: ${JSON.stringify(tool.parameters)}`);
    this.tools.push(tool);
    this._toolsLoaded = true;
    this.updatedAt = new Date();
  }

  public deregisterTool(toolId: string): void {
    this.tools = this.tools.filter((t) => t.id !== toolId);
    this._toolsLoaded = true;
    this.updatedAt = new Date();
  }

  public updateSystemPrompt(prompt: Prompt): void {
    this.systemPrompt = prompt;
    this.updatedAt = new Date();
  }

  public resetConversation(_stateId: string): void {
    throw new Error("Not implemented");
  }

  public createNewConversation(): AgentState {
    this.logger.debug(`Creating new conversation for agent ${this.id}`);
    const newState = new AgentState({
      agentId: this.id,
    });
    this._states.push(newState);
    this.updatedAt = new Date();
    return newState;
  }

  public getConversationHistory(stateId: string): Message[] {
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No conversation found with ID: ${stateId}`);
    }
    return state.conversationHistory;
  }

  public getMostRecentState(): AgentState {
    return this._states[this._states.length - 1];
  }
}
