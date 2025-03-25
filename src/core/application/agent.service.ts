import { Injectable, Logger, NotFoundException, Inject } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { Observable, Subject } from "rxjs";

import { Agent } from "@core/domain/agent.entity";
import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { Tool } from "@core/domain/tool.entity";
import { AgentRepositoryPort } from "@ports/storage/agent-repository.port";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import {
  ModelServicePort,
  ToolCallResult,
} from "@ports/model/model-service.port";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import {
  AGENT_REPOSITORY,
  STATE_REPOSITORY,
  MODEL_SERVICE,
} from "@adapters/adapters.module";
import { TOOL_REGISTRY } from "@core/constants";

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: AgentRepositoryPort,
    @Inject(STATE_REPOSITORY)
    private readonly stateRepository: StateRepositoryPort,
    @Inject(MODEL_SERVICE)
    private readonly modelService: ModelServicePort,
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryPort
  ) {}

  async createAgent(params: {
    name: string;
    description?: string;
    modelId?: string;
    systemPromptContent: string;
    tools?: string[];
  }): Promise<Agent> {
    const { name, description, modelId, systemPromptContent, tools } = params;

    const systemPrompt = new Prompt({
      content: systemPromptContent,
      type: "system",
      name: `${name} System Prompt`,
    });

    const agent = new Agent({
      name,
      description,
      modelId: modelId || process.env.BEDROCK_MODEL_ID || "",
      systemPrompt,
    });

    // Register default tools if available
    if (tools && tools.length > 0) {
      const allTools = await this.toolRegistry.getAllTools();
      const toolMap = new Map(allTools.map((tool) => [tool.name, tool]));

      for (const toolName of tools) {
        const tool = toolMap.get(toolName);
        if (tool) {
          agent.registerTool(tool);
        } else {
          this.logger.warn(`Tool '${toolName}' not found in registry`);
        }
      }
    }

    return this.agentRepository.save(agent);
  }

  async findAgentById(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  async findAllAgents(): Promise<Agent[]> {
    return this.agentRepository.findAll();
  }

  async deleteAgent(id: string): Promise<boolean> {
    const exists = await this.agentRepository.exists(id);
    if (!exists) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    await this.stateRepository.deleteByAgentId(id);
    return this.agentRepository.delete(id);
  }

  async processMessage(
    agentId: string,
    messageContent: string,
    conversationId?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<Message | Observable<Partial<Message>>> {
    const agent = await this.findAgentById(agentId);

    // Create conversation ID if not provided
    if (!conversationId) {
      conversationId = uuidv4();
    } else {
      // If a conversation ID is provided, try to load that specific conversation state
      const existingState = await this.stateRepository.findByConversationId(
        conversationId
      );
      if (existingState) {
        agent.state = existingState;
        agent.state.conversationId = conversationId; // Ensure the ID is set
      } else {
        // If no state exists for this conversation yet, set the ID on the new state
        agent.state.conversationId = conversationId;
      }
    }

    // Create user message
    const userMessage = new Message({
      role: "user",
      content: messageContent,
      conversationId,
    });

    // Add message to agent's state
    agent.state.addToConversation(userMessage);

    // Get conversation history
    const conversationHistory = agent.state.getLastNInteractions(
      parseInt(process.env.AGENT_MEMORY_SIZE || "10")
    );

    // Gather available tools for this agent
    const tools = agent.tools;

    try {
      // Handle streaming if requested
      if (options?.stream) {
        return this.processStreamingMessage(
          agent,
          conversationHistory,
          conversationId,
          tools,
          options
        );
      }

      // Non-streaming flow
      return this.processStandardMessage(
        agent,
        conversationHistory,
        conversationId,
        tools,
        options
      );
    } catch (error) {
      this.logger.error(
        `Error processing message: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to process message: ${error.message}`);
    }
  }

  private async processStandardMessage(
    agent: Agent,
    conversationHistory: Message[],
    conversationId: string,
    tools: Tool[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<Message> {
    if (
      conversationHistory.length > 0 &&
      conversationHistory[0].role !== "user"
    ) {
      throw new Error("Conversation must start with a user message");
    }

    // Call the model service to generate a response
    const modelResponse = await this.modelService.generateResponse(
      conversationHistory,
      agent.systemPrompt,
      tools,
      options
    );

    // Create assistant message from model response
    let responseMessage = new Message({
      role: "assistant",
      content: modelResponse.message.content,
      conversationId,
      toolCalls: modelResponse.toolCalls?.map((tc) => ({
        id: tc.toolId,
        name: tc.toolName,
        arguments: tc.arguments,
      })),
    });

    // Add initial response to conversation
    agent.state.addToConversation(responseMessage);

    // Handle tool calls if present
    if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
      // Execute tools and get the final response
      const finalResponse = await this.executeToolCalls(
        agent,
        responseMessage,
        modelResponse.toolCalls,
        conversationId,
        conversationHistory,
        options
      );

      // For synchronous execution, return the final response after tool use
      // instead of the intermediate response
      if (finalResponse) {
        responseMessage = finalResponse;
      }
    }

    // Save updated state
    await this.stateRepository.save(agent.state, agent.id);

    return responseMessage;
  }

  private processStreamingMessage(
    agent: Agent,
    conversationHistory: Message[],
    conversationId: string,
    tools: Tool[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Observable<Partial<Message>> {
    // Create a placeholder streaming message
    const streamingMessage = new Message({
      role: "assistant",
      content: "",
      conversationId,
      isStreaming: true,
    });

    // Add the placeholder to conversation history
    agent.state.addToConversation(streamingMessage);

    // Track collected tool calls for later execution
    const collectedToolCalls: ToolCallResult[] = [];

    // Create a subject to handle the streaming
    const responseSubject = new Subject<Partial<Message>>();

    if (
      conversationHistory.length > 0 &&
      conversationHistory[0].role !== "user"
    ) {
      throw new Error("Conversation must start with a user message");
    }

    // Get the streaming response
    const streamingObs = this.modelService.generateStreamingResponse(
      conversationHistory,
      agent.systemPrompt,
      tools,
      options
    );

    // Set up a subscription to update the placeholder message
    streamingObs.subscribe({
      next: (responseChunk) => {
        // Update content if present
        if (responseChunk.message?.content) {
          const content =
            typeof responseChunk.message.content === "string"
              ? responseChunk.message.content
              : responseChunk.message.content.toString();

          streamingMessage.appendContent(content);

          // Pass along the content chunk to our client
          responseSubject.next({ content });
        }

        // Update tool calls if present and collect them
        if (responseChunk.toolCalls) {
          streamingMessage.toolCalls = responseChunk.toolCalls.map((tc) => ({
            id: tc.toolId,
            name: tc.toolName,
            arguments: tc.arguments,
          }));

          // Pass along the tool calls to our client
          responseSubject.next({
            toolCalls: streamingMessage.toolCalls,
          });

          // Collect tool calls for later execution
          responseChunk.toolCalls.forEach((tc) => {
            if (
              !collectedToolCalls.some(
                (collected) => collected.toolId === tc.toolId
              )
            ) {
              collectedToolCalls.push(tc);
            }
          });
        }

        // Pass along any usage information
        if (responseChunk.usage) {
          responseSubject.next({
            metadata: { usage: responseChunk.usage },
          });
        }
      },
      complete: async () => {
        // Mark streaming as complete
        streamingMessage.isStreaming = false;

        // Execute any collected tool calls after streaming completes
        if (collectedToolCalls.length > 0) {
          try {
            this.logger.debug(
              `Executing ${collectedToolCalls.length} tool calls from streaming response`
            );

            // We'll use our existing executeToolCalls method to handle the tool calls
            const toolExecutionResult = await this.executeToolCallsForStreaming(
              agent,
              streamingMessage,
              collectedToolCalls,
              conversationId,
              [...conversationHistory, streamingMessage],
              responseSubject,
              options
            );

            // Save the final state after all tool executions
            await this.stateRepository.save(agent.state, agent.id);

            // Complete the stream after all tool executions are done
            responseSubject.complete();
          } catch (error) {
            this.logger.error(
              `Error executing tool calls from streaming response: ${error.message}`,
              error.stack
            );

            // Report the error to the client
            responseSubject.next({
              content: `\nError executing tools: ${error.message}`,
            });
            responseSubject.complete();
          }
        } else {
          // No tool calls, so just save the state and complete
          await this.stateRepository.save(agent.state, agent.id);
          responseSubject.complete();
        }
      },
      error: (error) => {
        this.logger.error(
          `Error in streaming response: ${error.message}`,
          error.stack
        );
        streamingMessage.isStreaming = false;
        streamingMessage.metadata = {
          ...streamingMessage.metadata,
          error: error.message,
        };

        // Report the error to the client
        responseSubject.next({
          content: `\nError in streaming response: ${error.message}`,
          metadata: { error: error.message },
        });
        responseSubject.complete();
      },
    });

    // Return our subject as an observable
    return responseSubject.asObservable();
  }

  private async executeToolCallsForStreaming(
    agent: Agent,
    responseMessage: Message,
    toolCalls: ToolCallResult[],
    conversationId: string,
    previousMessages: Message[],
    responseSubject: Subject<Partial<Message>>,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void> {
    const toolResponses: Message[] = [];

    // Execute all tool calls in parallel for better performance
    const toolCallPromises = toolCalls.map(async (toolCall) => {
      try {
        this.logger.debug(
          `Executing tool: ${toolCall.toolName} with args: ${JSON.stringify(
            toolCall.arguments
          )}`
        );

        let toolArgs = toolCall.arguments;
        if (typeof toolArgs === "string") {
          try {
            toolArgs = JSON.parse(toolArgs);
          } catch (e) {
            this.logger.warn(
              `Could not parse tool arguments as JSON: ${toolArgs}`
            );
          }
        }

        responseSubject.next({
          content: `\nExecuting ${toolCall.toolName}...`,
        });

        const toolResult = await this.toolRegistry.executeToolByName(
          toolCall.toolName,
          toolArgs
        );

        const formattedResult =
          typeof toolResult === "string"
            ? toolResult
            : JSON.stringify(toolResult);

        const truncatedResult =
          formattedResult.length > 100
            ? formattedResult.substring(0, 100) + "..."
            : formattedResult;

        responseSubject.next({
          content: `\nTool ${toolCall.toolName} result: ${truncatedResult}`,
        });

        return {
          success: true,
          toolCall,
          result: formattedResult,
        };
      } catch (error) {
        const errorMessage = `Error executing tool ${toolCall.toolName}: ${error.message}`;
        this.logger.error(errorMessage);

        responseSubject.next({
          content: `\n${errorMessage}`,
        });

        return {
          success: false,
          toolCall,
          result: errorMessage,
        };
      }
    });

    // Wait for all tool executions to complete
    const results = await Promise.all(toolCallPromises);

    // Process all tool results and add to conversation history
    for (const result of results) {
      const toolResponseMessage = new Message({
        role: "tool",
        content: result.result,
        conversationId,
        toolCallId: result.toolCall.toolId,
        toolName: result.toolCall.toolName,
        isToolError: !result.success,
      });

      agent.state.addToConversation(toolResponseMessage);
      toolResponses.push(toolResponseMessage);
    }

    if (toolResponses.length > 0) {
      try {
        this.logger.debug("Generating final response after tool execution");
        responseSubject.next({
          content: "\nProcessing results...",
        });

        // Use the full conversation history
        const fullConversationHistory = agent.state.conversationHistory;

        const finalResponseData = await this.modelService.generateResponse(
          fullConversationHistory,
          agent.systemPrompt,
          agent.tools,
          options
        );

        const finalResponse = new Message({
          role: "assistant",
          content: finalResponseData.message.content,
          conversationId,
          metadata: {
            isToolResponseSummary: true,
            ...finalResponseData.metadata,
          },
          toolCalls: finalResponseData.toolCalls?.map((tc) => ({
            id: tc.toolId,
            name: tc.toolName,
            arguments: tc.arguments,
          })),
        });

        agent.state.addToConversation(finalResponse);

        responseSubject.next({
          content: `\n\n${finalResponseData.message.content}`,
        });

        if (
          finalResponseData.toolCalls &&
          finalResponseData.toolCalls.length > 0
        ) {
          this.logger.debug(
            `Final response contains ${finalResponseData.toolCalls.length} more tool calls, processing recursively`
          );

          // Recursive call with updated full history via agent.state.conversation
          const updatedPreviousMessages = [
            ...previousMessages,
            responseMessage,
            ...toolResponses,
            finalResponse,
          ];

          await this.executeToolCallsForStreaming(
            agent,
            finalResponse,
            finalResponseData.toolCalls,
            conversationId,
            updatedPreviousMessages,
            responseSubject,
            options
          );
        }
      } catch (error) {
        this.logger.error(
          `Error generating final response after tool execution: ${error.message}`,
          error.stack
        );

        const errorFinalResponse = new Message({
          role: "assistant",
          content: `I encountered an error processing the tool results: ${error.message}`,
          conversationId,
          metadata: {
            isToolResponseSummary: true,
            error: error.message,
          },
          isToolError: true,
        });

        agent.state.addToConversation(errorFinalResponse);

        responseSubject.next({
          content: `\n\nError: ${error.message}`,
          metadata: { error: error.message },
        });
      }
    }
  }

  private async executeToolCalls(
    agent: Agent,
    responseMessage: Message,
    toolCalls: ToolCallResult[],
    conversationId: string,
    previousMessages: Message[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<Message | null> {
    const toolResponses: Message[] = [];

    this.logger.debug(`Executing ${toolCalls.length} tool calls`);

    const toolCallPromises = toolCalls.map(async (toolCall) => {
      try {
        this.logger.debug(
          `Executing tool: ${toolCall.toolName} with args: ${JSON.stringify(
            toolCall.arguments
          )}`
        );

        let toolArgs = toolCall.arguments;
        if (typeof toolArgs === "string") {
          try {
            toolArgs = JSON.parse(toolArgs);
          } catch (e) {
            this.logger.warn(
              `Could not parse tool arguments as JSON: ${toolArgs}`
            );
          }
        }

        const toolResult = await this.toolRegistry.executeToolByName(
          toolCall.toolName,
          toolArgs
        );

        const formattedResult =
          typeof toolResult === "string"
            ? toolResult
            : JSON.stringify(toolResult);

        this.logger.debug(
          `Tool ${toolCall.toolName} result: ${formattedResult.substring(
            0,
            100
          )}...`
        );

        return {
          success: true,
          toolCall,
          result: formattedResult,
        };
      } catch (error) {
        const errorMessage = `Error executing tool ${toolCall.toolName}: ${error.message}`;
        this.logger.error(errorMessage);

        return {
          success: false,
          toolCall,
          result: errorMessage,
        };
      }
    });

    // Wait for all tool executions to complete
    const results = await Promise.all(toolCallPromises);

    // Create and add all tool response messages to the conversation history
    for (const result of results) {
      const toolResponseMessage = new Message({
        role: "tool",
        content: result.result,
        conversationId,
        toolCallId: result.toolCall.toolId,
        toolName: result.toolCall.toolName,
        isToolError: !result.success,
      });

      agent.state.addToConversation(toolResponseMessage);
      toolResponses.push(toolResponseMessage);
    }

    if (toolResponses.length > 0) {
      try {
        this.logger.debug("Generating final response after tool execution");

        // Use the full conversation history
        const fullConversationHistory = agent.state.conversationHistory;

        const finalResponseData = await this.modelService.generateResponse(
          fullConversationHistory,
          agent.systemPrompt,
          agent.tools,
          options
        );

        const finalResponse = new Message({
          role: "assistant",
          content: finalResponseData.message.content,
          conversationId,
          metadata: {
            isToolResponseSummary: true,
            ...finalResponseData.metadata,
          },
          toolCalls: finalResponseData.toolCalls?.map((tc) => ({
            id: tc.toolId,
            name: tc.toolName,
            arguments: tc.arguments,
          })),
        });

        agent.state.addToConversation(finalResponse);

        if (
          finalResponseData.toolCalls &&
          finalResponseData.toolCalls.length > 0
        ) {
          this.logger.debug(
            `Final response contains ${finalResponseData.toolCalls.length} more tool calls, processing recursively`
          );

          // Recursive call uses the updated full history via agent.state.conversation
          return this.executeToolCalls(
            agent,
            finalResponse,
            finalResponseData.toolCalls,
            conversationId,
            previousMessages, // Not strictly needed since we use full history
            options
          );
        }

        return finalResponse;
      } catch (error) {
        this.logger.error(
          `Error generating final response after tool execution: ${error.message}`,
          error.stack
        );

        const errorFinalResponse = new Message({
          role: "assistant",
          content: `I encountered an error processing the tool results: ${error.message}`,
          conversationId,
          metadata: {
            isToolResponseSummary: true,
            error: error.message,
          },
          isToolError: true,
        });

        agent.state.addToConversation(errorFinalResponse);
        return errorFinalResponse;
      }
    }

    return null;
  }

  async addToolToAgent(agentId: string, toolName: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId);
    const tool = await this.toolRegistry.getToolByName(toolName);

    if (!tool) {
      throw new NotFoundException(`Tool with name ${toolName} not found`);
    }

    agent.registerTool(tool);
    return this.agentRepository.save(agent);
  }

  async removeToolFromAgent(agentId: string, toolId: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId);
    agent.deregisterTool(toolId);
    return this.agentRepository.save(agent);
  }

  async updateSystemPrompt(
    agentId: string,
    promptContent: string
  ): Promise<Agent> {
    const agent = await this.findAgentById(agentId);

    const updatedPrompt = new Prompt({
      content: promptContent,
      type: "system",
      name: agent.systemPrompt.name,
    });

    agent.updateSystemPrompt(updatedPrompt);
    return this.agentRepository.save(agent);
  }

  async resetAgentState(agentId: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId);
    agent.resetState();
    return this.agentRepository.save(agent);
  }
}
