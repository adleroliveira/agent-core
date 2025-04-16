import { Agent } from '@core/domain/agent.entity';
import { Prompt } from '@core/domain/prompt.entity';
import { AgentEntity } from '../entities/agent.entity';
import { StateMapper } from './state.mapper';
import { ToolMapper } from './tool.mapper';
import { KnowledgeBaseMapper } from './knowledge-base.mapper';
import { WorkspaceConfig } from '@core/config/workspace.config';
import { ModelServicePort } from '@ports/model/model-service.port';
import { VectorDBPort } from '@ports/storage/vector-db.port';
import { ToolRegistryPort } from '@ports/tool/tool-registry.port';
import { Injectable } from '@nestjs/common';
import { AgentToolEntity } from '../entities/agent-tool.entity';

@Injectable()
export class AgentMapper {
  constructor(
    private readonly modelService: ModelServicePort,
    private readonly vectorDB: VectorDBPort,
    private readonly toolRegistry: ToolRegistryPort,
    private readonly toolMapper: ToolMapper
  ) {}

  async toDomain(entity: AgentEntity, loadRelations: boolean = false): Promise<Agent> {
    const states = loadRelations && entity.states
      ? await Promise.all(entity.states.map(state => {
        state.agent = entity;
        return StateMapper.toDomain(state, true)
      }))
      : [];

    const tools = loadRelations && entity.agentTools
      ? await Promise.all(entity.agentTools
          .filter(agentTool => agentTool.tool) // Only map tools that exist
          .map(agentTool => this.toolMapper.toDomain(agentTool.tool))
      )
      : [];

    const knowledgeBase = loadRelations && entity.knowledgeBase
      ? KnowledgeBaseMapper.toDomain(entity.knowledgeBase, this.modelService, this.vectorDB)
      : undefined;

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
      tools,
      knowledgeBase,
      states,
      inputTokens: entity.inputTokens,
      outputTokens: entity.outputTokens
    });

    // Set services after creating the agent
    if (this.modelService && this.vectorDB) {
      await agent.setServices(this.modelService, this.vectorDB, workspaceConfig);
    }

    return agent;
  }

  toPersistence(domain: Agent): AgentEntity {
    const entity = new AgentEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.description = domain.description;
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
    entity.workspaceConfig = { workspaceDir: domain.workspaceConfig.getWorkspacePath() };
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.inputTokens = domain.inputTokens;
    entity.outputTokens = domain.outputTokens;

    // Handle states
    if (domain.states) {
      entity.states = domain.states.map(state => StateMapper.toPersistence(state, domain.id));
    }

    // Handle knowledge base
    if (domain.isKnowledgeBaseLoaded() && domain.knowledgeBase) {
      entity.knowledgeBase = KnowledgeBaseMapper.toPersistence(domain.knowledgeBase, domain.id);
    }

    // Handle tools
    if (domain.areToolsLoaded() && domain.tools) {
      entity.agentTools = domain.tools.map(tool => {
        const agentTool = new AgentToolEntity();
        agentTool.agentId = domain.id;
        agentTool.toolId = tool.id;
        return agentTool;
      });
    }

    return entity;
  }
}