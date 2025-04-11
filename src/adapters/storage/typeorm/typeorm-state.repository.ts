import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentState } from "@core/domain/agent-state.entity";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import { StateEntity } from "./entities/state.entity";
import { StateMapper } from "./mappers/state.mapper";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { VECTOR_DB } from "@adapters/adapters.module";
import { Logger } from "@nestjs/common";
import { MessageService } from "@core/services/message.service";
import { AgentEntity } from "./entities/agent.entity";
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

  async findByConversationId(
    conversationId: string,
    loadMessages: boolean = false
  ): Promise<AgentState | null> {
    const stateEntity = await this.stateRepository.findOne({
      where: { conversationId },
      relations: ["agent"],
      order: { updatedAt: "DESC" },
    });

    if (!stateEntity) {
      return null;
    }

    const state = StateMapper.toDomain(stateEntity, loadMessages);
    
    if (loadMessages) {
      const { messages } = await this.messageService.getMessages(stateEntity.id);
      state.conversationHistory = messages;
    }
    
    return state;
  }

  async findByAgentId(agentId: string, loadMessages: boolean = false): Promise<AgentState | null> {
    const stateEntity = await this.stateRepository.findOne({
      where: { agent: { id: agentId } },
      relations: ["agent"],
      order: { updatedAt: "DESC" },
    });

    if (!stateEntity) {
      return null;
    }

    const state = StateMapper.toDomain(stateEntity, loadMessages);
    
    if (loadMessages) {
      const { messages } = await this.messageService.getMessages(stateEntity.id);
      state.conversationHistory = messages;
    }
    
    return state;
  }

  async findAllByAgentId(agentId: string, loadMessages: boolean = false): Promise<AgentState[]> {
    const states = await this.stateRepository.find({
      where: { agent: { id: agentId } },
      relations: ["agent"],
      order: { createdAt: "DESC" }
    });

    return Promise.all(states.map(async (state) => {
      const agentState = StateMapper.toDomain(state, loadMessages);
      
      if (loadMessages) {
        const { messages } = await this.messageService.getMessages(state.id);
        agentState.conversationHistory = messages;
      }
      
      return agentState;
    }));
  }

  async save(state: AgentState): Promise<void> {
    // Find existing state for this agent and conversation
    const existingState = await this.stateRepository.findOne({
      where: {
        agent: { id: state.agentId },
        conversationId: state.conversationId,
      },
      relations: ["agent"],
    });

    if (existingState) {
      // Update existing state
      await this.stateRepository.update(existingState.id, {
        memory: state.memory,
        ttl: state.ttl,
      });

      // Append new messages
      if (state.conversationHistory && state.conversationHistory.length > 0) {
        await this.messageService.appendMessages(state.conversationHistory);
      }
    } else {
      // Create new state
      const stateEntity = new StateEntity();
      stateEntity.id = state.id;
      stateEntity.conversationId = state.conversationId;
      stateEntity.memory = state.memory;
      stateEntity.ttl = state.ttl || 0;
      stateEntity.createdAt = state.createdAt;
      stateEntity.updatedAt = state.updatedAt;

      // Set up the agent relationship
      const agentEntity = new AgentEntity();
      agentEntity.id = state.agentId;
      stateEntity.agent = agentEntity;

      await this.stateRepository.save(stateEntity);

      // Create messages
      if (state.conversationHistory && state.conversationHistory.length > 0) {
        await this.messageService.appendMessages(state.conversationHistory);
      }
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.stateRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
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
      .select('id, "updatedAt", ttl')
      .getRawMany();

    const expiredStateIds = result
      .filter((state) => {
        if (!state.ttl) return false;
        const expirationTime = new Date(state.updatedAt);
        expirationTime.setSeconds(expirationTime.getSeconds() + state.ttl);
        return now > expirationTime;
      })
      .map((state) => state.id);

    if (expiredStateIds.length === 0) {
      return 0;
    }

    const deleteResult = await this.stateRepository.delete(expiredStateIds);
    return deleteResult.affected || 0;
  }

  async findByAgentIdAndConversationId(
    agentId: string,
    conversationId: string,
    loadMessages: boolean = false
  ): Promise<AgentState | null> {
    const state = await this.stateRepository.findOne({
      where: {
        agent: { id: agentId },
        conversationId,
      },
      relations: ["agent"],
      order: { updatedAt: "DESC" }
    });

    if (!state) return null;

    const agentState = StateMapper.toDomain(state, loadMessages);
    
    if (loadMessages) {
      const { messages } = await this.messageService.getMessages(state.id);
      agentState.conversationHistory = messages;
    }
    
    return agentState;
  }
}
