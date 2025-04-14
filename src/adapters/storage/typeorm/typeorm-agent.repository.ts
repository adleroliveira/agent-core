import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '@core/domain/agent.entity';
import { AgentRepositoryPort } from '@ports/storage/agent-repository.port';
import { AgentEntity } from './entities/agent.entity';
import { AgentMapper } from './mappers/agent.mapper';
import { KnowledgeBaseEntity } from './entities/knowledge-base.entity';
import { VectorDBPort } from '@ports/storage/vector-db.port';
import { ModelServicePort } from '@ports/model/model-service.port';
import { MODEL_SERVICE, VECTOR_DB } from '@core/injection-tokens';
import { TOOL_REGISTRY } from '@core/constants';
import { ToolRegistryPort } from '@ports/tool/tool-registry.port';
import { Logger } from '@nestjs/common';
import { StateEntity } from './entities/state.entity';
import { MessageEntity } from './entities/message.entity';
import { AgentToolEntity } from './entities/agent-tool.entity';
import { StateMapper } from './mappers/state.mapper';

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
    private readonly agentMapper: AgentMapper,
    private readonly stateMapper: StateMapper
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

    const domainAgents = await Promise.all(agentEntities.map(entity => this.agentMapper.toDomain(entity, loadRelations)));
    return domainAgents;
  }

  async save(agent: Agent): Promise<Agent> {
    // Use a transaction to ensure data consistency
    return this.agentRepository.manager.transaction(async (manager) => {
      try {
        // Convert domain to persistence
        const agentEntity = this.agentMapper.toPersistence(agent);
        
        // Create a new object without the agentTools property
        const { agentTools: _, ...agentEntityWithoutTools } = agentEntity;
        
        // Save the agent without the tools first
        const savedAgentEntity = await manager.save(AgentEntity, agentEntityWithoutTools);

        // If the agent has tools, save them
        if (agent.areToolsLoaded() && agent.tools) {
          // First, remove any existing agent tools
          await manager.delete(AgentToolEntity, { agentId: savedAgentEntity.id });
          
          // Then create new agent tools using the saved agent's ID
          const newAgentTools = agent.tools.map(tool => {
            if (!tool.id) {
              throw new Error('Tool ID is required to save agent tool relationship');
            }
            
            const agentTool = new AgentToolEntity();
            agentTool.agentId = savedAgentEntity.id;
            agentTool.toolId = tool.id;
            
            return agentTool;
          });
          
          await manager.save(AgentToolEntity, newAgentTools);
        }

        // Fetch the saved agent with its relationships
        const agentWithRelations = await manager.findOne(AgentEntity, {
          where: { id: savedAgentEntity.id },
          relations: ['states', 'agentTools', 'agentTools.tool', 'knowledgeBase']
        });

        if (!agentWithRelations) {
          throw new Error('Failed to load saved agent');
        }

        // Convert back to domain
        return await this.agentMapper.toDomain(agentWithRelations, true);
      } catch (error) {
        console.error('Error saving agent:', error);
        throw error;
      }
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