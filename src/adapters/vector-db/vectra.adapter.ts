import { LocalIndex } from "vectra";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class VectraAdapter implements VectorDBPort {
  private index: LocalIndex;

  constructor(private configService: ConfigService) {
    const dbPath = this.configService.get<string>("DATABASE_PATH") || "./data/";
    const vectraDir = path.join(dbPath, "vectra");
    this.index = new LocalIndex(vectraDir);
  }

  private async ensureIndexCreated(): Promise<void> {
    if (!(await this.index.isIndexCreated())) {
      await this.index.createIndex();
    }
  }

  async upsert(
    vectors: {
      id: string;
      embedding: number[];
      metadata?: Record<string, any>;
    }[]
  ): Promise<void> {
    await this.ensureIndexCreated();
    for (const { id, embedding, metadata } of vectors) {
      await this.index.insertItem({
        vector: embedding,
        metadata: { id, ...metadata }, // Store the string id in metadata
      });
    }
  }

  async query(
    embedding: number[],
    topK: number
  ): Promise<{ id: string; score: number; metadata?: Record<string, any> }[]> {
    await this.ensureIndexCreated();
    const results = await this.index.queryItems(embedding, topK);
    return results.map((result) => {
      const metadata = { ...result.item.metadata }; // Clone metadata
      const id = metadata.id as string; // Assert id as string (we control it in upsert)
      delete metadata.id; // Remove id from metadata to avoid duplication
      return {
        id, // Return the string id from metadata
        score: result.score,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined, // Only include metadata if non-empty
      };
    });
  }
}
