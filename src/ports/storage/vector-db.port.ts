export interface VectorDBPort {
  upsert(
    vectors: {
      id: string;
      embedding: number[];
      metadata?: Record<string, any>;
      knowledgeBaseId: string;
    }[]
  ): Promise<void>;
  query(
    embedding: number[],
    topK: number,
    knowledgeBaseId: string
  ): Promise<{ id: string; score: number; metadata?: Record<string, any> }[]>;
  deleteKnowledgeBase(knowledgeBaseId: string): Promise<void>;
}
