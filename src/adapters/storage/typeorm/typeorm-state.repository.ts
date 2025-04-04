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
import { Logger } from "@nestjs/common";
import { Message, MessageRole } from "@core/domain/message.entity";

@Injectable()
export class TypeOrmStateRepository implements StateRepositoryPort {
  private readonly logger = new Logger(TypeOrmStateRepository.name);

  constructor(
    @InjectRepository(StateEntity)
    private readonly stateRepository: Repository<StateEntity>,
    @Inject(forwardRef(() => VECTOR_DB))
    private readonly vectorDB: VectorDBPort,
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>
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

  async findAllByAgentId(agentId: string): Promise<AgentState[]> {
    const states = await this.stateRepository.find({
      where: { agentId },
      relations: ["messages"],
    });

    return states.map((state) => {
      const agentState = new AgentState({
        id: state.id,
        agentId: state.agentId,
        conversationId: state.conversationId,
        conversationHistory: state.messages.map((msg) => {
          const message = new Message({
            id: msg.id,
            role: msg.role as MessageRole,
            content: typeof msg.content === "string" ? msg.content : JSON.parse(msg.content),
            conversationId: msg.conversationId,
            metadata: msg.metadata ? JSON.parse(msg.metadata) : undefined,
            toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
            toolCallId: msg.toolCallId || undefined,
            toolName: msg.toolName || undefined,
            isStreaming: msg.isStreaming,
          });
          message.createdAt = msg.createdAt;
          return message;
        }),
        memory: state.memory,
        ttl: state.ttl,
      });

      return agentState;
    });
  }

  async save(state: AgentState): Promise<void> {
    // Find existing state for this agent and conversation
    const existingState = await this.stateRepository.findOne({
      where: {
        agentId: state.agentId,
        conversationId: state.conversationId,
      },
      relations: ["messages"],
    });

    if (existingState) {
      // Update existing state
      await this.stateRepository.update(existingState.id, {
        memory: state.memory,
        ttl: state.ttl,
      });

      // Update messages
      const messageEntities = state.conversationHistory.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        conversationId: state.conversationId,
        metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
        toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        toolCallId: msg.toolCallId || null,
        toolName: msg.toolName || null,
        isStreaming: msg.isStreaming,
        stateId: existingState.id,
        createdAt: msg.createdAt,
      }));

      // Delete existing messages
      await this.messageRepository.delete({ stateId: existingState.id });

      // Insert new messages
      await this.messageRepository.insert(messageEntities);
    } else {
      // Create new state
      const stateEntity = this.stateRepository.create({
        id: state.id,
        agentId: state.agentId,
        conversationId: state.conversationId,
        memory: state.memory,
        ttl: state.ttl,
      });

      await this.stateRepository.save(stateEntity);

      // Create messages
      const messageEntities = state.conversationHistory.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        conversationId: state.conversationId,
        metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
        toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        toolCallId: msg.toolCallId || null,
        toolName: msg.toolName || null,
        isStreaming: msg.isStreaming,
        stateId: state.id,
        createdAt: msg.createdAt,
      }));

      await this.messageRepository.insert(messageEntities);
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
        where: { agentId },
      });

      if (states.length > 0) {
        // 2. Delete all messages associated with these states
        for (const state of states) {
          await manager.delete(MessageEntity, { stateId: state.id });
        }

        // 3. Delete all states
        await manager.delete(StateEntity, { agentId });
      }

      // 4. Delete all tool associations for this agent
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

  async findByAgentIdAndConversationId(
    agentId: string,
    conversationId: string
  ): Promise<AgentState | null> {
    const state = await this.stateRepository.findOne({
      where: {
        agentId,
        conversationId,
      },
      relations: ["messages"],
    });

    if (!state) return null;

    const agentState = new AgentState({
      id: state.id,
      agentId: state.agentId,
      conversationHistory: state.messages.map((msg) => {
        const message = new Message({
          id: msg.id,
          role: msg.role as MessageRole,
          content: typeof msg.content === "string" ? msg.content : JSON.parse(msg.content),
          conversationId: msg.conversationId,
          metadata: msg.metadata ? JSON.parse(msg.metadata) : undefined,
          toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
          toolCallId: msg.toolCallId || undefined,
          toolName: msg.toolName || undefined,
          isStreaming: msg.isStreaming,
        });
        message.createdAt = msg.createdAt;
        return message;
      }),
      memory: state.memory,
      ttl: state.ttl,
    });

    return agentState;
  }
}
