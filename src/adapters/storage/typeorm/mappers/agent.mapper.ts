import { Agent } from '@core/domain/agent.entity';
import { Prompt } from '@core/domain/prompt.entity';
import { AgentEntity } from '../entities/agent.entity';
import { StateMapper } from './state.mapper';
import { ToolMapper } from './tool.mapper';
import { KnowledgeBaseMapper } from './knowledge-base.mapper';
import { WorkspaceConfig } from '@core/config/workspace.config';
import { ModelServicePort } from '@ports/model/model-service.port';
import { VectorDBPort } from '@ports/storage/vector-db.port';

export class AgentMapper {
  constructor(
    private readonly modelService: ModelServicePort,
    private readonly vectorDB: VectorDBPort
  ) {}

  toDomain(entity: AgentEntity): Agent {
    const workspaceConfig = new WorkspaceConfig();
    if (entity.workspaceConfig?.workspaceDir) {
      workspaceConfig.setWorkspacePath(entity.workspaceConfig.workspaceDir);
    }

    const agent = new Agent({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      modelId: entity.modelId,
      systemPrompt: new Prompt({
        id: entity.systemPrompt.id,
        content: entity.systemPrompt.content,
        type: entity.systemPrompt.type as 'system' | 'user',
        name: entity.systemPrompt.name,
        metadata: entity.systemPrompt.metadata,
      }),
      workspaceConfig,
    });

    if (entity.state) {
      agent.state = StateMapper.toDomain(entity.state);
    }

    if (entity.tools) {
      agent.tools = entity.tools.map(tool => ToolMapper.toDomain(tool));
    }

    if (entity.knowledgeBase) {
      agent.knowledgeBase = KnowledgeBaseMapper.toDomain(
        entity.knowledgeBase,
        this.modelService,
        this.vectorDB
      );
    }

    return agent;
  }

  toPersistence(domain: Agent): AgentEntity {
    const entity = new AgentEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.description = domain.description || '';
    entity.modelId = domain.modelId;
    entity.systemPrompt = {
      id: domain.systemPrompt.id,
      content: domain.systemPrompt.content,
      type: domain.systemPrompt.type,
      name: domain.systemPrompt.name,
      metadata: domain.systemPrompt.metadata,
      createdAt: domain.systemPrompt.createdAt,
      updatedAt: domain.systemPrompt.updatedAt,
    };
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    if (domain.state) {
      entity.state = StateMapper.toPersistence(domain.state, domain.id);
    }

    if (domain.tools) {
      entity.tools = domain.tools.map(tool => ToolMapper.toPersistence(tool, domain.id));
    }

    if (domain.knowledgeBase) {
      entity.knowledgeBase = KnowledgeBaseMapper.toPersistence(domain.knowledgeBase, domain.id);
    }

    return entity;
  }
}