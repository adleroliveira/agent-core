export interface VectorDBPort {
  upsert(
    vectors: {
      id: string;
      embedding: number[];
      metadata?: Record<string, any>;
    }[]
  ): Promise<void>;
  query(
    embedding: number[],
    topK: number
  ): Promise<{ id: string; score: number; metadata?: Record<string, any> }[]>;
}
