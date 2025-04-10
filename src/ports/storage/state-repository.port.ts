import { AgentState } from "@core/domain/agent-state.entity";

export interface StateRepositoryPort {
  findById(id: string, loadMessages?: boolean): Promise<AgentState | null>;
  findByConversationId(conversationId: string, loadMessages?: boolean): Promise<AgentState | null>;
  findByAgentId(agentId: string, loadMessages?: boolean): Promise<AgentState | null>;
  findAllByAgentId(agentId: string, loadMessages?: boolean): Promise<AgentState[]>;
  save(state: AgentState): Promise<void>;
  delete(id: string): Promise<boolean>;
  deleteByAgentId(agentId: string): Promise<void>;
  clearExpiredStates(): Promise<number>;
  findByAgentIdAndConversationId(agentId: string, conversationId: string, loadMessages?: boolean): Promise<AgentState | null>;
}
