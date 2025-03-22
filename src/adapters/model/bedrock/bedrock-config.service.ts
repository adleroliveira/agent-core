import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BedrockConfigService {
  constructor(private readonly configService: ConfigService) {}

  getRegion(): string {
    return this.configService.get<string>('AWS_REGION') || 'us-east-1';
  }

  getAccessKeyId(): string {
    return this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
  }

  getSecretAccessKey(): string {
    return this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';
  }

  getModelId(): string {
    return this.configService.get<string>('BEDROCK_MODEL_ID') || 'anthropic.claude-3-haiku-20240307-v1:0';
  }

  getEmbeddingModelId(): string {
    return this.configService.get<string>('BEDROCK_EMBEDDING_MODEL_ID') || 'amazon.titan-embed-text-v1';
  }

  getKnowledgeBaseId(): string | undefined {
    return this.configService.get<string>('BEDROCK_KNOWLEDGE_BASE_ID');
  }

  getAgentId(): string | undefined {
    return this.configService.get<string>('BEDROCK_AGENT_ID');
  }
}