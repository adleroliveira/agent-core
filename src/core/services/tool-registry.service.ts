import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Tool } from '@core/domain/tool.entity';
import { ToolRegistryPort } from '@ports/tool/tool-registry.port';
import { WorkspaceConfig } from '@core/config/workspace.config';
import { PtyTool } from '@tools/default/pty.tool';
import { Agent } from '@core/domain/agent.entity';

@Injectable()
export class ToolRegistryService implements ToolRegistryPort {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools: Map<string, Tool> = new Map();
  private readonly toolsByName: Map<string, Tool> = new Map();

  constructor(private readonly workspaceConfig: WorkspaceConfig) {
    if (!workspaceConfig) {
      throw new Error('WorkspaceConfig is required for ToolRegistryService');
    }
  }

  async registerTool(tool: Tool): Promise<Tool> {
    if (!tool) {
      throw new Error('Tool cannot be null or undefined');
    }

    this.tools.set(tool.id, tool);
    this.toolsByName.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name} (${tool.id})`);
    return tool;
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

  async executeTool(toolId: string, args: Record<string, any>, agent: Agent): Promise<any> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    this.logger.debug(`Executing tool: ${tool.name} with args: ${JSON.stringify(args)}`);
    try {
      const result = await tool.execute(args, agent);
      this.logger.debug(`Tool execution successful: ${tool.name}`, result);
      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${tool.name}`, error.stack);
      throw error;
    }
  }

  async executeToolByName(name: string, args: Record<string, any>, agent: Agent): Promise<any> {
    const tool = this.toolsByName.get(name);
    if (!tool) {
      throw new NotFoundException(`Tool with name ${name} not found`);
    }

    return this.executeTool(tool.id, args, agent);
  }
} 