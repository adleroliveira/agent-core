import { AgentState } from "@core/domain/agent-state.entity";
import { Message } from "@core/domain/message.entity";

export interface StateRepositoryPort {
  save(state: AgentState): Promise<void>;
  findByAgentId(agentId: string): Promise<AgentState | null>;
  findByConversationId(conversationId: string): Promise<AgentState | null>;
  findByAgentIdAndConversationId(agentId: string, conversationId: string): Promise<AgentState | null>;
  deleteByAgentId(agentId: string): Promise<void>;
  findAllByAgentId(agentId: string): Promise<AgentState[]>;
  clearExpiredStates(): Promise<number>;
  
  // New method for paginated message retrieval
  getConversationMessages(
    agentId: string,
    conversationId: string,
    options: {
      limit?: number;
      beforeTimestamp?: Date;
    }
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
  }>;
}
