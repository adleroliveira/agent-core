import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CoreModule } from "@core/core.module";
import { ConfigModule } from "@nestjs/config";
import { AgentService } from "@core/application/agent.service";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { AgentMapper } from "./storage/typeorm/mappers/agent.mapper";
import { TypeOrmMessageRepository } from './storage/typeorm/typeorm-message.repository';
import { ModelServicePort } from '@ports/model/model-service.port';
import { VectorDBPort } from '@ports/storage/vector-db.port';
import { ToolRegistryPort, TOOL_REGISTRY } from '@ports/tool/tool-registry.port';
import { ToolMapper } from './storage/typeorm/mappers/tool.mapper';
import { TypeOrmToolRegistryService } from './storage/typeorm/typeorm-tool-registry.service';
import { StateMapper } from './storage/typeorm/mappers/state.mapper';

// Storage entities
import { AgentEntity } from "./storage/typeorm/entities/agent.entity";
import { StateEntity } from "./storage/typeorm/entities/state.entity";
import { MessageEntity } from "./storage/typeorm/entities/message.entity";
import { ToolEntity } from "./storage/typeorm/entities/tool.entity";
import { KnowledgeBaseEntity } from "./storage/typeorm/entities/knowledge-base.entity";
import { ProcessEntity } from "./storage/typeorm/entities/process.entity";
import { VectraAdapter } from "./vector-db/vectra.adapter";
import { AgentToolEntity } from "./storage/typeorm/entities/agent-tool.entity";

// Storage repositories
import { TypeOrmAgentRepository } from "./storage/typeorm/typeorm-agent.repository";
import { TypeOrmStateRepository } from "./storage/typeorm/typeorm-state.repository";
import { TypeOrmProcessRepository } from "./storage/typeorm/typeorm-process.repository";
import { TypeOrmKnowledgeBaseRepository } from "./storage/typeorm/typeorm-knowledge-base.repository";

// Model services
import { BedrockModelService } from "./model/bedrock/bedrock-model.service";
import { BedrockConfigService } from "./model/bedrock/bedrock-config.service";

// API interfaces
import { AgentController } from "./api/rest/agent.controller";
import { ToolsController } from "./api/rest/tools.controller";
import { DirectAgentAdapter } from "./api/direct/direct-agent.adapter";

// Tools
import { ProcessTool } from "@tools/default/process.tool";

// Injection tokens
export const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');
export const STATE_REPOSITORY = Symbol('STATE_REPOSITORY');
export const PROCESS_REPOSITORY = "PROCESS_REPOSITORY";
export const MODEL_SERVICE = Symbol('MODEL_SERVICE');
export const VECTOR_DB = Symbol('VECTOR_DB');
export const AGENT_SERVICE = "AGENT_SERVICE";
export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
export const KNOWLEDGE_BASE_REPOSITORY = Symbol('KNOWLEDGE_BASE_REPOSITORY');

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      StateEntity,
      MessageEntity,
      ToolEntity,
      KnowledgeBaseEntity,
      ProcessEntity,
      AgentToolEntity,
    ]),
    forwardRef(() => CoreModule),
    ConfigModule,
  ],
  controllers: [AgentController, ToolsController],
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
    {
      provide: PROCESS_REPOSITORY,
      useClass: TypeOrmProcessRepository,
    },
    {
      provide: VECTOR_DB,
      useClass: VectraAdapter,
    },
    {
      provide: MESSAGE_REPOSITORY,
      useClass: TypeOrmMessageRepository,
    },
    {
      provide: KNOWLEDGE_BASE_REPOSITORY,
      useClass: TypeOrmKnowledgeBaseRepository,
    },

    // Model providers
    BedrockConfigService,
    {
      provide: MODEL_SERVICE,
      useClass: BedrockModelService,
    },

    // Process management
    ProcessTool,
    WorkspaceConfig,

    // Mappers
    ToolMapper,
    StateMapper,
    {
      provide: AgentMapper,
      useFactory: (
        modelService: ModelServicePort,
        vectorDB: VectorDBPort,
        toolRegistry: ToolRegistryPort,
        toolMapper: ToolMapper
      ) => {
        return new AgentMapper(modelService, vectorDB, toolRegistry, toolMapper);
      },
      inject: [MODEL_SERVICE, VECTOR_DB, TOOL_REGISTRY, ToolMapper],
    },

    // Direct API adapter
    {
      provide: DirectAgentAdapter,
      useFactory: (agentService: AgentService, stateRepository: StateRepositoryPort) => {
        return new DirectAgentAdapter(agentService, stateRepository);
      },
      inject: [AGENT_SERVICE, STATE_REPOSITORY],
    },

    {
      provide: TOOL_REGISTRY,
      useClass: TypeOrmToolRegistryService,
    },
  ],
  exports: [
    AGENT_REPOSITORY,
    STATE_REPOSITORY,
    PROCESS_REPOSITORY,
    MODEL_SERVICE,
    VECTOR_DB,
    DirectAgentAdapter,
    ProcessTool,
    AgentMapper,
    MESSAGE_REPOSITORY,
    KNOWLEDGE_BASE_REPOSITORY,
    ToolMapper,
    TOOL_REGISTRY,
  ],
})
export class AdaptersModule {}
