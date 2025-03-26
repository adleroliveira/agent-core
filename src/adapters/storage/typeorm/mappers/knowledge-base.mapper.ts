import { KnowledgeBase } from '@core/domain/knowledge-base.entity';
import { KnowledgeBaseEntity } from '../entities/knowledge-base.entity';

export class KnowledgeBaseMapper {
  static toDomain(entity: KnowledgeBaseEntity): KnowledgeBase {
    return new KnowledgeBase({
      id: entity.id,
      agentId: entity.agentId,
      name: entity.name,
      description: entity.description,
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