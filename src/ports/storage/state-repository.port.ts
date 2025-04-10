import { AgentState } from "@core/domain/agent-state.entity";

export interface StateRepositoryPort {
  findById(id: string): Promise<AgentState | null>;
  findByConversationId(conversationId: string): Promise<AgentState | null>;
  findByAgentId(agentId: string): Promise<AgentState | null>;
  findAllByAgentId(agentId: string): Promise<AgentState[]>;
  save(state: AgentState): Promise<void>;
  delete(id: string): Promise<boolean>;
  deleteByAgentId(agentId: string): Promise<void>;
  clearExpiredStates(): Promise<number>;
  findByAgentIdAndConversationId(agentId: string, conversationId: string): Promise<AgentState | null>;
}
