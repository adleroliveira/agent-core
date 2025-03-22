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
  TOOL_REGISTRY,
} from "@adapters/adapters.module";

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
    const conversationHistory = agent.state.getLastNMessages(
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

    // Execute each tool call
    for (const toolCall of toolCalls) {
      try {
        this.logger.debug(
          `Executing tool: ${toolCall.toolName} with args: ${JSON.stringify(
            toolCall.arguments
          )}`
        );

        // Parse arguments if they're a string
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

        // Inform the client that we're executing a tool
        responseSubject.next({
          content: `\nExecuting ${toolCall.toolName}...`,
        });

        // Execute the tool
        const toolResult = await this.toolRegistry.executeToolByName(
          toolCall.toolName,
          toolArgs
        );

        // Format the tool result for the model
        const formattedResult =
          typeof toolResult === "string"
            ? toolResult
            : JSON.stringify(toolResult);

        // Create tool response message
        const toolResponseMessage = new Message({
          role: "tool",
          content: formattedResult,
          conversationId,
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
        });

        // Add to conversation history
        agent.state.addToConversation(toolResponseMessage);
        toolResponses.push(toolResponseMessage);

        // Inform the client about the tool result (truncated for display)
        const truncatedResult =
          formattedResult.length > 100
            ? formattedResult.substring(0, 100) + "..."
            : formattedResult;

        responseSubject.next({
          content: `\nTool ${toolCall.toolName} result: ${truncatedResult}`,
        });
      } catch (error) {
        // Handle tool execution error
        const errorMessage = `Error executing tool ${toolCall.toolName}: ${error.message}`;
        this.logger.error(errorMessage);

        const errorResponseMessage = new Message({
          role: "tool",
          content: errorMessage,
          conversationId,
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
        });

        // Add error message to conversation
        agent.state.addToConversation(errorResponseMessage);
        toolResponses.push(errorResponseMessage);

        // Inform the client about the error
        responseSubject.next({
          content: `\n${errorMessage}`,
        });
      }
    }

    // Only proceed if we have tool responses
    if (toolResponses.length > 0) {
      try {
        this.logger.debug("Generating final response after tool execution");
        responseSubject.next({
          content: "\nProcessing results...",
        });

        // IMPORTANT CHANGE: Instead of sending the entire conversation history,
        // only send the assistant message with tool calls and the tool results
        // This avoids duplicate tool_use IDs in the request
        const minimalConversationContext = [
          responseMessage, // The assistant message with tool calls
          ...toolResponses, // The tool result messages
        ];

        // Generate final response that incorporates the tool results
        const finalResponseData = await this.modelService.generateResponse(
          minimalConversationContext,
          agent.systemPrompt,
          agent.tools,
          options
        );

        // Create final response message
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

        // Add to conversation
        agent.state.addToConversation(finalResponse);

        // Send the final response content to the client
        responseSubject.next({
          content: `\n\n${finalResponseData.message.content}`,
        });

        // Check if there are more tool calls to execute
        if (
          finalResponseData.toolCalls &&
          finalResponseData.toolCalls.length > 0
        ) {
          this.logger.debug(
            `Final response contains ${finalResponseData.toolCalls.length} more tool calls, processing recursively`
          );

          // Execute recursively with the updated conversation history
          // We still need to maintain the full conversation history for the agent state
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

        // Add error message to conversation
        const errorFinalResponse = new Message({
          role: "assistant",
          content: `I encountered an error processing the tool results: ${error.message}`,
          conversationId,
          metadata: {
            isToolResponseSummary: true,
            error: error.message,
          },
        });

        agent.state.addToConversation(errorFinalResponse);

        // Inform the client about the error
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

    for (const toolCall of toolCalls) {
      try {
        this.logger.debug(
          `Executing tool: ${toolCall.toolName} with args: ${JSON.stringify(
            toolCall.arguments
          )}`
        );

        // Parse arguments if they're a string
        let toolArgs = toolCall.arguments;
        if (typeof toolArgs === "string") {
          try {
            toolArgs = JSON.parse(toolArgs);
          } catch (e) {
            // If it's not valid JSON, keep as string
            this.logger.warn(
              `Could not parse tool arguments as JSON: ${toolArgs}`
            );
          }
        }

        // Execute the tool
        const toolResult = await this.toolRegistry.executeToolByName(
          toolCall.toolName,
          toolArgs
        );

        // Format the tool result for the model
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

        // Create tool response message using your domain model
        const toolResponseMessage = new Message({
          role: "tool",
          content: formattedResult,
          conversationId,
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
        });

        // Add tool response to conversation history
        agent.state.addToConversation(toolResponseMessage);
        toolResponses.push(toolResponseMessage);
      } catch (error) {
        // Handle tool execution error
        const errorMessage = `Error executing tool ${toolCall.toolName}: ${error.message}`;
        this.logger.error(errorMessage);

        const errorResponseMessage = new Message({
          role: "tool",
          content: errorMessage,
          conversationId,
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
        });

        // Add error message to conversation
        agent.state.addToConversation(errorResponseMessage);
        toolResponses.push(errorResponseMessage);
      }
    }

    // If there are tool responses, generate a final response that incorporates tool output
    if (toolResponses.length > 0) {
      try {
        this.logger.debug("Generating final response after tool execution");

        // IMPORTANT CHANGE: Instead of sending the entire conversation history,
        // only send the assistant message with tool calls and the tool results
        // This avoids duplicate tool_use IDs in the request
        const minimalConversationContext = [
          responseMessage, // The assistant message with tool calls
          ...toolResponses, // The tool result messages
        ];

        const finalResponseData = await this.modelService.generateResponse(
          minimalConversationContext,
          agent.systemPrompt,
          agent.tools,
          options
        );

        // Create the final response message
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

        // Add final response to conversation
        agent.state.addToConversation(finalResponse);

        // Check if the final response has more tool calls - if so, process them recursively
        if (
          finalResponseData.toolCalls &&
          finalResponseData.toolCalls.length > 0
        ) {
          this.logger.debug(
            `Final response contains ${finalResponseData.toolCalls.length} more tool calls, processing recursively`
          );

          // Include the current response in the conversation history for the next recursive call
          // We still need to maintain the full conversation history for the agent state
          const updatedPreviousMessages = [
            ...previousMessages,
            responseMessage,
            ...toolResponses,
            finalResponse,
          ];

          // Execute tool calls in the final response recursively
          return this.executeToolCalls(
            agent,
            finalResponse,
            finalResponseData.toolCalls,
            conversationId,
            updatedPreviousMessages,
            options
          );
        }

        return finalResponse;
      } catch (error) {
        this.logger.error(
          `Error generating final response after tool execution: ${error.message}`,
          error.stack
        );

        // Add an error message to the conversation if the final response generation fails
        const errorFinalResponse = new Message({
          role: "assistant",
          content: `I encountered an error processing the tool results: ${error.message}`,
          conversationId,
          metadata: {
            isToolResponseSummary: true,
            error: error.message,
          },
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
