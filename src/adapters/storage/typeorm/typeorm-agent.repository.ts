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

@Injectable()
export class TypeOrmAgentRepository implements AgentRepositoryPort {
  private readonly agentMapper: AgentMapper;
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
    private readonly toolRegistry: ToolRegistryPort
  ) {
    this.agentMapper = new AgentMapper(modelService, vectorDB, toolRegistry);
    this.logger = new Logger(TypeOrmAgentRepository.name);
  }

  async findById(id: string): Promise<Agent | null> {
    const agentEntity = await this.agentRepository.findOne({
      where: { id },
      relations: ['states', 'tools', 'knowledgeBase'],
    });
    
    if (!agentEntity) {
      return null;
    }
    
    return await this.agentMapper.toDomain(agentEntity);
  }

  async findAll(): Promise<Agent[]> {
    const agentEntities = await this.agentRepository.find({
      relations: ['states', 'tools', 'knowledgeBase'],
    });
    
    return await Promise.all(agentEntities.map(entity => this.agentMapper.toDomain(entity)));
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
        tools: agentEntity.tools
      });

      // Get all existing states for this agent
      const existingStates = await manager.find(StateEntity, {
        where: { agent: { id: agent.id } },
        relations: ['messages']
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
      
      const savedAgentEntity = await manager.save(AgentEntity, agentToSave);
      
      // If there's a knowledge base, save it separately
      if (knowledgeBase) {
        // Create a new knowledge base entity
        const knowledgeBaseEntity = new KnowledgeBaseEntity();
        knowledgeBaseEntity.id = knowledgeBase.id;
        knowledgeBaseEntity.agentId = savedAgentEntity.id; // Set the agentId to the saved agent's ID
        knowledgeBaseEntity.name = knowledgeBase.name;
        knowledgeBaseEntity.description = knowledgeBase.description;
        knowledgeBaseEntity.createdAt = knowledgeBase.createdAt;
        knowledgeBaseEntity.updatedAt = knowledgeBase.updatedAt;
        
        try {
          // Use a completely different approach - create a new repository instance
          const knowledgeBaseRepo = manager.getRepository(KnowledgeBaseEntity);
          
          // Save the knowledge base using the new repository
          const savedKnowledgeBase = await knowledgeBaseRepo.save(knowledgeBaseEntity);

          // Update the agent's knowledge base reference
          savedAgentEntity.knowledgeBase = savedKnowledgeBase;
          await manager.save(AgentEntity, savedAgentEntity);
        } catch (error) {
          this.logger.error(`Error saving knowledge base: ${error.message}`);
          this.logger.error(`Error details: ${JSON.stringify(error)}`);
          throw error;
        }
      }
      
      // Reload the agent with all relations
      const reloadedAgent = await this.findById(savedAgentEntity.id);
      if (!reloadedAgent) {
        throw new Error('Failed to reload agent after save');
      }
      
      return reloadedAgent;
    });
  }

  async delete(id: string): Promise<boolean> {
    // Start a transaction
    await this.agentRepository.manager.transaction(async (manager) => {
      // 1. Find the agent with all its relations
      const agent = await manager.findOne(AgentEntity, {
        where: { id },
        relations: ['knowledgeBase', 'states', 'states.messages', 'tools'],
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

        // 3. Delete all states
        if (agent.states) {
          await manager.delete(StateEntity, { agentId: id });
        }

        // 4. Delete all tools
        if (agent.tools) {
          await manager.delete(ToolEntity, { agentId: id });
        }

        // 5. Handle knowledge base
        const knowledgeBase = agent.knowledgeBase;
        if (knowledgeBase) {
          // First, remove the reference from the agent to the knowledge base
          agent.knowledgeBase = null;
          await manager.save(AgentEntity, agent);

          // Then delete the vector index file
          await this.vectorDB.deleteKnowledgeBase(knowledgeBase.id);

          // Finally delete the knowledge base
          await manager.delete(KnowledgeBaseEntity, { id: knowledgeBase.id });
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