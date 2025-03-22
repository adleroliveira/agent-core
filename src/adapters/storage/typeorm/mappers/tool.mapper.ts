import { Tool, ToolParameter } from '@core/domain/tool.entity';
import { ToolEntity } from '../entities/tool.entity';

export class ToolMapper {
  static toDomain(entity: ToolEntity): Tool {
    // Create a placeholder handler function since we can't store functions in the database
    // The actual handler will be provided by the ToolRegistry when the tool is registered
    const placeholderHandler = async (): Promise<any> => {
      throw new Error(`Tool handler for ${entity.name} not implemented`);
    };

    return new Tool({
      id: entity.id,
      name: entity.name,
      description: entity.description,
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