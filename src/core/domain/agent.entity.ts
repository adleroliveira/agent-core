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

// Tool execution constants
const MAX_RECURSION_DEPTH_ON_ERRORS = 3;
const DEFAULT_TOOL_EXECUTION_TEMPERATURE = 0.7;

// Error messages
const TOOL_NOT_FOUND_ERROR = "Error: Tool '%s' not found";
const TOOL_EXECUTION_ERROR = "Error executing tool: %s";
const MAX_RECURSION_ERROR = "I've encountered multiple errors while trying to execute tools. Please try a different approach or check if the tools are working correctly.";
const TOOL_RESULTS_PROCESSING_ERROR = "I encountered an error processing the tool results: %s";

export class Agent {
  public readonly id: string;
  public name: string;
  public description: string;
  public modelId: string;
  public state: AgentState;
  public systemPrompt: Prompt;
  public tools: Tool[];
  public knowledgeBase: KnowledgeBase;
  public createdAt: Date;
  public updatedAt: Date;
  private modelService?: ModelServicePort;
  private vectorDB?: VectorDBPort;
  private _workspaceConfig: WorkspaceConfig;

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
      conversationId?: string;
    }
  ) {
    this.id = params.id || uuidv4();
    this.name = params.name;
    this.description = params.description;
    this.modelId = params.modelId;
    this.systemPrompt = params.systemPrompt;
    this.tools = params.tools || [];
    this.modelService = params.modelService;
    this.vectorDB = params.vectorDB;
    this._workspaceConfig = params.workspaceConfig;
    this.state = new AgentState({ 
      agentId: this.id,
      conversationId: params.conversationId,
    });

    this.knowledgeBase = params.knowledgeBase || new KnowledgeBase({
      agentId: this.id,
      name: `${this.name}'s Knowledge Base`,
      description: `Knowledge base for agent ${this.name}`,
      modelService: this.modelService,
      vectorDB: this.vectorDB,
    });
    this.createdAt = new Date();
    this.updatedAt = new Date();
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

    // Initialize or update state if needed
    if (!this.state || this.state.conversationId !== message.conversationId) {
      this.state = new AgentState({
        agentId: this.id,
        conversationId: message.conversationId,
      });
    }

    // Record the incoming message in conversation history
    this.state.addToConversation(message);

    const requestOptions = {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    };

    if (options?.stream) {
      // Handle streaming response
      return this.processStreamingMessage(message, requestOptions);
    } else {
      // Handle standard response
      return this.processStandardMessage(message, requestOptions);
    }
  }

  private async processStandardMessage(
    message: Message,
    options: any
  ): Promise<Message> {
    const response = await this.modelService!.generateResponse(
      this.state.conversationHistory,
      this.systemPrompt,
      this.tools,
      options
    );

    // Create a message from the response
    const responseMessage = new Message({
      role: "assistant",
      content: response.message.content,
      conversationId: message.conversationId,
      toolCalls: response.toolCalls?.map((tc) => ({
        id: tc.toolId,
        name: tc.toolName,
        arguments: tc.arguments,
      })),
    });

    // Add the initial response to conversation history
    this.state.addToConversation(responseMessage);

    // Handle any tool calls and get the final response
    if (response.toolCalls && response.toolCalls.length > 0) {
      return this.executeToolCalls(
        responseMessage,
        response.toolCalls,
        message.conversationId
      );
    }

    return responseMessage;
  }

  private processStreamingMessage(
    message: Message,
    options: any,
    responseSubject?: Subject<Partial<Message>>
  ): Observable<Partial<Message>> {

    // If no subject provided, we're at the root level
    const subject = responseSubject || new Subject<Partial<Message>>();
    const collectedToolCalls: ToolCallResult[] = [];
    let streamingContent = "";

    const streamingObs = this.modelService!.generateStreamingResponse(
      this.state.conversationHistory,
      this.systemPrompt,
      this.tools,
      options
    );

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

          subject.next(messageChunk);
        },
        complete: async () => {
          const streamingMessage = new Message({
            role: "assistant",
            content: streamingContent,
            conversationId: message.conversationId,
            toolCalls: collectedToolCalls.map((tc) => ({
              id: tc.toolId,
              name: tc.toolName,
              arguments: tc.arguments,
            })),
          });

          this.state.addToConversation(streamingMessage);

          if (collectedToolCalls.length > 0) {
            try {
              await this.executeToolCallsForStreaming(
                streamingMessage,
                collectedToolCalls,
                message.conversationId,
                subject
              );
            } catch (error) {
              console.error("Error in tool calls execution:", error);
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
          console.error("Streaming error:", error);
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
        console.error("Error in recursive streaming:", error);
      });
    } else {
      // For root level, ensure we wait for all streaming to complete
      streamingPromise.then(() => {}).catch(error => {
        console.error("Error in root streaming:", error);
      });
    }

    return subject.asObservable();
  }

  private async executeToolCallsForStreaming(
    assistantMessage: Message,
    toolCalls: ToolCallResult[],
    conversationId: string,
    responseSubject: Subject<Partial<Message>>,
    recursionDepth: number = 0
  ): Promise<void> {
    const toolResults = [];
    let hasErrors = false;

    for (const toolCall of toolCalls) {
      const tool = this.tools.find((t) => t.name === toolCall.toolName);

      if (!tool) {
        toolResults.push({
          toolId: toolCall.toolId,
          result: TOOL_NOT_FOUND_ERROR.replace("%s", toolCall.toolName),
          isError: true
        });
        hasErrors = true;
        continue;
      }

      try {
        const result = await tool.execute(toolCall.arguments, this);
        toolResults.push({
          toolId: toolCall.toolId,
          result: result,
          isError: false
        });
      } catch (error) {
        console.error("Tool execution error:", error);
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
      conversationId: conversationId,
      toolCallId: toolCalls[0].toolId, // Use the first tool call ID as reference
      toolName: toolCalls[0].toolName, // Use the first tool name as reference
      isToolError: hasErrors
    });

    this.state.addToConversation(toolResponseMessage);

    if (hasErrors && recursionDepth >= MAX_RECURSION_DEPTH_ON_ERRORS) {
      responseSubject.next({
        content: MAX_RECURSION_ERROR,
      });
      return;
    }

    // Recursively process the next streaming response with the same subject
    const recursiveStream = this.processStreamingMessage(
      assistantMessage,
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
          console.error("Recursive stream error:", error);
          subscription.unsubscribe();
          reject(error);
        }
      });
    });
  }

  get workspaceConfig(): WorkspaceConfig {
    return this._workspaceConfig;
  }

  private async executeToolCalls(
    assistantMessage: Message,
    toolCalls: ToolCallResult[],
    conversationId: string,
    recursionDepth: number = 0
  ): Promise<Message> {
    const toolResults = [];
    let hasErrors = false;

    for (const toolCall of toolCalls) {
      const tool = this.tools.find((t) => t.name === toolCall.toolName);

      if (!tool) {
        toolResults.push({
          toolId: toolCall.toolId,
          result: TOOL_NOT_FOUND_ERROR.replace("%s", toolCall.toolName),
          isError: true
        });
        hasErrors = true;
        continue;
      }

      try {
        const result = await tool.execute(toolCall.arguments, this);
        toolResults.push({
          toolId: toolCall.toolId,
          result: result,
          isError: false
        });
      } catch (error) {
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
      conversationId: conversationId,
      toolCallId: toolCalls[0].toolId,
      toolName: toolCalls[0].toolName,
      isToolError: hasErrors
    });

    this.state.addToConversation(toolResponseMessage);

    if (toolResults.length > 0) {
      try {
        const followUpResponse = await this.modelService!.generateResponse(
          this.state.conversationHistory,
          this.systemPrompt,
          this.tools,
          { temperature: DEFAULT_TOOL_EXECUTION_TEMPERATURE }
        );

        const followUpMessage = new Message({
          role: "assistant",
          content: followUpResponse.message.content,
          conversationId,
          toolCalls: followUpResponse.toolCalls?.map((tc) => ({
            id: tc.toolId,
            name: tc.toolName,
            arguments: tc.arguments,
          })),
        });

        this.state.addToConversation(followUpMessage);

        if (followUpResponse.toolCalls && followUpResponse.toolCalls.length > 0) {
          const nextRecursionDepth = hasErrors ? recursionDepth + 1 : recursionDepth;
          
          if (hasErrors && nextRecursionDepth >= MAX_RECURSION_DEPTH_ON_ERRORS) {
            return new Message({
              role: "assistant",
              content: MAX_RECURSION_ERROR,
              conversationId,
            });
          }

          return this.executeToolCalls(
            followUpMessage,
            followUpResponse.toolCalls,
            conversationId,
            nextRecursionDepth
          );
        }

        return followUpMessage;
      } catch (error) {
        const errorMessage = new Message({
          role: "assistant",
          content: TOOL_RESULTS_PROCESSING_ERROR.replace("%s", error.message),
          conversationId,
        });
        this.state.addToConversation(errorMessage);
        return errorMessage;
      }
    }

    return assistantMessage;
  }

  public registerTool(tool: Tool): void {
    this.tools.push(tool);
    this.updatedAt = new Date();
  }

  public deregisterTool(toolId: string): void {
    this.tools = this.tools.filter((tool) => tool.id !== toolId);
    this.updatedAt = new Date();
  }

  public updateSystemPrompt(prompt: Prompt): void {
    this.systemPrompt = prompt;
    this.updatedAt = new Date();
  }

  public resetState(): void {
    this.state = new AgentState({
      agentId: this.id,
      conversationId: uuidv4(),
    });
    this.updatedAt = new Date();
  }

  public getConversationId(): string {
    return this.state.conversationId;
  }
}
