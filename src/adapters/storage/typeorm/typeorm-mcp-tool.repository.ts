import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MCPTool } from '@core/domain/mcp-tool.entity';
import { MCPToolEntity } from './entities/mcp-tool.entity';
import { MCPToolMapper } from './mappers/mcp-tool.mapper';

@Injectable()
export class MCPToolRepository {
  constructor(
    @InjectRepository(MCPToolEntity)
    private readonly repository: Repository<MCPToolEntity>,
  ) { }

  async save(tool: MCPTool): Promise<MCPTool> {
    const entity = MCPToolMapper.toEntity(tool);
    const savedEntity = await this.repository.save(entity);
    return MCPToolMapper.toDomain(savedEntity);
  }

  async findById(id: string): Promise<MCPTool | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? MCPToolMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<MCPTool[]> {
    const entities = await this.repository.find();
    return entities.map(MCPToolMapper.toDomain);
  }

  async findByServerId(serverId: string): Promise<MCPTool[]> {
    const entities = await this.repository.find({ where: { serverId } });
    return entities.map(MCPToolMapper.toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
} 