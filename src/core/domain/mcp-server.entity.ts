import { MCPTool } from './mcp-tool.entity';

export class MCPServer {
  constructor(
    public readonly id: string,
    public readonly provider: string,
    public readonly repository: string,
    public readonly name: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly env: Record<string, string>,
    public readonly description?: string,
    public readonly tools?: MCPTool[],
  ) { }
} 