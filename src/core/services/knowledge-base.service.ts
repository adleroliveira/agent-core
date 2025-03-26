import { v4 as uuidv4 } from "uuid";
import { KnowledgeBaseEntry, KnowledgeBasePort, KnowledgeBaseConfig } from "@ports/knowledge-base/knowledge-base.port";

export class KnowledgeBaseService implements KnowledgeBasePort {
  private readonly modelService: KnowledgeBaseConfig["modelService"];
  private readonly vectorDB: KnowledgeBaseConfig["vectorDB"];

  constructor(config: KnowledgeBaseConfig) {
    this.modelService = config.modelService;
    this.vectorDB = config.vectorDB;
  }

  async addKnowledge(
    content: string,
    metadata?: Record<string, any>
  ): Promise<KnowledgeBaseEntry> {
    // Generate embedding for the content
    const embedding = await this.modelService.generateEmbedding(content);

    // Create knowledge base entry
    const entry: KnowledgeBaseEntry = {
      id: uuidv4(),
      content,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in vector database
    await this.vectorDB.upsert([
      {
        id: entry.id,
        embedding,
        metadata: {
          ...entry.metadata,
          content: entry.content,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        },
      },
    ]);

    return entry;
  }

  async searchKnowledge(
    query: string,
    topK: number = 5
  ): Promise<{ entry: KnowledgeBaseEntry; score: number }[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.modelService.generateEmbedding(query);

    // Search in vector database
    const results = await this.vectorDB.query(queryEmbedding, topK);

    // Transform results into KnowledgeBaseEntry format
    return results.map((result) => ({
      entry: {
        id: result.id,
        content: result.metadata?.content || "",
        metadata: {
          ...result.metadata,
          content: undefined,
          createdAt: undefined,
          updatedAt: undefined,
        },
        createdAt: new Date(result.metadata?.createdAt || ""),
        updatedAt: new Date(result.metadata?.updatedAt || ""),
      },
      score: result.score,
    }));
  }

  async deleteKnowledge(id: string): Promise<void> {
    // Note: This is a placeholder. The actual implementation would need to handle
    // the deletion in the vector database. You might need to add a delete method
    // to the VectorDBPort interface if it's not already there.
    throw new Error("Method not implemented.");
  }
} 