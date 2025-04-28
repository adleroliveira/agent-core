import { Injectable, Logger } from "@nestjs/common";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListFoundationModelsResponse,
  FoundationModelSummary,
} from "@aws-sdk/client-bedrock";
import { Observable, Subject } from "rxjs";

import {
  ModelServicePort,
  ModelRequestOptions,
  ModelResponse,
  ToolCallResult,
  ModelInfo,
  ModelModality,
} from "@ports/model/model-service.port";
import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { BedrockConfigService } from "./bedrock-config.service";
import { FileService } from "@core/services/file.service";
import { MimeTypeService } from '@core/services/mime-type.service';
import { MCPTool } from "@core/domain/mcp-tool.entity";

@Injectable()
export class BedrockModelService implements ModelServicePort {
  private readonly logger = new Logger(BedrockModelService.name);
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly bedrockControlClient: BedrockClient;

  private readonly bedrockFormats: Record<string, string> = {
    // Office Documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',

    // PDF
    'application/pdf': 'pdf',

    // Text Files
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/html': 'html',
    'text/markdown': 'md'
  };

  constructor(
    private readonly configService: BedrockConfigService,
    private readonly fileService: FileService,
    private readonly mimeTypeService: MimeTypeService
  ) {
    // Get region - this is always required
    const region = this.configService.getRegion();
    this.logger.debug(`Using AWS region: ${region}`);

    // Create basic config
    const clientConfig: any = { region };

    // Get all possible credential sources
    const profile = this.configService.getProfile();
    const accessKeyId = this.configService.getAccessKeyId();
    const secretAccessKey = this.configService.getSecretAccessKey();
    const sessionToken = this.configService.getSessionToken();

    // Explicit credential resolution with clear priority:
    // 1. Profile (if specified)
    if (profile) {
      this.logger.debug(`Using AWS credentials from profile: ${profile}`);
      clientConfig.profile = profile;
    }
    // 2. Direct credentials (access key + secret)
    else if (accessKeyId && secretAccessKey) {
      this.logger.debug('Using AWS credentials from direct access key/secret');
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey
      };

      if (sessionToken) {
        this.logger.debug('Adding session token to credentials');
        clientConfig.credentials.sessionToken = sessionToken;
      }
    }
    // 3. Session token only (for web identity roles)
    else if (sessionToken) {
      this.logger.debug('Using AWS credentials with session token only');
      clientConfig.credentials = {
        sessionToken
      };
    }
    // 4. Fallback to SDK defaults
    else {
      this.logger.debug('No explicit credentials provided, falling back to SDK defaults');
      this.logger.debug('SDK will attempt to load credentials from:');
      this.logger.debug('1. Environment variables');
      this.logger.debug('2. Shared credentials file (~/.aws/credentials)');
      this.logger.debug('3. Shared config file (~/.aws/config)');
      this.logger.debug('4. Container credentials (ECS)');
      this.logger.debug('5. Instance profile credentials (EC2)');
    }

    // Initialize Bedrock clients
    this.bedrockClient = new BedrockRuntimeClient(clientConfig);
    this.bedrockControlClient = new BedrockClient(clientConfig);
    this.logger.debug('Bedrock clients initialized successfully');
  }

  async generateResponse(
    messages: Message[],
    systemPrompt: Prompt | Prompt[],
    tools?: MCPTool[],
    options?: ModelRequestOptions
  ): Promise<ModelResponse> {
    const modelId = options?.modelId || this.configService.getModelId();

    try {
      const requestBody = await this.createConverseRequest(
        messages,
        systemPrompt,
        tools,
        options
      );

      const conversationId = messages[0].stateId;

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
    systemPrompt: Prompt | Prompt[],
    tools?: MCPTool[],
    options?: ModelRequestOptions
  ): Observable<Partial<ModelResponse>> {
    const modelId = options?.modelId || this.configService.getModelId();
    const conversationId = messages[0].stateId;
    const subject = new Subject<Partial<ModelResponse>>();

    (async () => {
      try {
        const requestBody = await this.createConverseRequest(
          messages,
          systemPrompt,
          tools,
          options
        );

        const command = new ConverseStreamCommand({
          modelId,
          ...requestBody,
        });

        const response = await this.bedrockClient.send(command);

        if (!response || !response.stream) {
          this.logger.error(`Invalid streaming response from Bedrock for agent ${conversationId}`);
          subject.error(new Error('Invalid streaming response from Bedrock'));
          return;
        }

        let currentContent = "";
        let pendingToolUse: {
          toolName: string;
          toolId: string;
          arguments: string;
        } | null = null;

        for await (const event of response.stream) {
          if (!event) continue;

          const [eventType, eventValue] = Object.entries(event)[0];

          switch (eventType) {
            case "messageStart":
              currentContent = "";
              subject.next({
                message: new Message({
                  role: "assistant",
                  content: currentContent,
                  stateId: conversationId,
                }),
              });
              break;

            case "contentBlockStart":
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
                pendingToolUse.arguments += eventValue.delta.toolUse.input;
              } else if (eventValue?.delta?.text) {
                currentContent += eventValue.delta.text;
                subject.next({
                  message: new Message({
                    role: "assistant",
                    content: eventValue.delta.text,
                    stateId: conversationId,
                  }),
                });
              }
              break;

            case "contentBlockStop":
              if (pendingToolUse) {
                try {
                  const toolCall: ToolCallResult = {
                    toolName: pendingToolUse.toolName,
                    toolId: pendingToolUse.toolId,
                    arguments: typeof pendingToolUse.arguments === "string"
                      ? JSON.parse(pendingToolUse.arguments || "{}")
                      : pendingToolUse.arguments || {},
                  };
                  subject.next({ toolCalls: [toolCall] });
                } catch (error) {
                  this.logger.warn(
                    `Failed to parse tool arguments as JSON: ${error.message}`
                  );
                }
                pendingToolUse = null;
              }
              break;

            case "messageStop":
              break;

            case "metadata":
              if (eventValue?.usage) {
                const usageBlock = {
                  usage: {
                    promptTokens: eventValue.usage.inputTokens || 0,
                    completionTokens: eventValue.usage.outputTokens || 0,
                    totalTokens:
                      (eventValue.usage.inputTokens || 0) +
                      (eventValue.usage.outputTokens || 0),
                  },
                }
                subject.next(usageBlock);
                subject.complete();
              }
              break;

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
    })();

    return subject.asObservable();
  }

  async generateEmbedding(
    text: string,
    options?: Record<string, any>
  ): Promise<number[]> {
    const embeddingModelId = this.configService.getEmbeddingModelId();

    try {
      if (embeddingModelId.includes("amazon.titan-embed")) {
        const payload = {
          inputText: text,
        };

        const command = new InvokeModelCommand({
          modelId: embeddingModelId,
          body: JSON.stringify(payload),
        });

        const response = await this.bedrockClient.send(command);
        const responseBody = JSON.parse(
          new TextDecoder().decode(response.body)
        );

        if (responseBody.embedding) {
          return responseBody.embedding;
        }
      } else if (embeddingModelId.includes("cohere.embed")) {
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

        if (responseBody.embeddings && responseBody.embeddings.length > 0) {
          return responseBody.embeddings[0];
        }
      } else {
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
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text, options);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  private sanitizeFileName(originalName: string): string {
    // Remove file extension
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");

    // Replace invalid characters with hyphens
    let sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, '-');

    // Replace multiple consecutive spaces with a single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Trim whitespace
    sanitized = sanitized.trim();

    // If the name is empty after sanitization, use a default name
    if (!sanitized) {
      sanitized = 'document';
    }

    return sanitized;
  }

  private getDocumentFormat(mimeType: string): string {
    const format = this.bedrockFormats[mimeType];
    if (format) {
      this.logger.debug(`Using MIME type format: ${format}`);
      return format;
    }

    this.logger.debug('Defaulting to txt format');
    return 'txt';
  }

  private async createConverseRequest(
    messages: Message[],
    systemPrompt: Prompt | Prompt[],
    tools?: MCPTool[],
    options?: ModelRequestOptions
  ): Promise<any> {
    const formattedMessages = await Promise.all(messages.map(async (message) => {
      if (message.role === "assistant") {
        const content: any[] = [];

        if (message.content) {
          content.push({
            text: typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content),
          });
        }

        if (message.toolCalls) {
          content.push(...message.toolCalls.map((toolCall) => ({
            toolUse: {
              toolUseId: toolCall.id,
              name: toolCall.name,
              input: toolCall.arguments,
            },
          })));
        }

        return {
          role: "assistant",
          content,
        };
      } else if (message.role === "user") {
        const content: any[] = [];

        if (message.content) {
          content.push({
            text: typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content),
          });
        }

        // Add files if present
        if (message.files && message.files.length > 0) {
          const fileContents = await this.fileService.getMessageFileContents(message);
          content.push(...message.files.map((file, index) => {
            const mimeType = this.mimeTypeService.getMimeType(file.originalName, file.mimetype);
            const format = this.getDocumentFormat(mimeType);

            return {
              document: {
                format: format,
                name: this.sanitizeFileName(file.originalName),
                source: {
                  bytes: fileContents[index]
                }
              }
            };
          }));
        }

        return {
          role: "user",
          content,
        };
      } else if (message.role === "tool") {
        try {
          const toolResults = message.toolResults || [];

          return {
            role: "user",
            content: toolResults.map((toolResult) => ({
              toolResult: {
                toolUseId: toolResult.toolCallId,
                content: [{
                  text: typeof toolResult.result === "string"
                    ? toolResult.result
                    : JSON.stringify(toolResult.result),
                }],
                status: toolResult.isError ? "error" : "success",
              },
            })),
          };
        } catch (error) {
          this.logger.error(`Error parsing tool results: ${error.message}`);
          return {
            role: "user",
            content: [{
              toolResult: {
                toolUseId: message.toolCallId,
                content: [{
                  text: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
                }],
                status: message.isToolError ? "error" : "success",
              },
            }],
          };
        }
      }
    }));

    const systemContent = Array.isArray(systemPrompt)
      ? systemPrompt.map(prompt => ({
        text: typeof prompt.content === "string"
          ? prompt.content
          : JSON.stringify(prompt.content),
      }))
      : [{
        text: typeof systemPrompt.content === "string"
          ? systemPrompt.content
          : JSON.stringify(systemPrompt.content),
      }];

    const requestBody: any = {
      messages: formattedMessages,
      system: systemContent,
      inferenceConfig: {
        maxTokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7,
        topP: options?.topP || 0.9,
        ...(options?.topK && { topK: options.topK }),
        ...(options?.stopSequences && { stopSequences: options.stopSequences }),
      },
    };

    if (tools && tools.length > 0) {
      requestBody.toolConfig = {
        tools: tools.map((tool) => ({
          toolSpec: {
            name: tool.name,
            description: tool.description || tool.name,
            inputSchema: {
              json: tool.inputSchema,
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
        stateId: conversationId,
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
      if (response.output?.message) {
        const messageContent = response.output.message.content;
        let textContent = "";
        let toolCalls: ToolCallResult[] = [];

        if (Array.isArray(messageContent)) {
          messageContent.forEach((item: any) => {
            if (item.text) {
              textContent += item.text;
            }

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
        } else if (typeof messageContent === "string") {
          modelResponse.message.content = messageContent;
        } else if (messageContent?.text) {
          modelResponse.message.content = messageContent.text;
        }
      }

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
    }

    return modelResponse;
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const command = new ListFoundationModelsCommand({});
      const response: ListFoundationModelsResponse = await this.bedrockControlClient.send(command);

      const modelSumaries = response.modelSummaries?.map((model: FoundationModelSummary) => {
        let modelId = model.modelId || '';

        // Add "us." prefix if the only inference type is INFERENCE_PROFILE
        if (model.inferenceTypesSupported?.length === 1) {
          const inferenceType = model.inferenceTypesSupported[0] as string;
          if (inferenceType === 'INFERENCE_PROFILE') {
            modelId = `us.${modelId}`;
          }
        }

        return {
          id: modelId,
          name: model.modelName || '',
          description: '',
          capabilities: [],
          maxTokens: undefined,
          contextWindow: undefined,
          supportsStreaming: model.responseStreamingSupported || false,
          supportsToolCalls: this.configService.supportsToolCalling(modelId),
          inputModalities: this.mapModalities(model.inputModalities),
          outputModalities: this.mapModalities(model.outputModalities),
          pricing: {
            input: undefined,
            output: undefined,
          },
          provider: model.providerName || 'Unknown',
          active: model.modelLifecycle?.status === 'ACTIVE',
          metadata: {
            provider: model.providerName || 'Unknown',
            customizationType: undefined,
            inferenceTypes: model.inferenceTypesSupported || [],
          }
        };
      }) || [];

      return modelSumaries;
    } catch (error) {
      this.logger.error(
        `Error listing Bedrock models: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to list available models: ${error.message}`);
    }
  }

  private mapModalities(modalities?: string[]): ModelModality[] {
    if (!modalities) return ['text']; // Default to text if no modalities specified

    return modalities.map(modality => {
      switch (modality.toLowerCase()) {
        case 'text':
          return 'text';
        case 'image':
          return 'image';
        case 'audio':
          return 'audio';
        case 'video':
          return 'video';
        case 'embedding':
          return 'embeddings';
        case 'speech':
          return 'speech';
        default:
          return 'text';
      }
    });
  }
}
