import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MCPServer } from '../../../core/domain/mcp-server.entity';
import { MCPServerEntity } from './entities/mcp-server.entity';
import { MCPServerMapper } from './mappers/mcp-server.mapper';
import { MCPToolRepository } from './typeorm-mcp-tool.repository';

@Injectable()
export class TypeOrmMCPServerRepository {
  constructor(
    @InjectRepository(MCPServerEntity)
    private readonly repository: Repository<MCPServerEntity>,
    private readonly mcpToolRepository: MCPToolRepository,
  ) { }

  async create(mcpServer: MCPServer): Promise<MCPServer> {
    return this.repository.manager.transaction(async (manager) => {
      try {
        // Convert domain to entity
        const entity = MCPServerMapper.toEntity(mcpServer);

        // Create a new object without the relations
        const { tools: toolsToIgnore, ...serverEntityWithoutRelations } = entity;

        // Save the server without the relations first
        const savedServerEntity = await manager.save(MCPServerEntity, serverEntityWithoutRelations);

        // If the server has tools, save them
        if (mcpServer.tools && mcpServer.tools.length > 0) {
          await Promise.all(mcpServer.tools.map(tool => this.mcpToolRepository.save(tool)));
        }

        // Fetch the saved server with its relationships
        const serverWithRelations = await manager.findOne(MCPServerEntity, {
          where: { id: savedServerEntity.id },
          relations: ['tools']
        });

        if (!serverWithRelations) {
          throw new Error('Failed to load saved server');
        }

        return MCPServerMapper.toDomain(serverWithRelations);
      } catch (error) {
        console.error('Error saving MCP server:', error);
        throw error;
      }
    });
  }

  async findAll(): Promise<MCPServer[]> {
    const entities = await this.repository.find({ relations: ['tools'] });
    return entities.map(MCPServerMapper.toDomain);
  }

  async findById(id: string): Promise<MCPServer | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['tools']
    });
    return entity ? MCPServerMapper.toDomain(entity) : null;
  }

  async update(id: string, mcpServer: MCPServer): Promise<MCPServer | null> {
    return this.repository.manager.transaction(async (manager) => {
      try {
        const existingEntity = await manager.findOne(MCPServerEntity, {
          where: { id },
          relations: ['tools']
        });

        if (!existingEntity) return null;

        // Convert domain to entity
        const updatedEntity = MCPServerMapper.toEntity(mcpServer);
        updatedEntity.id = id;

        // Create a new object without the relations
        const { tools: toolsToIgnore, ...serverEntityWithoutRelations } = updatedEntity;

        // Save the server without the relations first
        const savedServerEntity = await manager.save(MCPServerEntity, serverEntityWithoutRelations);

        // Delete existing tools
        const existingTools = await this.mcpToolRepository.findByServerId(id);
        await Promise.all(existingTools.map(tool => this.mcpToolRepository.delete(tool.id)));

        // If the server has tools, save them
        if (mcpServer.tools && mcpServer.tools.length > 0) {
          await Promise.all(mcpServer.tools.map(tool => this.mcpToolRepository.save(tool)));
        }

        // Fetch the saved server with its relationships
        const serverWithRelations = await manager.findOne(MCPServerEntity, {
          where: { id: savedServerEntity.id },
          relations: ['tools']
        });

        if (!serverWithRelations) {
          throw new Error('Failed to load saved server');
        }

        return MCPServerMapper.toDomain(serverWithRelations);
      } catch (error) {
        console.error('Error updating MCP server:', error);
        throw error;
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.manager.transaction(async (manager) => {
      try {
        // First check if any tools are being used by agents
        const tools = await this.mcpToolRepository.findByServerId(id);

        // Check each tool for agent relationships
        for (const tool of tools) {
          const agentTools = await manager.find('agent_tools', { where: { toolId: tool.id } });
          if (agentTools.length > 0) {
            throw new Error(`Cannot delete MCP server because tool "${tool.name}" is being used by one or more agents`);
          }
        }

        // If no tools are being used, proceed with deletion
        // First delete all tools associated with the server
        await Promise.all(tools.map(tool => this.mcpToolRepository.delete(tool.id)));

        // Then delete the server
        const result = await manager.delete(MCPServerEntity, { id });
        return (result.affected ?? 0) > 0;
      } catch (error) {
        console.error('Error deleting MCP server:', error);
        throw error;
      }
    });
  }
} 