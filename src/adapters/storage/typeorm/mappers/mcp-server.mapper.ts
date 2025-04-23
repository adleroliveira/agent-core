import { MCPServer } from '../../../../core/domain/mcp-server.entity';
import { MCPTool } from '../../../../core/domain/mcp-tool.entity';
import { MCPServerEntity } from '../entities/mcp-server.entity';
import { MCPToolMapper } from './mcp-tool.mapper';

export class MCPServerMapper {
  static toDomain(entity: MCPServerEntity): MCPServer {
    const tools = entity.tools?.map(MCPToolMapper.toDomain) ?? [];
    return new MCPServer(
      entity.id,
      entity.provider,
      entity.repository,
      entity.name,
      entity.command,
      entity.args,
      JSON.parse(entity.env),
      entity.description,
      tools,
    );
  }

  static toEntity(domain: MCPServer): MCPServerEntity {
    const entity = new MCPServerEntity();
    entity.id = domain.id;
    entity.provider = domain.provider;
    entity.repository = domain.repository;
    entity.name = domain.name;
    entity.description = domain.description ?? '';
    entity.command = domain.command;
    entity.args = domain.args;
    entity.env = JSON.stringify(domain.env);
    entity.tools = domain.tools?.map(MCPToolMapper.toEntity) ?? [];
    return entity;
  }
} 