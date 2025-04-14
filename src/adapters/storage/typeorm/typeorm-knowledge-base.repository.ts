import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";
import { KnowledgeBaseRepositoryPort } from "@ports/storage/knowledge-base-repository.port";
import { KnowledgeBaseEntity } from "./entities/knowledge-base.entity";
import { ModelServicePort } from "@ports/model/model-service.port";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { MODEL_SERVICE, VECTOR_DB } from "@core/injection-tokens";
import { KnowledgeBaseMapper } from "./mappers/knowledge-base.mapper";

@Injectable()
export class TypeOrmKnowledgeBaseRepository implements KnowledgeBaseRepositoryPort {
  constructor(
    @InjectRepository(KnowledgeBaseEntity)
    private readonly repository: Repository<KnowledgeBaseEntity>,
    @Inject(forwardRef(() => MODEL_SERVICE))
    private readonly modelService: ModelServicePort,
    @Inject(forwardRef(() => VECTOR_DB))
    private readonly vectorDB: VectorDBPort
  ) {}

  async save(knowledgeBase: KnowledgeBase): Promise<KnowledgeBase> {
    const entity = KnowledgeBaseMapper.toPersistence(knowledgeBase, knowledgeBase.agentId);
    const saved = await this.repository.save(entity);
    return KnowledgeBaseMapper.toDomain(saved, this.modelService, this.vectorDB);
  }

  async findById(id: string): Promise<KnowledgeBase | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? KnowledgeBaseMapper.toDomain(entity, this.modelService, this.vectorDB) : null;
  }

  async findByAgentId(agentId: string): Promise<KnowledgeBase | null> {
    const entity = await this.repository.findOne({ where: { agentId } });
    return entity ? KnowledgeBaseMapper.toDomain(entity, this.modelService, this.vectorDB) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async deleteByAgentId(agentId: string): Promise<boolean> {
    const result = await this.repository.delete({ agentId });
    return result.affected ? result.affected > 0 : false;
  }
} 