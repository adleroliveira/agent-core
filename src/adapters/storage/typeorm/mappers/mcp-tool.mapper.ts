import { MCPTool } from '@core/domain/mcp-tool.entity';
import { MCPToolEntity } from '../entities/mcp-tool.entity';

export class MCPToolMapper {
  public static toDomain(entity: MCPToolEntity): MCPTool {
    const mcpTool = MCPTool.create(
      entity.id,
      entity.name,
      entity.description,
      entity.inputSchema,
      entity.serverId,
    );
    return mcpTool;
  }

  public static toEntity(domain: MCPTool): MCPToolEntity {
    const entity = new MCPToolEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.description = domain.description;
    entity.inputSchema = domain.inputSchema;
    entity.serverId = domain.serverId;
    return entity;
  }
} 