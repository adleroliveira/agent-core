import { Injectable, Logger, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { Tool } from '@core/domain/tool.entity';
import { ToolRegistryPort } from '@ports/tool/tool-registry.port';
import { WorkspaceConfig } from '@core/config/workspace.config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolEntity } from '@adapters/storage/typeorm/entities/tool.entity';
import { ToolMapper } from '@adapters/storage/typeorm/mappers/tool.mapper';

@Injectable()
export class ToolRegistryService implements ToolRegistryPort {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools: Map<string, Tool> = new Map();
  private readonly toolsByName: Map<string, Tool> = new Map();

  constructor(
    private readonly workspaceConfig: WorkspaceConfig,
    @InjectRepository(ToolEntity)
    private readonly toolRepository: Repository<ToolEntity>,
    @Inject(forwardRef(() => ToolMapper))
    private readonly toolMapper: ToolMapper
  ) {
    if (!workspaceConfig) {
      throw new Error('WorkspaceConfig is required for ToolRegistryService');
    }
  }

  async registerTool(tool: Tool): Promise<Tool> {
    if (!tool) {
      throw new Error('Tool cannot be null or undefined');
    }

    // Check if tool exists in database
    let toolEntity = await this.toolRepository.findOne({
      where: { name: tool.name }
    });

    if (!toolEntity) {
      // Convert domain tool to entity and save to database
      toolEntity = this.toolMapper.toEntity(tool);
      toolEntity = await this.toolRepository.save(toolEntity);
      this.logger.log(`Tool saved to database: ${tool.name} (${toolEntity.id})`);
    }

    // Create a new Tool instance with the database ID
    const registeredTool = new Tool({
      id: toolEntity.id,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      directive: tool.directive,
      handler: tool.handler,
      metadata: tool.metadata,
      jsonSchema: tool.jsonSchema
    });

    // Register in memory
    this.tools.set(registeredTool.id, registeredTool);
    this.toolsByName.set(registeredTool.name, registeredTool);
    this.logger.log(`Tool registered: ${registeredTool.name} (${registeredTool.id})`);
    return registeredTool;
  }

  async unregisterTool(toolId: string): Promise<boolean> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return false;
    }

    this.tools.delete(toolId);
    this.toolsByName.delete(tool.name);
    this.logger.log(`Tool unregistered: ${tool.name} (${toolId})`);
    return true;
  }

  async getTool(toolId: string): Promise<Tool | null> {
    return this.tools.get(toolId) || null;
  }

  async getToolByName(name: string): Promise<Tool | null> {
    return this.toolsByName.get(name) || null;
  }

  async getAllTools(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }

  async executeTool(toolId: string, args: Record<string, any>, environment?: Record<string, string>): Promise<any> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    this.logger.debug(`Executing tool: ${tool.name} with args: ${JSON.stringify(args)}`);
    try {
      const result = await tool.execute(args, environment);
      this.logger.debug(`Tool execution successful: ${tool.name}`, result);
      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${tool.name}`, error.stack);
      throw error;
    }
  }

  async executeToolByName(name: string, args: Record<string, any>, environment?: Record<string, string>): Promise<any> {
    const tool = this.toolsByName.get(name);
    if (!tool) {
      throw new NotFoundException(`Tool with name ${name} not found`);
    }

    return this.executeTool(tool.id, args, environment);
  }
} 