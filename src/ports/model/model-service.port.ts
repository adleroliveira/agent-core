import { Observable } from "rxjs";
import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { Tool } from "@core/domain/tool.entity";

export interface ModelRequestOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  toolChoice?: any;
}

export interface ModelResponse {
  message: Message;
  toolCalls?: ToolCallResult[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface ToolCallResult {
  toolName: string;
  toolId: string;
  arguments: any;
}

export interface ModelServicePort {
  // Core model interaction methods
  generateResponse(
    messages: Message[],
    systemPrompt: Prompt,
    tools?: Tool[],
    options?: ModelRequestOptions
  ): Promise<ModelResponse>;

  generateStreamingResponse(
    messages: Message[],
    systemPrompt: Prompt,
    tools?: Tool[],
    options?: ModelRequestOptions
  ): Observable<Partial<ModelResponse>>;

  // Embedding generation
  generateEmbedding(
    text: string,
    options?: Record<string, any>
  ): Promise<number[]>;

  generateEmbeddings(
    texts: string[],
    options?: Record<string, any>
  ): Promise<number[][]>;
}
