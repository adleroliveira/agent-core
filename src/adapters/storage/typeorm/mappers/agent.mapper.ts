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
import { AgentState } from "@core/domain/agent-state.entity";
import { Tool } from "@core/domain/tool.entity";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";

export class AgentMapper {
  private stateMapper: StateMapper;

  constructor(
    private readonly modelService: ModelServicePort,
    private readonly vectorDB: VectorDBPort,
    private readonly toolRegistry: ToolRegistryPort
  ) {
    this.stateMapper = new StateMapper();
  }

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
      tools: entity.tools.map(tool => ToolMapper.toDomain(tool)),
      workspaceConfig,
      knowledgeBase: entity.knowledgeBase ? KnowledgeBaseMapper.toDomain(entity.knowledgeBase) : undefined,
    });

    if (entity.states && entity.states.length > 0) {
      const mostRecentState = entity.states.reduce((prev, current) => {
        return prev.updatedAt > current.updatedAt ? prev : current;
      });
      const state = StateMapper.toDomain(mostRecentState);
      state.agentId = entity.id;
      agent.state = state;
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

    // Initialize services
    agent.setServices(
      this.modelService,
      this.vectorDB,
      this.toolRegistry,
      workspaceConfig
    );

    return agent;
  }

  toPersistence(agent: Agent): AgentEntity {
    const entity = new AgentEntity();
    entity.id = agent.id;
    entity.name = agent.name;
    entity.description = agent.description || '';
    entity.modelId = agent.modelId;
    entity.systemPrompt = {
      id: agent.systemPrompt.id,
      content: agent.systemPrompt.content,
      type: agent.systemPrompt.type,
      name: agent.systemPrompt.name,
      metadata: agent.systemPrompt.metadata,
      createdAt: agent.systemPrompt.createdAt,
      updatedAt: agent.systemPrompt.updatedAt,
    };
    entity.workspaceConfig = { workspaceDir: agent.workspaceConfig.getWorkspacePath() };
    entity.createdAt = agent.createdAt;
    entity.updatedAt = agent.updatedAt;

    if (agent.state) {
      const stateEntity = StateMapper.toPersistence(agent.state, agent.id);
      entity.states = [stateEntity];
    }

    if (agent.tools) {
      entity.tools = agent.tools.map(tool => ToolMapper.toPersistence(tool, agent.id));
    }

    if (agent.knowledgeBase) {
      entity.knowledgeBase = KnowledgeBaseMapper.toPersistence(agent.knowledgeBase, agent.id);
    }

    return entity;
  }
}