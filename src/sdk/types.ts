export interface SDKConfig {
  // AWS/Bedrock specific
  region?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  modelId?: string; // Default to a Claude model

  // Optional storage config
  storage?: {
    type: 'memory' | 'dynamodb';
    // Connection details for non-memory options
    [key: string]: any;
  };
}

export interface AgentOptions {
  name: string;
  description?: string;
  systemPrompt: string;
  tools?: string[]; // Names of registered tools to use
}

export interface StreamCallbacks {
  onChunk?: (content: string) => void;
  onToolCall?: (toolCall: any) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}