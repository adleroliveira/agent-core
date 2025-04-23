import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CoreModule } from "@core/core.module";
import { ConfigModule } from "@nestjs/config";
import { AgentService } from "@core/services/agent.service";
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
import { MimeTypeService } from '@core/services/mime-type.service';
import { McpClientService } from '@core/services/mcp-client.service';
import {
  AGENT_REPOSITORY,
  STATE_REPOSITORY,
  PROCESS_REPOSITORY,
  MODEL_SERVICE,
  VECTOR_DB,
  AGENT_SERVICE,
  MESSAGE_REPOSITORY,
  KNOWLEDGE_BASE_REPOSITORY,
  MCP_CLIENT,
  MCP_SERVER_REPOSITORY,
} from '@core/injection-tokens';

// Storage entities
import { AgentEntity } from "./storage/typeorm/entities/agent.entity";
import { StateEntity } from "./storage/typeorm/entities/state.entity";
import { MessageEntity } from "./storage/typeorm/entities/message.entity";
import { ToolEntity } from "./storage/typeorm/entities/tool.entity";
import { KnowledgeBaseEntity } from "./storage/typeorm/entities/knowledge-base.entity";
import { ProcessEntity } from "./storage/typeorm/entities/process.entity";
import { VectraAdapter } from "./vector-db/vectra.adapter";
import { AgentToolEntity } from "./storage/typeorm/entities/agent-tool.entity";
import { MCPServerEntity } from "./storage/typeorm/entities/mcp-server.entity";
import { MCPToolEntity } from './storage/typeorm/entities/mcp-tool.entity';

// Storage repositories
import { TypeOrmAgentRepository } from "./storage/typeorm/typeorm-agent.repository";
import { TypeOrmStateRepository } from "./storage/typeorm/typeorm-state.repository";
import { TypeOrmProcessRepository } from "./storage/typeorm/typeorm-process.repository";
import { TypeOrmMCPServerRepository } from "./storage/typeorm/typeorm-mcp-server.repository";
import { TypeOrmKnowledgeBaseRepository } from "./storage/typeorm/typeorm-knowledge-base.repository";
import { MCPToolRepository } from './storage/typeorm/typeorm-mcp-tool.repository';

// Model services
import { BedrockModelService } from "./model/bedrock/bedrock-model.service";
import { BedrockConfigService } from "./model/bedrock/bedrock-config.service";

// API interfaces
import { AgentController } from "./api/rest/agent.controller";
import { ModelsController } from "./api/rest/models.controller";
import { MCPServerController } from "./api/rest/mcp-server.controller";
import { DirectAgentAdapter } from "./api/direct/direct-agent.adapter";
import { FileUploadController, BusboyFileUploadService } from "./api/rest/file-upload.controller";

// Tools
import { ProcessTool } from "@tools/default/process.tool";
import { McpClientServicePort } from "@ports/mcp/mcp-client-service.port";
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
      MCPServerEntity,
      MCPToolEntity,
    ]),
    forwardRef(() => CoreModule),
    ConfigModule,
  ],
  controllers: [AgentController, ModelsController, FileUploadController, MCPServerController],
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
      provide: MCP_SERVER_REPOSITORY,
      useClass: TypeOrmMCPServerRepository,
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
    {
      provide: MCP_CLIENT,
      useClass: McpClientService,
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

    // File upload service
    BusboyFileUploadService,
    MimeTypeService,

    // Mappers
    ToolMapper,
    StateMapper,
    {
      provide: AgentMapper,
      useFactory: (
        modelService: ModelServicePort,
        vectorDB: VectorDBPort,
        mcpClientService: McpClientServicePort,
        stateRepository: StateRepositoryPort
      ) => {
        return new AgentMapper(modelService, vectorDB, mcpClientService, stateRepository);
      },
      inject: [MODEL_SERVICE, VECTOR_DB, McpClientService, STATE_REPOSITORY],
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

    // MCP repositories
    MCPToolRepository,
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
    MCP_CLIENT,
    MCP_SERVER_REPOSITORY,
    MCPToolRepository,
  ],
})
export class AdaptersModule { }
