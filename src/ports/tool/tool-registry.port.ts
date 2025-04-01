import { Tool } from '@core/domain/tool.entity';
import { Agent } from '@core/domain/agent.entity';
export interface ToolRegistryPort {
  registerTool(tool: Tool): Promise<Tool>;
  unregisterTool(toolId: string): Promise<boolean>;
  getTool(toolId: string): Promise<Tool | null>;
  getToolByName(name: string): Promise<Tool | null>;
  getAllTools(): Promise<Tool[]>;
  executeTool(toolId: string, args: Record<string, any>, agent: Agent): Promise<any>;
  executeToolByName(name: string, args: Record<string, any>, agent: Agent): Promise<any>;
}