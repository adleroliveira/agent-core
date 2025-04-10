import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '@core/domain/agent.entity';
import { AgentRepositoryPort } from '@ports/storage/agent-repository.port';
import { AgentEntity } from './entities/agent.entity';
import { AgentMapper } from './mappers/agent.mapper';
import { KnowledgeBaseEntity } from './entities/knowledge-base.entity';
import { VectorDBPort } from '@ports/storage/vector-db.port';
import { VECTOR_DB } from '@adapters/adapters.module';
import { ModelServicePort } from '@ports/model/model-service.port';
import { MODEL_SERVICE } from '@adapters/adapters.module';
import { TOOL_REGISTRY } from '@core/constants';
import { ToolRegistryPort } from '@ports/tool/tool-registry.port';
import { Logger } from '@nestjs/common';
import { StateEntity } from './entities/state.entity';
import { MessageEntity } from './entities/message.entity';
import { ToolEntity } from './entities/tool.entity';
import { AgentToolEntity } from './entities/agent-tool.entity';
import { ToolMapper } from './mappers/tool.mapper';

@Injectable()
export class TypeOrmAgentRepository implements AgentRepositoryPort {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(KnowledgeBaseEntity)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBaseEntity>,
    @Inject(forwardRef(() => VECTOR_DB))
    private readonly vectorDB: VectorDBPort,
    @Inject(forwardRef(() => MODEL_SERVICE))
    private readonly modelService: ModelServicePort,
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryPort,
    private readonly agentMapper: AgentMapper
  ) {
    this.logger = new Logger(TypeOrmAgentRepository.name);
  }

  async findById(id: string, loadRelations: boolean = false): Promise<Agent | null> {
    const agentEntity = await this.agentRepository.findOne({
      where: { id },
      relations: loadRelations ? ['states', 'agentTools', 'agentTools.tool', 'knowledgeBase'] : [],
    });
    
    if (!agentEntity) {
      return null;
    }
    
    return await this.agentMapper.toDomain(agentEntity, loadRelations);
  }

  async findAll(loadRelations: boolean = false): Promise<Agent[]> {
    const agentEntities = await this.agentRepository.find({
      relations: loadRelations ? ['states', 'agentTools', 'agentTools.tool', 'knowledgeBase'] : [],
    });
    
    return await Promise.all(agentEntities.map(entity => this.agentMapper.toDomain(entity, loadRelations)));
  }

  async save(agent: Agent): Promise<Agent> {
    // Use a transaction to ensure data consistency
    return this.agentRepository.manager.transaction(async (manager) => {
      // First, save the agent without the knowledge base
      const agentEntity = this.agentMapper.toPersistence(agent);
      const knowledgeBase = agentEntity.knowledgeBase;
      
      // Create a new agent entity without the knowledge base relationship
      const agentToSave = new AgentEntity();
      Object.assign(agentToSave, {
        id: agentEntity.id,
        name: agentEntity.name,
        description: agentEntity.description,
        modelId: agentEntity.modelId,
        systemPrompt: agentEntity.systemPrompt,
        workspaceConfig: agentEntity.workspaceConfig,
        createdAt: agentEntity.createdAt,
        updatedAt: agentEntity.updatedAt,
      });

      // Get all existing states for this agent
      const existingStates = await manager.find(StateEntity, {
        where: { agent: { id: agent.id } }
      });

      // Initialize states array with existing states
      agentToSave.states = existingStates;

      // Add the current state if it's not already in the list
      if (agent.state) {
        const currentStateExists = existingStates.some(state => state.id === agent.state.id);
        if (!currentStateExists) {
          const stateEntity = new StateEntity();
          stateEntity.id = agent.state.id;
          stateEntity.conversationId = agent.state.conversationId;
          stateEntity.memory = agent.state.memory;
          stateEntity.ttl = agent.state.ttl || 0;
          stateEntity.createdAt = agent.state.createdAt;
          stateEntity.updatedAt = agent.state.updatedAt;
          stateEntity.agent = agentToSave;
          agentToSave.states.push(stateEntity);
        }
      }
      
      // Save the agent first to get its ID
      const savedAgentEntity = await manager.save(AgentEntity, agentToSave);

      // If tools are loaded, save them
      if (agent.areToolsLoaded() && agent.tools) {
        // First, delete existing agent-tool relationships
        await manager.delete(AgentToolEntity, { agentId: savedAgentEntity.id });

        // Then create new relationships for each tool
        for (const tool of agent.tools) {
          // Create the agent-tool relationship
          const agentTool = new AgentToolEntity();
          agentTool.agentId = savedAgentEntity.id;
          agentTool.toolId = tool.id;
          await manager.save(AgentToolEntity, agentTool);
        }
      }

      // If knowledge base exists and is loaded, save it
      if (agent.isKnowledgeBaseLoaded() && knowledgeBase) {
        knowledgeBase.agentId = savedAgentEntity.id;
        await manager.save(KnowledgeBaseEntity, knowledgeBase);
      }

      return this.agentMapper.toDomain(savedAgentEntity, true);
    });
  }

  async delete(id: string): Promise<boolean> {
    // Start a transaction
    await this.agentRepository.manager.transaction(async (manager) => {
      // 1. Find the agent with all its relations
      const agent = await manager.findOne(AgentEntity, {
        where: { id },
        relations: ['knowledgeBase', 'states', 'states.messages', 'agentTools'],
      });

      if (agent) {
        // 2. Delete all messages first (they reference states)
        if (agent.states) {
          for (const state of agent.states) {
            if (state.messages) {
              await manager.delete(MessageEntity, { stateId: state.id });
            }
          }
        }

        // 3. Delete all states using the agent relationship
        if (agent.states) {
          await manager.delete(StateEntity, { agent: { id } });
        }

        // 4. Delete all agent-tool relationships
        if (agent.agentTools) {
          await manager.delete(AgentToolEntity, { agentId: id });
        }

        // 5. Handle knowledge base
        if (agent.knowledgeBase) {
          // Delete the vector index file first
          await this.vectorDB.deleteKnowledgeBase(agent.knowledgeBase.id);
          
          // Then delete the knowledge base entity
          await manager.delete(KnowledgeBaseEntity, { id: agent.knowledgeBase.id });
        }

        // 6. Finally delete the agent
        await manager.delete(AgentEntity, { id });
      }
    });

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.agentRepository.count({
      where: { id },
    });
    return count > 0;
  }
}