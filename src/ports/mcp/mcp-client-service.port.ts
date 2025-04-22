import { Tool } from "@core/domain/tool.entity";

export interface McpClientServicePort {
  initialize(): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, environment: Record<string, any>, args: Record<string, any>): Promise<any>;
}
