import { Tool, ToolParameter } from '@core/domain/tool.entity';
import { ToolEntity } from '../entities/tool.entity';
import { ToolRegistryPort } from '@ports/tool/tool-registry.port';

export class ToolMapper {
  constructor(private readonly toolRegistry: ToolRegistryPort) {}

  async toDomain(entity: ToolEntity): Promise<Tool> {
    // Try to get the actual tool from the registry
    const registeredTool = await this.toolRegistry.getTool(entity.id);
    
    if (registeredTool) {
      // If the tool is registered, use its handler
      return new Tool({
        id: entity.id,
        name: entity.name,
        description: entity.description,
        directive: entity.description,
        parameters: entity.parameters as ToolParameter[],
        handler: registeredTool.handler,
        metadata: entity.metadata,
      });
    }

    // If tool is not registered, create a placeholder handler
    const placeholderHandler = async (): Promise<any> => {
      throw new Error(`Tool handler for ${entity.name} not found in registry`);
    };

    return new Tool({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      directive: entity.description,
      parameters: entity.parameters as ToolParameter[],
      handler: placeholderHandler,
      metadata: entity.metadata,
    });
  }

  static toPersistence(domain: Tool, agentId?: string): ToolEntity {
    const entity = new ToolEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.description = domain.description;
    entity.parameters = domain.parameters;
    entity.metadata = domain.metadata || {};

    if (agentId) {
      entity.agentId = agentId;
    }

    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    return entity;
  }
}