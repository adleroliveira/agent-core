import { MCPTool } from "@core/domain/mcp-tool.entity";

export interface McpClientServicePort {
  listTools(serverId: string): Promise<MCPTool[]>;
  callTool(serverId: string, name: string, args: Record<string, any>): Promise<any>;
  listResources(serverId: string): Promise<any[]>;
  readResource(serverId: string, uri: string): Promise<any>;
  listPrompts(serverId: string): Promise<any[]>;
  getPrompt(serverId: string, name: string): Promise<any>;
}
