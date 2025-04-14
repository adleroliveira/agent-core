import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentState } from "@core/domain/agent-state.entity";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import { StateEntity } from "./entities/state.entity";
import { StateMapper } from "./mappers/state.mapper";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { VECTOR_DB } from "@core/injection-tokens";
import { Logger } from "@nestjs/common";
import { MessageService } from "@core/services/message.service";
import { MessageEntity } from "./entities/message.entity";
import { AgentToolEntity } from "./entities/agent-tool.entity";

@Injectable()
export class TypeOrmStateRepository implements StateRepositoryPort {
  private readonly logger = new Logger(TypeOrmStateRepository.name);

  constructor(
    @InjectRepository(StateEntity)
    private readonly stateRepository: Repository<StateEntity>,
    @Inject(forwardRef(() => VECTOR_DB))
    private readonly vectorDB: VectorDBPort,
    private readonly messageService: MessageService
  ) {}

  async findById(id: string, loadMessages: boolean = false): Promise<AgentState | null> {
    const stateEntity = await this.stateRepository.findOne({
      where: { id },
      relations: ["agent"],
    });

    if (!stateEntity) {
      return null;
    }

    const state = StateMapper.toDomain(stateEntity, loadMessages);
    
    if (loadMessages) {
      const { messages } = await this.messageService.getMessages(id);
      state.conversationHistory = messages;
    }
    
    return state;
  }

  async findByAgentId(agentId: string, loadMessages: boolean = false): Promise<AgentState[]> {
    const stateEntities = await this.stateRepository.find({
      where: { agent: { id: agentId } },
      relations: ["agent"],
      order: { updatedAt: "DESC" },
    });

    if (!stateEntities) {
      return [];
    }

    const states = stateEntities.map(async (stateEntity) => {
      const state = StateMapper.toDomain(stateEntity, loadMessages);
      
      if (loadMessages) {
        const { messages } = await this.messageService.getMessages(stateEntity.id);
        state.conversationHistory = messages;
      }
    
      return state;
    });

    return Promise.all(states);
  }

  async save(state: AgentState): Promise<AgentState> {
    return this.stateRepository.manager.transaction(async (manager) => {
      try {
        // Convert to persistence and save
        const stateEntity = StateMapper.toPersistence(state, state.agentId);
        const savedStateEntity = await manager.save(StateEntity, stateEntity);

        // Fetch the complete state with all relations
        const stateWithRelations = await manager.findOne(StateEntity, {
          where: { id: savedStateEntity.id },
          relations: ["agent", "messages"],
        });

        if (!stateWithRelations) {
          throw new Error('Failed to load saved state');
        }

        // Convert back to domain
        return StateMapper.toDomain(stateWithRelations, true);
      } catch (error) {
        console.error('Error saving state:', error);
        throw error;
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    // Start a transaction
    await this.stateRepository.manager.transaction(async (manager) => {
      // 1. Delete all messages associated with this state first
      await manager.delete(MessageEntity, { stateId: id });
      
      // 2. Delete the state
      await manager.delete(StateEntity, { id });
    });

    return true;
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    // Start a transaction
    await this.stateRepository.manager.transaction(async (manager) => {
      // 1. Find all states associated with this agent
      const states = await manager.find(StateEntity, {
        where: { agent: { id: agentId } }
      });

      if (states.length > 0) {
        // 2. Delete all messages for each state first
        for (const state of states) {
          await manager.delete(MessageEntity, { stateId: state.id });
        }

        // 3. Delete all states using the agent relationship
        await manager.delete(StateEntity, { agent: { id: agentId } });
      }

      // 4. Delete all tool associations for this agent using the agent relationship
      await manager.delete(AgentToolEntity, { agentId: agentId });
    });
  }

  async clearExpiredStates(): Promise<number> {
    const now = new Date();
    const result = await this.stateRepository
      .createQueryBuilder()
      .delete()
      .where("ttl > 0 AND updatedAt < :expiryDate", {
        expiryDate: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 24 hours ago
      })
      .execute();

    return result.affected || 0;
  }
}
