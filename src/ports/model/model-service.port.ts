import { Observable } from "rxjs";
import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { Tool } from "@core/domain/tool.entity";

export interface ModelRequestOptions {
  maxTokens?: number;
  modelId?: string;
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

export type ModelModality = 'text' | 'image' | 'audio' | 'video' | 'embeddings' | 'speech';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  maxTokens?: number;
  contextWindow?: number;
  // Model capabilities
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  inputModalities: ModelModality[];
  outputModalities: ModelModality[];
  // Pricing and metadata
  pricing?: {
    input?: number;
    output?: number;
  };
  metadata?: Record<string, any>;
  active?: boolean;
  provider?: string;
}

export interface ModelServicePort {
  // Model information methods
  getAvailableModels(): Promise<ModelInfo[]>;

  // Core model interaction methods
  generateResponse(
    messages: Message[],
    systemPrompt: Prompt | Prompt[],
    tools?: Tool[],
    options?: ModelRequestOptions
  ): Promise<ModelResponse>;

  generateStreamingResponse(
    messages: Message[],
    systemPrompt: Prompt | Prompt[],
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
