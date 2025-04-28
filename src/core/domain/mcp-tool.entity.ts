import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuidv4 } from 'uuid';

export class MCPTool {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly inputSchema: Record<string, any>,
    public readonly serverId: string,
  ) { }

  public static create(
    id: string,
    name: string,
    description: string,
    inputSchema: Record<string, any>,
    serverId: string,
  ): MCPTool {
    return new MCPTool(
      id,
      name,
      description,
      inputSchema,
      serverId,
    );
  }

  public getInputSchema(): Record<string, any> {
    return this.inputSchema;
  }

  async execute(command: string, args: string[], name: string, params: Record<string, any>, env: Record<string, any> = {}): Promise<any> {
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env } as Record<string, string>
    });

    const client = new Client({
      name: "ToolCheckerClient",
      version: "1.0.0",
    }, {
      capabilities: {}
    });
    await client.connect(transport);
    const toolsResult = await client.callTool({ name, arguments: params }) as CallToolResult;
    const resultContent = toolsResult.content[0].text as string;
    await client.close();

    try {
      return JSON.parse(resultContent);
    } catch (e) {
      return { result: resultContent };
    }
  }
} 