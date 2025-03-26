import { ModelServicePort } from "../model/model-service.port";
import { VectorDBPort } from "../storage/vector-db.port";

export interface KnowledgeBaseEntry {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBasePort {
  addKnowledge(
    content: string,
    metadata?: Record<string, any>
  ): Promise<KnowledgeBaseEntry>;

  searchKnowledge(
    query: string,
    topK?: number
  ): Promise<{ entry: KnowledgeBaseEntry; score: number }[]>;

  deleteKnowledge(id: string): Promise<void>;
}

export interface KnowledgeBaseConfig {
  modelService: ModelServicePort;
  vectorDB: VectorDBPort;
} 