import { Injectable, Logger } from "@nestjs/common";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { v4 as uuidv4 } from "uuid";
import { Observable, Subject } from "rxjs";

import {
  ModelServicePort,
  ModelRequestOptions,
  ModelResponse,
  ToolCallResult,
} from "@ports/model/model-service.port";
import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { Tool } from "@core/domain/tool.entity";
import { BedrockConfigService } from "./bedrock-config.service";

@Injectable()
export class BedrockModelService implements ModelServicePort {
  private readonly logger = new Logger(BedrockModelService.name);
  private readonly bedrockClient: BedrockRuntimeClient;

  constructor(private readonly configService: BedrockConfigService) {
    this.bedrockClient = new BedrockRuntimeClient({
      region: this.configService.getRegion(),
      credentials: {
        accessKeyId: this.configService.getAccessKeyId(),
        secretAccessKey: this.configService.getSecretAccessKey(),
      },
    });
  }

  async generateResponse(
    messages: Message[],
    systemPrompt: Prompt,
    tools?: Tool[],
    options?: ModelRequestOptions
  ): Promise<ModelResponse> {
    const modelId = this.configService.getModelId();
    const conversationId =
      messages.length > 0 ? messages[0].conversationId : uuidv4();

    try {
      // Create request body for ConverseAPI
      const requestBody = this.createConverseRequest(
        messages,
        systemPrompt,
        tools,
        options
      );

      const command = new ConverseCommand({
        modelId,
        conversationId,
        ...requestBody,
      });

      const response = await this.bedrockClient.send(command);
      return this.parseModelResponse(response, conversationId);
    } catch (error) {
      this.logger.error(
        `Error invoking Bedrock model: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  generateStreamingResponse(
    messages: Message[],
    systemPrompt: Prompt,
    tools?: Tool[],
    options?: ModelRequestOptions,
    toolExecutor?: (toolCall: ToolCallResult) => Promise<any>
  ): Observable<Partial<ModelResponse>> {
    const modelId = this.configService.getModelId();
    const conversationId =
      messages.length > 0 ? messages[0].conversationId : uuidv4();
    const subject = new Subject<Partial<ModelResponse>>();

    // Create request body for ConverseStreamAPI using our formatter
    const requestBody = this.createConverseRequest(
      messages,
      systemPrompt,
      tools,
      options
    );

    const command = new ConverseStreamCommand({
      modelId,
      conversationId,
      ...requestBody,
    });

    let currentContent = "";
    let pendingToolUse: {
      toolName: string;
      toolId: string;
      arguments: string;
    } | null = null;

    const streamingProcess = async () => {
      try {
        const response = await this.bedrockClient.send(command);

        if (response.stream) {
          for await (const event of response.stream) {
            if (!event) continue;

            // Extract event type and value
            const [eventType, eventValue] = Object.entries(event)[0];

            switch (eventType) {
              case "messageStart":
                // Reset content when a new message starts
                currentContent = "";
                // Emit an initial empty message
                subject.next({
                  message: new Message({
                    role: "assistant",
                    content: currentContent,
                    conversationId,
                  }),
                });
                break;

              case "contentBlockStart":
                // Handle tool use events
                const toolUse = eventValue?.start?.toolUse;
                if (toolUse?.toolUseId && toolUse?.name) {
                  pendingToolUse = {
                    toolName: toolUse.name,
                    toolId: toolUse.toolUseId,
                    arguments: "",
                  };
                }
                break;

              case "contentBlockDelta":
                if (pendingToolUse && eventValue?.delta?.toolUse?.input) {
                  // Accumulate tool input
                  pendingToolUse.arguments += eventValue.delta.toolUse.input;
                } else if (eventValue?.delta?.text) {
                  // Accumulate text content
                  currentContent += eventValue.delta.text;
                  subject.next({
                    message: new Message({
                      role: "assistant",
                      content: eventValue.delta.text, // currentContent,
                      conversationId,
                    }),
                  });
                }
                break;

              case "contentBlockStop":
                // No specific action needed here for text content
                break;

              case "messageStop":
                // If we have pending tool use and toolExecutor is provided, execute it
                if (pendingToolUse && toolExecutor) {
                  try {
                    let toolArgs;
                    try {
                      toolArgs =
                        typeof pendingToolUse.arguments === "string"
                          ? JSON.parse(pendingToolUse.arguments || "{}")
                          : pendingToolUse.arguments || {};
                    } catch (error) {
                      this.logger.warn(
                        `Failed to parse tool arguments as JSON: ${error.message}`
                      );
                      toolArgs = { rawArguments: pendingToolUse.arguments };
                    }

                    const toolCall: ToolCallResult = {
                      toolName: pendingToolUse.toolName,
                      toolId: pendingToolUse.toolId,
                      arguments: toolArgs,
                    };

                    // Emit the tool call
                    subject.next({ toolCalls: [toolCall] });

                    // Execute tool and continue the conversation
                    await this.handleStreamingToolExecution(
                      toolCall,
                      conversationId,
                      toolExecutor,
                      subject
                    );
                  } catch (error) {
                    this.logger.error(
                      `Error processing tool: ${error.message}`
                    );
                    // Complete the stream with an error message
                    subject.next({
                      message: new Message({
                        role: "assistant",
                        content: `${currentContent}\n\nI encountered an error processing the tool: ${error.message}`,
                        conversationId,
                      }),
                    });
                    subject.complete();
                  }
                } else if (pendingToolUse) {
                  // If we have a pending tool use but no executor, just emit the tool call
                  try {
                    let toolArgs;
                    try {
                      toolArgs =
                        typeof pendingToolUse.arguments === "string"
                          ? JSON.parse(pendingToolUse.arguments || "{}")
                          : pendingToolUse.arguments || {};
                    } catch (error) {
                      this.logger.warn(
                        `Failed to parse tool arguments as JSON: ${error.message}`
                      );
                      toolArgs = { rawArguments: pendingToolUse.arguments };
                    }

                    subject.next({
                      toolCalls: [
                        {
                          toolName: pendingToolUse.toolName,
                          toolId: pendingToolUse.toolId,
                          arguments: toolArgs,
                        },
                      ],
                    });
                  } catch (error) {
                    this.logger.error(
                      `Error processing tool call: ${error.message}`
                    );
                  }
                  // Complete the stream since we can't continue without executing the tool
                  subject.complete();
                  return;
                } else {
                  // Final message with completed content

                  subject.complete();
                }
                break;

              case "metadata":
                // Handle usage information if available
                if (eventValue?.usage) {
                  subject.next({
                    usage: {
                      promptTokens: eventValue.usage.inputTokens || 0,
                      completionTokens: eventValue.usage.outputTokens || 0,
                      totalTokens:
                        (eventValue.usage.inputTokens || 0) +
                        (eventValue.usage.outputTokens || 0),
                    },
                  });
                }
                break;

              // Handle error cases
              case "internalServerException":
              case "modelStreamErrorException":
              case "validationException":
              case "throttlingException":
              case "serviceUnavailableException":
                this.logger.error(`Stream error: ${eventType}`, eventValue);
                subject.error(
                  new Error(`${eventType}: ${JSON.stringify(eventValue)}`)
                );
                break;

              default:
                this.logger.warn(`Unknown event type: ${eventType}`);
                break;
            }
          }
        }

        // If we reach here without completing the subject, do it now
        if (!subject.closed) {
          subject.complete();
        }
      } catch (error) {
        this.logger.error(
          `Error in streaming response: ${error.message}`,
          error.stack
        );
        subject.error(
          new Error(`Failed to generate streaming response: ${error.message}`)
        );
      }
    };

    // Start the streaming process
    streamingProcess();

    return subject.asObservable();
  }

  async handleStreamingToolExecution(
    toolCall: ToolCallResult,
    conversationId: string,
    toolExecutor: (toolCall: ToolCallResult) => Promise<any>,
    subject: Subject<Partial<ModelResponse>>
  ): Promise<void> {
    let result;
    try {
      result = await toolExecutor(toolCall);
      this.logger.debug(
        `Tool execution result: ${JSON.stringify(result).substring(0, 100)}...`
      );
    } catch (error) {
      this.logger.error(
        `Error executing tool ${toolCall.toolName}: ${error.message}`,
        error.stack
      );
      result = { error: error.message };
    }

    // Create tool response message for the client
    const toolResultMessage = new Message({
      role: "tool",
      content: typeof result === "string" ? result : JSON.stringify(result),
      toolCallId: toolCall.toolId,
      toolName: toolCall.toolName,
      conversationId,
    });

    // Emit the tool result to the client
    subject.next({
      message: toolResultMessage,
    });

    try {
      // Create the assistant message with the tool call
      const assistantMessage = new Message({
        role: "assistant",
        content: "",
        conversationId,
        id: uuidv4(), // Generate a unique ID for the assistant message
        toolCalls: [
          {
            id: toolCall.toolId,
            name: toolCall.toolName,
            arguments: (() => {
              if (typeof toolCall.arguments === "string") {
                try {
                  return JSON.parse(toolCall.arguments);
                } catch (e) {
                  this.logger.warn(
                    `Failed to parse tool arguments as JSON: ${e.message}`
                  );
                  return { rawArguments: toolCall.arguments };
                }
              }
              return toolCall.arguments;
            })(),
          },
        ],
      });

      // Associate the tool result message with the assistant message that generated it
      toolResultMessage.metadata = {
        ...toolResultMessage.metadata,
        parentMessageId: assistantMessage.id,
      };

      // Create the tool response messages array
      const toolResponseMessages = [assistantMessage, toolResultMessage];

      const requestBody = this.createConverseRequest(
        toolResponseMessages,
        new Prompt({
          content: "",
          type: "system",
        })
      );

      const command = new ConverseStreamCommand({
        modelId: this.configService.getModelId(),
        conversationId,
        ...requestBody,
      });

      let currentContent = "";

      const response = await this.bedrockClient.send(command);
      if (response.stream) {
        for await (const event of response.stream) {
          if (!event) continue;

          // Extract event type and value
          const [eventType, eventValue] = Object.entries(event)[0];

          switch (eventType) {
            case "contentBlockDelta":
              if (eventValue?.delta?.text) {
                currentContent += eventValue.delta.text;
                subject.next({
                  message: new Message({
                    role: "assistant",
                    content: eventValue.delta.text,
                    conversationId,
                  }),
                });
              }
              break;

            case "metadata":
              if (eventValue?.usage) {
                subject.next({
                  usage: {
                    promptTokens: eventValue.usage.inputTokens || 0,
                    completionTokens: eventValue.usage.outputTokens || 0,
                    totalTokens:
                      (eventValue.usage.inputTokens || 0) +
                      (eventValue.usage.outputTokens || 0),
                  },
                });
              }
              break;

            case "messageStop":
              // Final message with completed content for tool response
              subject.next({
                message: new Message({
                  role: "assistant",
                  content: currentContent,
                  conversationId,
                }),
              });
              break;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in tool response streaming: ${error.message}`,
        error.stack
      );
      // Still send back the tool response so UI can show it
      subject.next({
        message: new Message({
          role: "assistant",
          content: `I encountered an error processing the tool result: ${error.message}`,
          conversationId,
        }),
      });
    }
  }

  async handleToolExecution(
    response: ModelResponse,
    toolExecutor: (toolCall: ToolCallResult) => Promise<any>
  ): Promise<ModelResponse> {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response;
    }

    const conversationId = response.message.conversationId;
    const executedToolCalls: ToolCallResult[] = [];

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      try {
        this.logger.debug(
          `Executing tool ${toolCall.toolName} with args: ${JSON.stringify(
            toolCall.arguments
          )}`
        );
        const result = await toolExecutor(toolCall);
        this.logger.debug(
          `Tool ${toolCall.toolName} result: ${JSON.stringify(result).substring(
            0,
            100
          )}...`
        );

        executedToolCalls.push({
          ...toolCall,
          result,
          isError: false,
        });
      } catch (error) {
        this.logger.error(
          `Error executing tool ${toolCall.toolName}: ${error.message}`,
          error.stack
        );
        executedToolCalls.push({
          ...toolCall,
          result: { error: error.message },
          isError: true,
          errorMessage: error.message,
        });
      }
    }

    // Create messages for the follow-up request
    // First, add the assistant's message with the tool calls
    const updatedMessages = [
      new Message({
        role: "assistant",
        content: response.message.content,
        conversationId,
        toolCalls: response.toolCalls.map((tc) => ({
          id: tc.toolId,
          name: tc.toolName,
          arguments: (() => {
            if (typeof tc.arguments === "string") {
              try {
                return JSON.parse(tc.arguments);
              } catch (e) {
                this.logger.warn(
                  `Failed to parse tool arguments as JSON: ${e.message}`
                );
                return { rawArguments: tc.arguments };
              }
            }
            return tc.arguments;
          })(),
        })),
      }),
    ];

    // Then add each tool result as a separate message
    for (const toolCall of executedToolCalls) {
      // Check if the result contains an error
      const hasError =
        toolCall.result &&
        typeof toolCall.result === "object" &&
        "error" in toolCall.result;

      updatedMessages.push(
        new Message({
          role: "tool",
          content:
            typeof toolCall.result === "string"
              ? toolCall.result
              : JSON.stringify(toolCall.result),
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
          conversationId,
          isToolError: hasError, // Set this flag based on error presence
        })
      );
    }

    return this.generateResponse(
      updatedMessages,
      new Prompt({
        content: "",
        type: "system",
      })
    );
  }

  async generateEmbedding(
    text: string,
    options?: Record<string, any>
  ): Promise<number[]> {
    const embeddingModelId = this.configService.getEmbeddingModelId();

    try {
      // Handle different embedding model types based on their IDs
      if (embeddingModelId.includes("amazon.titan-embed")) {
        // Amazon Titan Embeddings format - use InvokeModelCommand
        const payload = {
          inputText: text,
        };

        const command = new InvokeModelCommand({
          modelId: embeddingModelId,
          body: JSON.stringify(payload),
        });

        const response = await this.bedrockClient.send(command);

        // Parse the response body
        const responseBody = JSON.parse(
          new TextDecoder().decode(response.body)
        );

        // Return the embedding from the response
        if (responseBody.embedding) {
          return responseBody.embedding;
        }
      } else if (embeddingModelId.includes("cohere.embed")) {
        // Cohere embedding format
        const payload = {
          texts: [text],
          input_type: "search_document",
        };

        const command = new InvokeModelCommand({
          modelId: embeddingModelId,
          body: JSON.stringify(payload),
        });

        const response = await this.bedrockClient.send(command);
        const responseBody = JSON.parse(
          new TextDecoder().decode(response.body)
        );

        // Cohere returns embeddings array
        if (responseBody.embeddings && responseBody.embeddings.length > 0) {
          return responseBody.embeddings[0];
        }
      } else {
        // For other embedding models - generic approach
        const payload = {
          input: text,
        };

        const command = new InvokeModelCommand({
          modelId: embeddingModelId,
          body: JSON.stringify(payload),
          ...(options || {}),
        });

        const response = await this.bedrockClient.send(command);
        const responseBody = JSON.parse(
          new TextDecoder().decode(response.body)
        );

        // Try to extract embedding from common response formats
        if (responseBody.embedding) {
          return responseBody.embedding;
        } else if (
          responseBody.embeddings &&
          responseBody.embeddings.length > 0
        ) {
          return responseBody.embeddings[0];
        } else if (Array.isArray(responseBody)) {
          return responseBody;
        }
      }

      // If we get here, the embedding wasn't found in any expected format
      this.logger.warn(
        `Embedding model ${embeddingModelId} returned unexpected format from InvokeModel`
      );
      throw new Error("Embedding not found in model response");
    } catch (error) {
      this.logger.error(
        `Error generating embedding with model ${embeddingModelId}: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async generateEmbeddings(
    texts: string[],
    options?: Record<string, any>
  ): Promise<number[][]> {
    const embeddingModelId = this.configService.getEmbeddingModelId();

    try {
      // For batch processing, we'll process each text individually
      // In a production system, you might want to implement batching based on the provider's capabilities
      const embeddings: number[][] = [];

      for (const text of texts) {
        const embedding = await this.generateEmbedding(text, options);
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      this.logger.error(
        `Error generating batch embeddings with model ${embeddingModelId}: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate batch embeddings: ${error.message}`);
    }
  }

  private createConverseRequest(
    messages: Message[],
    systemPrompt: Prompt,
    tools?: Tool[],
    options?: ModelRequestOptions
  ): any {
    // Convert domain model messages to Bedrock API format
    const bedrockMessages = [];

    // Group tool results by their parent assistant message (if any)
    const toolResultsByMessage = new Map<string, Message[]>();

    // First pass: collect all tool messages and group them by their parent message
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // If this is a tool message, find its parent assistant message
      if (message.role === "tool" && message.toolCallId) {
        // Look backwards for the assistant message that contains this tool call
        for (let j = i - 1; j >= 0; j--) {
          const potentialParent = messages[j];
          if (
            potentialParent.role === "assistant" &&
            potentialParent.toolCalls?.some(
              (tc) => tc.id === message.toolCallId
            )
          ) {
            // Found the parent message
            if (!toolResultsByMessage.has(potentialParent.id)) {
              toolResultsByMessage.set(potentialParent.id, []);
            }
            const resultsArray =
              toolResultsByMessage.get(potentialParent.id) || [];
            resultsArray.push(message);
            toolResultsByMessage.set(potentialParent.id, resultsArray);
            break;
          }
        }
      }
    }

    // Second pass: construct the actual messages with grouped tool results
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (message.role === "assistant") {
        // Format the message content
        let formattedContent: any[] = [];

        // Add text content if present
        if (message.content) {
          formattedContent.push({
            text:
              typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content),
          });
        }

        // Add tool calls if present
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const toolCall of message.toolCalls) {
            let toolCallArgs;
            try {
              toolCallArgs =
                typeof toolCall.arguments === "string"
                  ? JSON.parse(toolCall.arguments)
                  : toolCall.arguments;
            } catch (e) {
              this.logger.warn(
                `Failed to parse tool arguments as JSON: ${e.message}`
              );
              toolCallArgs = { rawArguments: toolCall.arguments };
            }

            formattedContent.push({
              toolUse: {
                toolUseId: toolCall.id,
                name: toolCall.name,
                input: toolCallArgs,
              },
            });
          }
        }

        // Add the assistant message to the bedrock messages
        bedrockMessages.push({
          role: "assistant",
          content: formattedContent,
        });

        // Check if there are tool results for this assistant message
        const toolResults = toolResultsByMessage.get(message.id);
        if (toolResults && toolResults.length > 0) {
          // Create a user message with all tool results for this assistant message
          const toolResultsContent = toolResults.map((toolResult) => {
            // Format tool content
            let toolContent;
            if (toolResult.isToolError) {
              toolContent =
                typeof toolResult.content === "string"
                  ? toolResult.content
                  : JSON.stringify(toolResult.content);
            } else {
              // For non-error tool responses, attempt JSON parsing
              try {
                toolContent =
                  typeof toolResult.content === "string"
                    ? JSON.parse(toolResult.content)
                    : toolResult.content;
              } catch (e) {
                this.logger.debug(
                  `Failed to parse tool content as JSON, using as string: ${e.message}`
                );
                toolContent =
                  typeof toolResult.content === "string"
                    ? toolResult.content
                    : JSON.stringify(toolResult.content);
              }
            }

            // Format the tool result content
            return {
              toolResult: {
                toolUseId: toolResult.toolCallId,
                content: [
                  // If it's an array, wrap it in an object with a results key
                  typeof toolContent === "object" && toolContent !== null
                    ? {
                      json: Array.isArray(toolContent)
                        ? { results: toolContent }
                        : toolContent,
                    }
                    : { text: String(toolContent) },
                ],
                status: toolResult.isToolError ? "error" : "success",
              },
            };
          });

          // Add a single user message with all tool results
          bedrockMessages.push({
            role: "user",
            content: toolResultsContent,
          });
        }
      } else if (message.role === "user") {
        // Add user message (only if it's not a tool result, as we're handling those separately)
        if (!message.toolCallId) {
          bedrockMessages.push({
            role: "user",
            content: [
              {
                text:
                  typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content),
              },
            ],
          });
        }
      }
    }

    // Format system prompt for Bedrock
    let systemContent: any[];
    if (typeof systemPrompt.content === "string") {
      systemContent = [{ text: systemPrompt.content }];
    } else {
      systemContent = Array.isArray(systemPrompt.content)
        ? systemPrompt.content
        : [{ text: systemPrompt.content || "" }];
    }

    // Set request structure
    const requestBody: any = {
      messages: bedrockMessages,
      system: systemContent,
      inferenceConfig: {
        maxTokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7,
        topP: options?.topP || 0.9,
        ...(options?.topK && { topK: options.topK }),
        ...(options?.stopSequences && { stopSequences: options.stopSequences }),
      },
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      // Deduplicate tools by name
      const uniqueTools = tools.reduce((acc: Tool[], tool) => {
        if (!acc.find(t => t.name === tool.name)) {
          acc.push(tool);
        }
        return acc;
      }, []);

      requestBody.toolConfig = {
        tools: uniqueTools.map((tool) => ({
          toolSpec: {
            name: tool.name,
            description: tool.directive || tool.description || tool.name,
            inputSchema: {
              json: {
                type: "object",
                properties: tool.parameters.reduce(
                  (acc: Record<string, any>, param) => {
                    acc[param.name] = {
                      type: param.type,
                      description: param.description || "",
                    };
                    if (param.enum) {
                      acc[param.name].enum = param.enum;
                    }
                    return acc;
                  },
                  {}
                ),
                required: tool.parameters
                  .filter((param) => param.required)
                  .map((param) => param.name),
              },
            },
          },
        })),
        toolChoice: options?.toolChoice || { auto: {} },
      };
    }

    return requestBody;
  }

  private parseModelResponse(
    response: any,
    conversationId: string
  ): ModelResponse {
    const modelResponse: ModelResponse = {
      message: new Message({
        role: "assistant",
        content: "",
        conversationId,
      }),
      usage: {
        promptTokens: response.usage?.inputTokens || 0,
        completionTokens: response.usage?.outputTokens || 0,
        totalTokens:
          (response.usage?.inputTokens || 0) +
          (response.usage?.outputTokens || 0),
      },
      metadata: {},
    };

    try {
      // Parse message content
      if (response.output?.message) {
        const messageContent = response.output.message.content;
        let textContent = "";
        let toolCalls: ToolCallResult[] = [];

        // Handle array of content items (mix of text and tool use)
        if (Array.isArray(messageContent)) {
          messageContent.forEach((item: any) => {
            // If it's a text content
            if (item.text) {
              textContent += item.text;
            }

            // If it's a tool use
            if (item.toolUse) {
              toolCalls.push({
                toolName: item.toolUse.name,
                toolId: item.toolUse.toolUseId,
                arguments: item.toolUse.input || {},
              });
            }
          });

          modelResponse.message.content = textContent;
          if (toolCalls.length > 0) {
            modelResponse.toolCalls = toolCalls;
          }
        }
        // Handle string content
        else if (typeof messageContent === "string") {
          modelResponse.message.content = messageContent;
        }
        // Handle object with text property
        else if (messageContent?.text) {
          modelResponse.message.content = messageContent.text;
        }
      }

      // Also check for the traditional toolUses pattern as a fallback
      if (
        !modelResponse.toolCalls &&
        response.output?.toolUses &&
        response.output.toolUses.length > 0
      ) {
        modelResponse.toolCalls = response.output.toolUses.map(
          (toolUse: any) => ({
            toolName: toolUse.name,
            toolId: toolUse.id,
            arguments: toolUse.parameters || {},
          })
        );
      }

      // Add provider-specific metadata
      if (response.modelId) {
        modelResponse.metadata = {
          ...modelResponse.metadata,
          modelId: response.modelId,
          modelVersion: response.modelVersion,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error parsing model response: ${error.message}`,
        error.stack
      );
      // Return basic response with original content even if parsing fails
    }

    // this.logger.debug("ModelResponse", JSON.stringify(modelResponse, null, 2));
    return modelResponse;
  }
}
