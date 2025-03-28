import { Process } from '@core/domain/process.entity';
import { ProcessEntity } from '../entities/process.entity';

export class ProcessMapper {
  static toDomain(entity: ProcessEntity): Process {
    return new Process({
      id: entity.id,
      name: entity.name,
      command: entity.command,
      status: entity.status,
      output: entity.output || '',
      error: entity.error || undefined,
      exitCode: entity.exitCode || undefined,
      startedAt: entity.startedAt || undefined,
      completedAt: entity.completedAt || undefined,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toPersistence(domain: Process): ProcessEntity {
    const entity = new ProcessEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.command = domain.command;
    entity.status = domain.status;
    entity.output = domain.output;
    entity.error = domain.error || '';
    entity.exitCode = domain.exitCode || 0;
    entity.startedAt = domain.startedAt || new Date();
    entity.completedAt = domain.completedAt || new Date();
    entity.metadata = domain.metadata;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
} 