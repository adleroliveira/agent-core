import { AgentState } from "@core/domain/agent-state.entity";
import { StateEntity } from "../entities/state.entity";
import { MessageMapper } from "./message.mapper";
import { AgentEntity } from "../entities/agent.entity";

export class StateMapper {
  static toDomain(entity: StateEntity): AgentState {
    const state = new AgentState({
      id: entity.id,
      memory: entity.memory,
      ttl: entity.ttl,
      conversationId: entity.conversationId,
      agentId: entity.agent?.id || ''
    });

    if (entity.messages) {
      state.conversationHistory = entity.messages.map(MessageMapper.toDomain);
    }

    state.createdAt = entity.createdAt;
    state.updatedAt = entity.updatedAt;

    return state;
  }

  static toPersistence(domain: AgentState, agentId?: string): StateEntity {
    const entity = new StateEntity();
    entity.id = domain.id;
    entity.memory = domain.memory;
    entity.ttl = domain.ttl || 0;
    entity.conversationId = domain.conversationId;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    if (agentId) {
      const agentEntity = new AgentEntity();
      agentEntity.id = agentId;
      entity.agent = agentEntity;
    }

    if (domain.conversationHistory && domain.conversationHistory.length > 0) {
      entity.messages = domain.conversationHistory.map((message) =>
        MessageMapper.toPersistence(message, domain.id)
      );
    }

    return entity;
  }
}
