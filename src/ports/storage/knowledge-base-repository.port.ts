import { KnowledgeBase } from "@core/domain/knowledge-base.entity";

export interface KnowledgeBaseRepositoryPort {
  save(knowledgeBase: KnowledgeBase): Promise<KnowledgeBase>;
  findById(id: string): Promise<KnowledgeBase | null>;
  findByAgentId(agentId: string): Promise<KnowledgeBase | null>;
  delete(id: string): Promise<boolean>;
  deleteByAgentId(agentId: string): Promise<boolean>;
} 