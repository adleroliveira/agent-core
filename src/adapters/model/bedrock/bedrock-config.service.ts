import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BedrockConfigService {
  // List of models that are known to support tool calling
  private readonly modelsWithToolCalling = new Set([
    "cohere.command-r-v1:0",
    "cohere.command-r-plus-v1:0",
    "ai21.jamba-1-5-large-v1:0",
    "ai21.jamba-1-5-mini-v1:0",
    "amazon.nova-micro-v1:0",
    "amazon.nova-lite-v1:0",
    "amazon.nova-pro-v1:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-7-sonnet-20250219-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-3-opus-20240229-v1:0",
    "anthropic.claude-v2:1",
    "anthropic.claude-v2",
    "anthropic.claude-v1",
  ]);

  constructor(private readonly configService: ConfigService) {}

  getRegion(): string {
    return this.configService.get<string>("AWS_REGION") || "us-east-1";
  }

  getAccessKeyId(): string {
    return this.configService.get<string>("AWS_ACCESS_KEY_ID") || "";
  }

  getSecretAccessKey(): string {
    return this.configService.get<string>("AWS_SECRET_ACCESS_KEY") || "";
  }

  getModelId(): string {
    return (
      this.configService.get<string>("BEDROCK_MODEL_ID") ||
      "anthropic.claude-3-haiku-20240307-v1:0"
    );
  }

  getEmbeddingModelId(): string {
    return (
      this.configService.get<string>("BEDROCK_EMBEDDING_MODEL_ID") ||
      "amazon.titan-embed-text-v2:0"
    );
  }

  getKnowledgeBaseId(): string | undefined {
    return this.configService.get<string>("BEDROCK_KNOWLEDGE_BASE_ID");
  }

  getAgentId(): string | undefined {
    return this.configService.get<string>("BEDROCK_AGENT_ID");
  }

  supportsToolCalling(modelId?: string): boolean {
    const targetModelId = modelId || this.getModelId();
    return Array.from(this.modelsWithToolCalling).some(model => 
      targetModelId.includes(model)
    );
  }
}
