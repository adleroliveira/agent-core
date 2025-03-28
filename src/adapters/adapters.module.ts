import { Module, forwardRef, InjectionToken } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CoreModule } from "@core/core.module";
import { ConfigModule } from "@nestjs/config";
import { AgentService } from "@core/application/agent.service";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import { ProcessRepositoryPort } from "@ports/storage/process-repository.port";
import { ProcessManagerService } from "@core/application/process-manager.service";
import { WorkspaceConfig } from "@core/config/workspace.config";

// Storage entities
import { AgentEntity } from "./storage/typeorm/entities/agent.entity";
import { StateEntity } from "./storage/typeorm/entities/state.entity";
import { MessageEntity } from "./storage/typeorm/entities/message.entity";
import { ToolEntity } from "./storage/typeorm/entities/tool.entity";
import { KnowledgeBaseEntity } from "./storage/typeorm/entities/knowledge-base.entity";
import { ProcessEntity } from "./storage/typeorm/entities/process.entity";
import { VectraAdapter } from "./vector-db/vectra.adapter";

// Storage repositories
import { TypeOrmAgentRepository } from "./storage/typeorm/typeorm-agent.repository";
import { TypeOrmStateRepository } from "./storage/typeorm/typeorm-state.repository";
import { TypeOrmProcessRepository } from "./storage/typeorm/typeorm-process.repository";

// Model services
import { BedrockModelService } from "./model/bedrock/bedrock-model.service";
import { BedrockConfigService } from "./model/bedrock/bedrock-config.service";

// API interfaces
import { AgentController } from "./api/rest/agent.controller";
import { DirectAgentAdapter } from "./api/direct/direct-agent.adapter";

// Tools
import { ProcessTool } from "@tools/default/process.tool";

// Injection tokens
export const AGENT_REPOSITORY = "AGENT_REPOSITORY";
export const STATE_REPOSITORY = "STATE_REPOSITORY";
export const PROCESS_REPOSITORY = "PROCESS_REPOSITORY";
export const VECTOR_DB = "VECTOR_DB";
export const MODEL_SERVICE = "MODEL_SERVICE";
export const AGENT_SERVICE = "AGENT_SERVICE";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      StateEntity,
      MessageEntity,
      ToolEntity,
      KnowledgeBaseEntity,
      ProcessEntity,
    ]),
    forwardRef(() => CoreModule),
    ConfigModule,
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
    {
      provide: PROCESS_REPOSITORY,
      useClass: TypeOrmProcessRepository,
    },
    {
      provide: VECTOR_DB,
      useClass: VectraAdapter,
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

    // Direct API adapter
    {
      provide: DirectAgentAdapter,
      useFactory: (agentService: AgentService, stateRepository: StateRepositoryPort) => {
        return new DirectAgentAdapter(agentService, stateRepository);
      },
      inject: [AGENT_SERVICE, STATE_REPOSITORY],
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
  ],
})
export class AdaptersModule {}
