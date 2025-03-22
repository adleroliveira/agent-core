import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '@core/domain/agent.entity';
import { AgentRepositoryPort } from '@ports/storage/agent-repository.port';
import { AgentEntity } from './entities/agent.entity';
import { AgentMapper } from './mappers/agent.mapper';

@Injectable()
export class TypeOrmAgentRepository implements AgentRepositoryPort {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
  ) {}

  async findById(id: string): Promise<Agent | null> {
    const agentEntity = await this.agentRepository.findOne({
      where: { id },
      relations: ['state', 'tools'],
    });
    
    if (!agentEntity) {
      return null;
    }
    
    return AgentMapper.toDomain(agentEntity);
  }

  async findAll(): Promise<Agent[]> {
    const agentEntities = await this.agentRepository.find({
      relations: ['state', 'tools'],
    });
    
    return agentEntities.map(entity => AgentMapper.toDomain(entity));
  }

  async save(agent: Agent): Promise<Agent> {
    const agentEntity = AgentMapper.toPersistence(agent);
    const savedEntity = await this.agentRepository.save(agentEntity);
    return AgentMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.agentRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.agentRepository.count({
      where: { id },
    });
    return count > 0;
  }
}