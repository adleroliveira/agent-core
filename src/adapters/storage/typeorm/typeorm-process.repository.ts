import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, ProcessStatus } from '@core/domain/process.entity';
import { ProcessRepositoryPort } from '@ports/storage/process-repository.port';
import { ProcessEntity } from './entities/process.entity';
import { ProcessMapper } from './mappers/process.mapper';

@Injectable()
export class TypeOrmProcessRepository implements ProcessRepositoryPort {
  constructor(
    @InjectRepository(ProcessEntity)
    private readonly processRepository: Repository<ProcessEntity>
  ) {}

  async findById(id: string): Promise<Process | null> {
    const processEntity = await this.processRepository.findOne({
      where: { id }
    });

    if (!processEntity) {
      return null;
    }

    return ProcessMapper.toDomain(processEntity);
  }

  async findAll(): Promise<Process[]> {
    const processEntities = await this.processRepository.find();
    return processEntities.map(entity => ProcessMapper.toDomain(entity));
  }

  async findByStatus(status: ProcessStatus): Promise<Process[]> {
    const processEntities = await this.processRepository.find({
      where: { status }
    });
    return processEntities.map(entity => ProcessMapper.toDomain(entity));
  }

  async save(process: Process): Promise<Process> {
    const processEntity = ProcessMapper.toPersistence(process);
    const savedEntity = await this.processRepository.save(processEntity);
    return ProcessMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.processRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.processRepository.count({
      where: { id }
    });
    return count > 0;
  }
} 