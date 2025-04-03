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
import { Logger } from '@nestjs/common';

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
  ) {
    this.agentMapper = new AgentMapper(modelService, vectorDB);
    this.logger = new Logger(TypeOrmAgentRepository.name);
  }

  async findById(id: string): Promise<Agent | null> {
    const agentEntity = await this.agentRepository.findOne({
      where: { id },
      relations: ['state', 'tools', 'knowledgeBase'],
    });
    
    if (!agentEntity) {
      return null;
    }
    
    return this.agentMapper.toDomain(agentEntity);
  }

  async findAll(): Promise<Agent[]> {
    const agentEntities = await this.agentRepository.find({
      relations: ['state', 'tools', 'knowledgeBase'],
    });
    
    return agentEntities.map(entity => this.agentMapper.toDomain(entity));
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
        state: agentEntity.state,
        tools: agentEntity.tools
      });
      
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
      // 1. Find the agent with its knowledge base
      const agent = await manager.findOne(AgentEntity, {
        where: { id },
        relations: ['knowledgeBase'],
      });

      if (agent) {
        // 2. Delete the knowledge base if it exists
        if (agent.knowledgeBase) {
          // Delete the vector index file
          await this.vectorDB.deleteKnowledgeBase(agent.knowledgeBase.id);
          // Delete the database reference
          await manager.delete(KnowledgeBaseEntity, { id: agent.knowledgeBase.id });
        }

        // 3. Now delete the agent
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