import { v4 as uuidv4 } from "uuid";
import { AgentState } from "./agent-state.entity";
import { Prompt } from "./prompt.entity";
import { MCPTool } from "./mcp-tool.entity";
import { Message } from "./message.entity";
import { KnowledgeBase } from "./knowledge-base.entity";
import {
  ModelServicePort,
  ToolCallResult,
} from "@ports/model/model-service.port";
import { Observable, Subject } from "rxjs";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { ModelRequestOptions, ModelResponse } from "@ports/model/model-service.port";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { Logger } from "@nestjs/common";
import { McpClientServicePort } from "@ports/mcp/mcp-client-service.port";
import { StateRepositoryPort } from "../../ports/storage/state-repository.port";
// Tool execution constants
const MAX_RECURSION_DEPTH_ON_ERRORS = 3;
const DEFAULT_TOOL_EXECUTION_TEMPERATURE = 0.7;

// Error messages
const TOOL_NOT_FOUND_ERROR = "Error: Tool '%s' not found";
const TOOL_EXECUTION_ERROR = "Error executing tool: %s";
const MAX_RECURSION_ERROR = "I've encountered multiple errors while trying to execute tools. Please try a different approach or check if the tools are working correctly.";

export class Agent {
  private readonly logger = new Logger(Agent.name);
  public readonly id: string;
  public name: string;
  public description: string;
  public modelId: string;
  private _states: AgentState[];
  public systemPrompt: Prompt;
  private _tools: MCPTool[];
  private _knowledgeBase: KnowledgeBase;
  public createdAt: Date;
  public updatedAt: Date;
  private modelService?: ModelServicePort;
  private mcpClientService?: McpClientServicePort;
  private vectorDB?: VectorDBPort;
  private _workspaceConfig: WorkspaceConfig;
  private _toolsLoaded: boolean = false;
  private _knowledgeBaseLoaded: boolean = false;
  public inputTokens: number = 0;
  public outputTokens: number = 0;
  private stateRepository?: StateRepositoryPort;

  constructor(
    params: {
      id?: string;
      name: string;
      description: string;
      modelId: string;
      systemPrompt: Prompt;
      tools?: MCPTool[];
      mcpClientService?: McpClientServicePort;
      vectorDB?: VectorDBPort;
      knowledgeBase?: KnowledgeBase;
      workspaceConfig: WorkspaceConfig;
      states?: AgentState[];
      inputTokens?: number;
      outputTokens?: number;
    }
  ) {
    this.id = params.id || uuidv4();
    this.name = params.name;
    this.description = params.description;
    this.modelId = params.modelId;
    this.systemPrompt = params.systemPrompt;
    this._tools = params.tools || [];
    this._toolsLoaded = params.tools !== undefined;
    this.mcpClientService = params.mcpClientService;
    this.vectorDB = params.vectorDB;
    this._workspaceConfig = params.workspaceConfig;
    this.inputTokens = params.inputTokens || 0;
    this.outputTokens = params.outputTokens || 0;

    // Initialize states
    this._states = params.states || [];

    // If no states provided, create a default one
    if (this._states.length === 0) {
      const defaultState = new AgentState({
        agentId: this.id,
      });
      this._states = [defaultState];
      this.logger.debug(`No states provided for agent ${this.id}, creating a default one: ${defaultState.id}`);
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

    // this.logger.debug(`Agent initialized: ${this.name} (${this.id}) with ${this._tools.length} tools. Model: ${this.modelId}, Description: ${this.description}`);
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
    options?: ModelRequestOptions,
    isStreaming?: boolean
  ): Promise<Observable<Partial<Message>>> {
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
    await state.addToConversation(message);

    const requestOptions = {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    };

    return this.processMessageStream(message, state, requestOptions, isStreaming);
  }

  private processMessageStream(
    message: Message,
    state: AgentState,
    options: ModelRequestOptions,
    isStreaming?: boolean,
    recursiveSubject?: Subject<Partial<Message>>
  ): Observable<Partial<Message>> {
    this.logger.debug(`Processing message for agent ${this.id}. Options: ${JSON.stringify(options)}, Streaming: ${isStreaming}`);
    const subject = recursiveSubject || new Subject<Partial<Message>>();
    const collectedToolCalls: ToolCallResult[] = [];
    let streamingContent = "";

    const systemPrompt = [this.systemPrompt];

    const processResponse = async (response: Partial<ModelResponse>) => {
      const messageChunk: Partial<Message> = {
        role: "assistant",
        stateId: message.stateId,
      };

      if (response.message?.content) {
        streamingContent += response.message.content;
        messageChunk.content = response.message.content;
      }

      if (response.toolCalls) {
        messageChunk.toolCalls = response.toolCalls.map((tc: ToolCallResult) => ({
          id: tc.toolId,
          name: tc.toolName,
          arguments: tc.arguments,
        }));

        response.toolCalls.forEach((tc: ToolCallResult) => {
          if (!collectedToolCalls.some((collected) => collected.toolId === tc.toolId)) {
            collectedToolCalls.push(tc);
            if (isStreaming) {
              subject.next({
                role: "assistant",
                stateId: message.stateId,
                toolCalls: [{
                  id: tc.toolId,
                  name: tc.toolName,
                  arguments: tc.arguments,
                }],
                metadata: {
                  type: "tool_call",
                  timestamp: new Date().toISOString(),
                }
              });
            }
          }
        });
      }

      if (response.usage) {
        this.inputTokens += response.usage.promptTokens;
        this.outputTokens += response.usage.completionTokens;
        messageChunk.metadata = {
          ...messageChunk.metadata,
          usage: response.usage,
        };
      }

      if (messageChunk.content) {
        subject.next(messageChunk);
      }

      return messageChunk;
    };

    const handleToolCalls = async (assistantMessage: Message) => {
      if (collectedToolCalls.length > 0) {
        try {
          await this.executeToolCallsForStreaming(
            assistantMessage,
            state,
            collectedToolCalls,
            message.stateId,
            subject,
            isStreaming || false
          );
        } catch (error) {
          this.logger.error(`Error in tool calls execution for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Tool calls: ${collectedToolCalls.map(tc => tc.toolName).join(', ')}`);
          subject.next({
            role: "assistant",
            stateId: message.stateId,
            content: `Error processing tool calls: ${error.message}`,
            metadata: {
              type: "error",
              error: error.message,
              timestamp: new Date().toISOString(),
            }
          });
        }
      } else {
        // If there are no tool calls, we can complete the stream
        this.logger.debug(`No tool calls found, completing stream for agent ${this.id}`);
        subject.complete();
      }
    };

    if (isStreaming) {
      const streamingObs = this.modelService!.generateStreamingResponse(
        state.conversationHistory,
        systemPrompt,
        this.tools,
        { ...options, modelId: this.modelId }
      );

      if (!streamingObs || typeof streamingObs.subscribe !== 'function') {
        this.logger.error(`Invalid streaming response from model service for agent ${this.id}`);
        subject.error(new Error('Invalid streaming response from model service'));
        return subject.asObservable();
      }

      streamingObs.subscribe({
        next: async (responseChunk) => {
          await processResponse(responseChunk);
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
            metadata: {
              type: "stream_complete",
              timestamp: new Date().toISOString(),
            }
          });

          this.logger.debug(`Streaming response completed for agent ${this.id}. Content length: ${streamingContent.length}, Tool calls: ${collectedToolCalls.length}`);
          await state.addToConversation(streamingMessage);
          await handleToolCalls(streamingMessage);
        },
        error: (error) => {
          this.logger.error(`Streaming error for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}`);
          subject.next({
            role: "assistant",
            stateId: message.stateId,
            content: `Error in streaming response: ${error.message}`,
            metadata: {
              type: "error",
              error: error.message,
              timestamp: new Date().toISOString(),
            }
          });
          subject.complete();
        },
      });
    } else {
      this.modelService!.generateResponse(
        state.conversationHistory,
        systemPrompt,
        this.tools,
        { ...options, modelId: this.modelId }
      ).then(async (response) => {
        const messageChunk = await processResponse(response);
        const standardMessage = new Message({
          role: "assistant",
          content: messageChunk.content || "",
          stateId: message.stateId,
          toolCalls: messageChunk.toolCalls,
        });

        await state.addToConversation(standardMessage);
        await handleToolCalls(standardMessage);
      }).catch((error) => {
        this.logger.error(`Error generating response for agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}`);
        subject.next({
          role: "assistant",
          stateId: message.stateId,
          content: `Error generating response: ${error.message}`,
          metadata: {
            type: "error",
            error: error.message,
            timestamp: new Date().toISOString(),
          }
        });
        subject.complete();
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
    isStreaming: boolean,
    recursionDepth: number = 0
  ): Promise<void> {
    if (!this.mcpClientService) {
      throw new Error("MCP client service not initialized");
    }
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
        responseSubject.next({
          role: "tool",
          stateId: stateId,
          content: "",
          toolResults: toolResults.map(r => ({
            toolCallId: r.toolId,
            result: r.result,
            isError: r.isError
          })),
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
          metadata: {
            type: "tool_error",
            error: TOOL_NOT_FOUND_ERROR.replace("%s", toolCall.toolName),
            timestamp: new Date().toISOString(),
          }
        });
        continue;
      }

      try {
        this.logger.debug(`Executing tool ${toolCall.toolName} for agent ${this.id}. Arguments: ${JSON.stringify(toolCall.arguments)}`);

        const toolToUse = this.tools.find((t) => t.name === toolCall.toolName);
        if (!toolToUse) {
          throw new Error(`Tool not found: ${toolCall.toolName} for agent ${this.id}. Available tools: ${this.tools.map(t => t.name).join(', ')}`);
        }
        const result = await this.mcpClientService.callTool(toolToUse.serverId, toolToUse.id, toolCall.arguments);
        this.logger.debug(`Tool ${toolCall.toolName} executed successfully using MCP client for agent ${this.id}. Result: ${result}`);

        toolResults.push({
          toolId: toolCall.toolId,
          result: result,
          isError: false
        });
        responseSubject.next({
          role: "tool",
          stateId: stateId,
          content: "",
          toolResults: [{
            toolCallId: toolCall.toolId,
            result: result,
            isError: false
          }],
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
          metadata: {
            type: "tool_result",
            timestamp: new Date().toISOString(),
          }
        });

      } catch (error) {
        this.logger.error(`Tool execution failed for ${toolCall.toolName} on agent ${this.id}. Error: ${error.message}, Stack: ${error.stack}, Arguments: ${JSON.stringify(toolCall.arguments)}`);
        toolResults.push({
          toolId: toolCall.toolId,
          result: TOOL_EXECUTION_ERROR.replace("%s", error.message),
          isError: true
        });
        responseSubject.next({
          role: "tool",
          stateId: stateId,
          content: "",
          toolResults: toolResults.map(r => ({
            toolCallId: r.toolId,
            result: r.result,
            isError: r.isError
          })),
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
          metadata: {
            type: "tool_error",
            error: error.message,
            timestamp: new Date().toISOString(),
          }
        });
        hasErrors = true;
      }
    }

    // Create a single message with all tool results
    const toolResponseMessage = new Message({
      role: "tool",
      content: "",
      toolResults: toolResults.map(r => ({
        toolCallId: r.toolId,
        result: r.result,
        isError: r.isError
      })),
      stateId: stateId,
      toolCallId: toolCalls[0].toolId,
      toolName: toolCalls[0].toolName,
      isToolError: hasErrors,
      metadata: {
        type: "tool_complete",
        timestamp: new Date().toISOString(),
      }
    });

    // Ensure the tool result message has a different timestamp than the assistant's message
    toolResponseMessage.createdAt = new Date(assistantMessage.createdAt.getTime() + 1);
    await state.addToConversation(toolResponseMessage);

    if (hasErrors && recursionDepth >= MAX_RECURSION_DEPTH_ON_ERRORS) {
      this.logger.warn(`Max recursion depth reached for agent ${this.id}. Depth: ${recursionDepth}, Errors: ${toolResults.filter(r => r.isError).map(r => r.toolId).join(', ')}`);
      responseSubject.next({
        role: "assistant",
        stateId: stateId,
        content: MAX_RECURSION_ERROR,
        metadata: {
          type: "error",
          error: "max_recursion_depth_reached",
          timestamp: new Date().toISOString(),
        }
      });
      return;
    }

    // Let processMessageStream handle the follow-up response
    this.processMessageStream(
      toolResponseMessage,
      state,
      { temperature: DEFAULT_TOOL_EXECUTION_TEMPERATURE, modelId: this.modelId },
      isStreaming,
      responseSubject
    );
  }

  public getStateMemory(stateId: string): Record<string, any> {
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No state found with ID: ${stateId}`);
    }
    return state.memory;
  }

  public setStateMemory(stateId: string, memory: Record<string, any>): void {
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No state found with ID: ${stateId}`);
    }
    state.memory = memory;
  }

  public updateStateMemory(stateId: string, memory: Record<string, any>): void {
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No state found with ID: ${stateId}`);
    }
    state.memory = { ...state.memory, ...memory };
  }

  public deleteStateMemory(stateId: string): void {
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No state found with ID: ${stateId}`);
    }
    state.memory = {};
  }

  public deleteMemoryEntry(stateId: string, key: string): void {
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No state found with ID: ${stateId}`);
    }
    delete state.memory[key];
  }

  public get tools(): MCPTool[] {
    return this._tools;
  }

  public set tools(tools: MCPTool[]) {
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

  public updateMemory(stateId: string, memory: Record<string, any>): void {
    const state = this.getStateById(stateId);
    if (!state) {
      throw new Error(`No state found with ID: ${stateId}`);
    }
    state.memory = { ...state.memory, ...memory };
    this.updatedAt = new Date();
  }

  public async setServices(
    modelService: ModelServicePort,
    vectorDB: VectorDBPort,
    workspaceConfig: WorkspaceConfig,
    mcpClientService: McpClientServicePort,
    stateRepository: StateRepositoryPort
  ): Promise<void> {
    this.modelService = modelService;
    this.vectorDB = vectorDB;
    this._workspaceConfig = workspaceConfig;
    this.knowledgeBase.setServices(modelService, vectorDB);
    this.mcpClientService = mcpClientService;
    this.stateRepository = stateRepository;

    // Update all existing states with the repository
    for (const state of this._states) {
      state.setRepository(stateRepository);
    }
  }

  public registerTool(tool: MCPTool): void {
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
    if (this.stateRepository) {
      newState.setRepository(this.stateRepository);
    }
    this._states.push(newState);
    this.updatedAt = new Date();
    return newState;
  }

  public deleteConversation(stateId: string): void {
    this._states = this._states.filter((state) => state.id !== stateId);
    this.updatedAt = new Date();
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
