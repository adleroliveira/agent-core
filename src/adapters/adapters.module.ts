import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CoreModule } from "@core/core.module";
import { ConfigModule } from "@nestjs/config";

// Storage entities
import { AgentEntity } from "./storage/typeorm/entities/agent.entity";
import { StateEntity } from "./storage/typeorm/entities/state.entity";
import { MessageEntity } from "./storage/typeorm/entities/message.entity";
import { ToolEntity } from "./storage/typeorm/entities/tool.entity";
import { VectraAdapter } from "./vector-db/vectra.adapter";

// Storage repositories
import { TypeOrmAgentRepository } from "./storage/typeorm/typeorm-agent.repository";
import { TypeOrmStateRepository } from "./storage/typeorm/typeorm-state.repository";

// Model services
import { BedrockModelService } from "./model/bedrock/bedrock-model.service";
import { BedrockConfigService } from "./model/bedrock/bedrock-config.service";

// API interfaces
import { AgentController } from "./api/rest/agent.controller";
import { DirectAgentAdapter } from "./api/direct/direct-agent.adapter";

// Injection tokens
export const AGENT_REPOSITORY = "AGENT_REPOSITORY";
export const STATE_REPOSITORY = "STATE_REPOSITORY";
export const MODEL_SERVICE = "MODEL_SERVICE";
export const VECTOR_DB = "VECTOR_DB";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      StateEntity,
      MessageEntity,
      ToolEntity,
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
      provide: VECTOR_DB,
      useClass: VectraAdapter,
    },

    // Model providers
    BedrockConfigService,
    {
      provide: MODEL_SERVICE,
      useClass: BedrockModelService,
    },

    // Direct API adapter
    DirectAgentAdapter,
  ],
  exports: [
    AGENT_REPOSITORY,
    STATE_REPOSITORY,
    MODEL_SERVICE,
    VECTOR_DB,
    DirectAgentAdapter,
  ],
})
export class AdaptersModule {}
