import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from '@core/core.module';

// Storage entities
import { AgentEntity } from './storage/typeorm/entities/agent.entity';
import { StateEntity } from './storage/typeorm/entities/state.entity';
import { MessageEntity } from './storage/typeorm/entities/message.entity';
import { ToolEntity } from './storage/typeorm/entities/tool.entity';

// Storage repositories
import { TypeOrmAgentRepository } from './storage/typeorm/typeorm-agent.repository';
import { TypeOrmStateRepository } from './storage/typeorm/typeorm-state.repository';

// Model services
import { BedrockModelService } from './model/bedrock/bedrock-model.service';
import { BedrockConfigService } from './model/bedrock/bedrock-config.service';

// Tool services
import { ToolRegistryService } from './tool/tool-registry.service';

// API interfaces
import { AgentController } from './api/rest/agent.controller';
import { DirectAgentAdapter } from './api/direct/direct-agent.adapter';

// Ports
import { AgentRepositoryPort } from '@ports/storage/agent-repository.port';
import { StateRepositoryPort } from '@ports/storage/state-repository.port';
import { ModelServicePort } from '@ports/model/model-service.port';
import { ToolRegistryPort } from '@ports/tool/tool-registry.port';

// Injection tokens
export const AGENT_REPOSITORY = 'AGENT_REPOSITORY';
export const STATE_REPOSITORY = 'STATE_REPOSITORY';
export const MODEL_SERVICE = 'MODEL_SERVICE';
export const TOOL_REGISTRY = 'TOOL_REGISTRY';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      StateEntity,
      MessageEntity,
      ToolEntity,
    ]),
    forwardRef(() => CoreModule),
  ],
  controllers: [AgentController],
  providers: [
    // Storage providers
    {
      provide: AGENT_REPOSITORY,
      useClass: TypeOrmAgentRepository,
    },
    {
      provide: STATE_REPOSITORY,
      useClass: TypeOrmStateRepository,
    },
    
    // Model providers
    BedrockConfigService,
    {
      provide: MODEL_SERVICE,
      useClass: BedrockModelService,
    },
    
    // Tool providers
    {
      provide: TOOL_REGISTRY,
      useClass: ToolRegistryService,
    },
    
    // Direct API adapter
    DirectAgentAdapter,
  ],
  exports: [
    AGENT_REPOSITORY,
    STATE_REPOSITORY,
    MODEL_SERVICE,
    TOOL_REGISTRY,
    DirectAgentAdapter,
  ],
})
export class AdaptersModule {}