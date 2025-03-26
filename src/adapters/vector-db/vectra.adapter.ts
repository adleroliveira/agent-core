import { LocalIndex } from "vectra";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class VectraAdapter implements VectorDBPort {
  private indices: Map<string, LocalIndex> = new Map();

  constructor(private configService: ConfigService) {}

  private getIndexPath(knowledgeBaseId: string): string {
    const dbPath = this.configService.get<string>("DATABASE_PATH") || "./data/";
    return path.join(dbPath, "vectra", knowledgeBaseId);
  }

  private async getOrCreateIndex(knowledgeBaseId: string): Promise<LocalIndex> {
    if (!this.indices.has(knowledgeBaseId)) {
      const indexPath = this.getIndexPath(knowledgeBaseId);
      const index = new LocalIndex(indexPath);
      if (!(await index.isIndexCreated())) {
        await index.createIndex();
      }
      this.indices.set(knowledgeBaseId, index);
    }
    return this.indices.get(knowledgeBaseId)!;
  }

  async upsert(
    vectors: {
      id: string;
      embedding: number[];
      metadata?: Record<string, any>;
      knowledgeBaseId: string;
    }[]
  ): Promise<void> {
    const vectorsByKnowledgeBase = vectors.reduce((acc, vector) => {
      if (!acc[vector.knowledgeBaseId]) {
        acc[vector.knowledgeBaseId] = [];
      }
      acc[vector.knowledgeBaseId].push(vector);
      return acc;
    }, {} as Record<string, typeof vectors>);

    for (const [knowledgeBaseId, knowledgeBaseVectors] of Object.entries(
      vectorsByKnowledgeBase
    )) {
      const index = await this.getOrCreateIndex(knowledgeBaseId);
      for (const { id, embedding, metadata } of knowledgeBaseVectors) {
        await index.insertItem({
          vector: embedding,
          metadata: { id, ...metadata },
        });
      }
    }
  }

  async query(
    embedding: number[],
    topK: number,
    knowledgeBaseId: string
  ): Promise<{ id: string; score: number; metadata?: Record<string, any> }[]> {
    const index = await this.getOrCreateIndex(knowledgeBaseId);
    const results = await index.queryItems(embedding, topK);
    return results.map((result) => {
      const metadata = { ...result.item.metadata };
      const id = metadata.id as string;
      delete metadata.id;
      return {
        id,
        score: result.score,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    });
  }

  async deleteKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    // Remove the index from memory if it exists
    if (this.indices.has(knowledgeBaseId)) {
      const index = this.indices.get(knowledgeBaseId)!;
      await index.deleteIndex();
      this.indices.delete(knowledgeBaseId);
    }
  }
}
