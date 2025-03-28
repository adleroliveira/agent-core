import { Agent } from '@core/domain/agent.entity';
import { Prompt } from '@core/domain/prompt.entity';
import { AgentEntity } from '../entities/agent.entity';
import { StateMapper } from './state.mapper';
import { ToolMapper } from './tool.mapper';
import { KnowledgeBaseMapper } from './knowledge-base.mapper';
import { InternetSearchTool } from "@tools/default/internet-search.tool";
import { Inject } from "@nestjs/common";

export class AgentMapper {
  constructor(
    @Inject(InternetSearchTool)
    private readonly internetSearchTool: InternetSearchTool
  ) {}

  toDomain(entity: AgentEntity): Agent {
    const agent = new Agent(this.internetSearchTool, {
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
      tools: entity.tools ? entity.tools.map(ToolMapper.toDomain) : [],
      knowledgeBase: entity.knowledgeBase ? KnowledgeBaseMapper.toDomain(entity.knowledgeBase) : undefined,
    });

    if (entity.state) {
      agent.state = StateMapper.toDomain(entity.state);
    }

    agent.createdAt = entity.createdAt;
    agent.updatedAt = entity.updatedAt;

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