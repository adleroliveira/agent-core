import { v4 as uuidv4 } from "uuid";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { KnowledgeBaseService } from "../services/knowledge-base.service";
import { ModelServicePort } from "@ports/model/model-service.port";

export class KnowledgeBase {
  public readonly id: string;
  public agentId: string;
  public name: string;
  public description?: string;
  public createdAt: Date;
  public updatedAt: Date;
  private service?: KnowledgeBaseService;

  constructor(params: {
    id?: string;
    agentId: string;
    name: string;
    description?: string;
    modelService?: ModelServicePort;
    vectorDB?: VectorDBPort;
  }) {
    this.id = params.id || uuidv4();
    this.agentId = params.agentId;
    this.name = params.name;
    this.description = params.description;
    if (params.modelService && params.vectorDB) {
      this.service = new KnowledgeBaseService({
        modelService: params.modelService,
        vectorDB: params.vectorDB,
        knowledgeBaseId: this.id,
      });
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public setServices(modelService: ModelServicePort, vectorDB: VectorDBPort): void {
    this.service = new KnowledgeBaseService({
      modelService,
      vectorDB,
      knowledgeBaseId: this.id,
    });
  }

  public async addKnowledge(content: string, metadata?: Record<string, any>) {
    if (!this.service) {
      throw new Error("Knowledge base services not initialized");
    }
    return this.service.addKnowledge(content, metadata);
  }

  public async searchKnowledge(query: string, topK: number = 5) {
    if (!this.service) {
      throw new Error("Knowledge base services not initialized");
    }
    return this.service.searchKnowledge(query, topK);
  }

  public async deleteKnowledge(id: string) {
    if (!this.service) {
      throw new Error("Knowledge base services not initialized");
    }
    return this.service.deleteKnowledge(id);
  }
} 