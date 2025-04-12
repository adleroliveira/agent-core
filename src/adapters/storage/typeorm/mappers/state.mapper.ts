import { AgentState } from "@core/domain/agent-state.entity";
import { StateEntity } from "../entities/state.entity";
import { MessageMapper } from "./message.mapper";
import { AgentEntity } from "../entities/agent.entity";

export class StateMapper {
  static toDomain(entity: StateEntity, loadMessages: boolean = false): AgentState {

    const state = new AgentState({
      id: entity.id,
      memory: entity.memory,
      ttl: entity.ttl,
      agentId: entity.agent.id,
      conversationHistory: loadMessages && entity.messages ? entity.messages.map(MessageMapper.toDomain) : undefined
    });

    state.createdAt = entity.createdAt;
    state.updatedAt = entity.updatedAt;

    return state;
  }

  static toPersistence(domain: AgentState, agentId?: string): StateEntity {
    const entity = new StateEntity();
    entity.id = domain.id;
    entity.memory = domain.memory;
    entity.ttl = domain.ttl || 0;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    if (agentId) {
      const agentEntity = new AgentEntity();
      agentEntity.id = agentId;
      entity.agent = agentEntity;
    }

    return entity;
  }
}
