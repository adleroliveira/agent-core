import { KnowledgeBase } from '@core/domain/knowledge-base.entity';
import { KnowledgeBaseEntity } from '../entities/knowledge-base.entity';
import { ModelServicePort } from '@ports/model/model-service.port';
import { VectorDBPort } from '@ports/storage/vector-db.port';

export class KnowledgeBaseMapper {
  static toDomain(
    entity: KnowledgeBaseEntity,
    modelService?: ModelServicePort,
    vectorDB?: VectorDBPort
  ): KnowledgeBase {
    return new KnowledgeBase({
      id: entity.id,
      agentId: entity.agentId,
      name: entity.name,
      description: entity.description,
      modelService,
      vectorDB,
    });
  }

  static toPersistence(domain: KnowledgeBase, agentId: string): KnowledgeBaseEntity {
    const entity = new KnowledgeBaseEntity();
    entity.id = domain.id;
    entity.agentId = agentId;
    entity.name = domain.name;
    entity.description = domain.description || '';
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
} 