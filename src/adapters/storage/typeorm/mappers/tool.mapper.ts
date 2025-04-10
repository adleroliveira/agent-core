import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { Tool } from "@core/domain/tool.entity";
import { ToolEntity } from "../entities/tool.entity";
import { TOOL_REGISTRY, ToolRegistryPort } from "@ports/tool/tool-registry.port";

@Injectable()
export class ToolMapper {
  constructor(
    @Inject(forwardRef(() => TOOL_REGISTRY))
    private readonly toolRegistry: ToolRegistryPort
  ) {}

  async toDomain(entity: ToolEntity): Promise<Tool> {
    const toolDefinition = await this.toolRegistry.getToolByName(entity.name);
    if (!toolDefinition) {
      throw new Error(`Tool definition not found for ${entity.name}`);
    }

    return new Tool({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      parameters: entity.parameters,
      directive: toolDefinition.directive,
      handler: toolDefinition.handler,
      metadata: entity.metadata || {},
      // jsonSchema: entity.jsonSchema || {}
    });
  }

  toEntity(domain: Tool): ToolEntity {
    const entity = new ToolEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.description = domain.description;
    entity.parameters = domain.parameters;
    entity.metadata = domain.metadata || {};
    entity.jsonSchema = domain.jsonSchema || {};
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}