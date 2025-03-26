import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { Tool } from "@core/domain/tool.entity";
import { Observable } from "rxjs";

export interface ModelRequestOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  [key: string]: any; // For provider-specific options
}

export interface ToolCallResult {
  toolName: string;
  toolId: string;
  arguments: Record<string, any>;
  result?: any;
  isError?: boolean; // Add this field to explicitly indicate error state
  errorMessage?: string; // Optional field to store error message
}

export interface ModelResponse {
  message: Message;
  toolCalls?: ToolCallResult[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>; // For provider-specific response data
}

export interface ModelServicePort {
  // Standard request-response
  generateResponse(
    messages: Message[],
    systemPrompt: Prompt,
    tools?: Tool[],
    options?: ModelRequestOptions
  ): Promise<ModelResponse>;

  // Streaming response
  generateStreamingResponse(
    messages: Message[],
    systemPrompt: Prompt,
    tools?: Tool[],
    options?: ModelRequestOptions
  ): Observable<Partial<ModelResponse>>;

  // For tools that require runtime execution/feedback
  handleToolExecution?(
    response: ModelResponse,
    toolExecutor: (toolCall: ToolCallResult) => Promise<any>
  ): Promise<ModelResponse>;

  // Embeddings
  generateEmbedding(
    text: string,
    options?: Record<string, any>
  ): Promise<number[]>;

  // Optional method for batch embeddings for efficiency
  generateEmbeddings(
    texts: string[],
    options?: Record<string, any>
  ): Promise<number[][]>;
}
