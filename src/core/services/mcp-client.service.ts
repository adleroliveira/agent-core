import { Injectable } from '@nestjs/common';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { DirectTransport } from './mcp-transport';
import { McpServerService } from './mcp-server.service';
import { MCPTool } from '@core/domain/mcp-tool.entity';
import { McpClientServicePort } from '@ports/mcp/mcp-client-service.port';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';

@Injectable()
export class McpClientService implements McpClientServicePort {
  private client: Client;
  private emitter: EventEmitter | null = null;
  private clientTransport: DirectTransport | null = null;
  private serverTransport: DirectTransport | null = null;

  constructor(private readonly serverService: McpServerService) {
    this.client = new Client({
      name: "AgentCoreMcpClientService",
      version: "1.0.0",
    }, {
      capabilities: {
        resources: {
          list: true,
          read: true
        },
        tools: {
          list: true,
          call: true
        },
        prompts: {
          list: true,
          get: true
        }
      }
    });
  }

  private async connect(serverId: string) {
    this.emitter = new EventEmitter();
    this.clientTransport = new DirectTransport(this.emitter, 'client', { environment: { serverId } });
    this.serverTransport = new DirectTransport(this.emitter, 'server', { environment: { serverId } });

    // Connect server first
    await this.serverService.connect(this.serverTransport, serverId);

    // Connect client last
    await this.client.connect(this.clientTransport);
  }

  private async disconnect() {
    if (this.clientTransport) {
      await this.client.close();
      this.emitter = null;
      this.clientTransport = null;
      this.serverTransport = null;
    }
  }

  async listTools(serverId: string): Promise<MCPTool[]> {
    await this.connect(serverId);
    try {
      const response = await this.client.listTools();
      const tools = response.tools;

      if (!Array.isArray(tools)) {
        throw new Error('Expected an array of tools from client.listTools()');
      }

      return tools.map((tool: any) => {
        return new MCPTool(
          uuidv4(),
          tool.name,
          tool.description || '',
          tool.inputSchema,
          serverId
        );
      });
    } finally {
      await this.disconnect();
    }
  }

  async callTool(serverId: string, name: string, args: Record<string, any>) {
    await this.connect(serverId);
    try {
      const toolsResult = await this.client.callTool({
        name,
        arguments: args
      }) as CallToolResult;
      const resultContent = toolsResult.content[0].text as string;
      try {
        return JSON.parse(resultContent);
      } catch (e) {
        return { result: resultContent };
      }
    } catch (error) {
      console.error("Error calling tool", error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async listResources(serverId: string): Promise<any[]> {
    await this.connect(serverId);
    try {
      const response = await this.client.listResources();
      return Array.isArray(response.resources) ? response.resources : [];
    } finally {
      await this.disconnect();
    }
  }

  async readResource(serverId: string, uri: string) {
    await this.connect(serverId);
    try {
      return await this.client.readResource({ uri });
    } finally {
      await this.disconnect();
    }
  }

  async listPrompts(serverId: string): Promise<any[]> {
    await this.connect(serverId);
    try {
      const response = await this.client.listPrompts();
      return Array.isArray(response.prompts) ? response.prompts : [];
    } finally {
      await this.disconnect();
    }
  }

  async getPrompt(serverId: string, name: string) {
    await this.connect(serverId);
    try {
      return await this.client.getPrompt({ name });
    } finally {
      await this.disconnect();
    }
  }
} 