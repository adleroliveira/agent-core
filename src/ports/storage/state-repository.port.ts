import { AgentState } from "@core/domain/agent-state.entity";

export interface StateRepositoryPort {
  findById(id: string, loadMessages?: boolean): Promise<AgentState | null>;
  findByAgentId(agentId: string, loadMessages?: boolean): Promise<AgentState[]>;
  save(state: AgentState): Promise<AgentState>;
  delete(id: string): Promise<boolean>;
  deleteByAgentId(agentId: string): Promise<void>;
  clearExpiredStates(): Promise<number>;
}
