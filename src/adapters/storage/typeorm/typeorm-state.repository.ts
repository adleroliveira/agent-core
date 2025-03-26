import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentState } from "@core/domain/agent-state.entity";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import { StateEntity } from "./entities/state.entity";
import { StateMapper } from "./mappers/state.mapper";
import { MessageEntity } from "./entities/message.entity";
import { ToolEntity } from "./entities/tool.entity";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { VECTOR_DB } from "@adapters/adapters.module";

@Injectable()
export class TypeOrmStateRepository implements StateRepositoryPort {
  constructor(
    @InjectRepository(StateEntity)
    private readonly stateRepository: Repository<StateEntity>,
    @Inject(forwardRef(() => VECTOR_DB))
    private readonly vectorDB: VectorDBPort
  ) {}

  async findById(id: string): Promise<AgentState | null> {
    const stateEntity = await this.stateRepository.findOne({
      where: { id },
      relations: ["messages"],
    });

    if (!stateEntity) {
      return null;
    }

    return StateMapper.toDomain(stateEntity);
  }

  async findByConversationId(
    conversationId: string
  ): Promise<AgentState | null> {
    const stateEntity = await this.stateRepository.findOne({
      where: { conversationId },
      relations: ["messages"],
      order: { updatedAt: "DESC" },
    });

    if (!stateEntity) {
      return null;
    }

    return StateMapper.toDomain(stateEntity);
  }

  async findByAgentId(agentId: string): Promise<AgentState | null> {
    const stateEntity = await this.stateRepository.findOne({
      where: { agentId },
      relations: ["messages"],
      order: { updatedAt: "DESC" },
    });

    if (!stateEntity) {
      return null;
    }

    return StateMapper.toDomain(stateEntity);
  }

  async save(state: AgentState, agentId: string): Promise<AgentState> {
    // First check if a state with this conversation ID already exists
    let existingStateEntity = null;

    if (state.conversationId) {
      existingStateEntity = await this.stateRepository.findOne({
        where: {
          agentId,
          conversationId: state.conversationId,
        },
      });
    }

    // If we found an existing state, update it
    if (existingStateEntity) {
      const stateToUpdate = StateMapper.toPersistence(state, agentId);
      // Ensure we keep the same ID
      stateToUpdate.id = existingStateEntity.id;
      const savedEntity = await this.stateRepository.save(stateToUpdate);
      return StateMapper.toDomain(savedEntity);
    }

    // Otherwise create a new state
    const stateEntity = StateMapper.toPersistence(state, agentId);
    const savedEntity = await this.stateRepository.save(stateEntity);
    return StateMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.stateRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    // Start a transaction
    await this.stateRepository.manager.transaction(async (manager) => {
      // 1. Find the state associated with this agent
      const state = await manager.findOne(StateEntity, {
        where: { agentId },
      });

      if (state) {
        // 2. Delete all messages associated with this state
        await manager.delete(MessageEntity, { stateId: state.id });

        // 3. Remove the reference from agent to state (to break circular dependency)
        await manager.query(`UPDATE agents SET stateId = NULL WHERE id = ?`, [
          agentId,
        ]);

        // 4. Now delete the state
        await manager.delete(StateEntity, { id: state.id });
      }

      // 5. Delete all tool associations for this agent
      await manager.delete(ToolEntity, { agentId });
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
}
