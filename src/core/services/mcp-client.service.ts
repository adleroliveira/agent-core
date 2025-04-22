import { Injectable } from '@nestjs/common';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createDirectTransportPair } from './mcp-transport';
import { McpServerService } from './mcp-server.service';
import { Tool, ToolParameter } from '@core/domain/tool.entity';
import { Agent } from '@core/domain/agent.entity';
import { McpClientServicePort } from '@ports/mcp/mcp-client-service.port';
import { EventEmitter } from 'events';
import { DirectTransport } from './mcp-transport';

@Injectable()
export class McpClientService implements McpClientServicePort {
  private client: Client;
  private _initialized = false;
  private currentEnvironment: Record<string, any> = {};
  private emitter: EventEmitter | null = null;
  private clientTransport: DirectTransport | null = null;
  private serverTransport: DirectTransport | null = null;

  constructor(private readonly serverService: McpServerService) {
    // Only create client instance in constructor, move connection to initialize
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

  async initialize(environment: Record<string, any> = {}) {
    if (this._initialized) {
      // If already initialized, check if environment changed
      if (JSON.stringify(this.currentEnvironment) !== JSON.stringify(environment)) {
        await this.close();
      } else {
        return;
      }
    }

    this.currentEnvironment = environment;
    this.emitter = new EventEmitter();
    this.clientTransport = new DirectTransport(this.emitter, 'client', { environment });
    this.serverTransport = new DirectTransport(this.emitter, 'server', { environment });

    // Connect server first
    await this.serverService.connect(this.serverTransport);

    // Connect client last
    await this.client.connect(this.clientTransport);

    this._initialized = true;
  }

  private async ensureInitialized(environment: Record<string, any> = {}) {
    if (!this._initialized || JSON.stringify(this.currentEnvironment) !== JSON.stringify(environment)) {
      await this.initialize(environment);
    }
  }

  async close() {
    if (this._initialized) {
      await this.client.close();
      this._initialized = false;
      this.emitter = null;
      this.clientTransport = null;
      this.serverTransport = null;
    }
  }

  async listResources(environment: Record<string, any> = {}) {
    await this.ensureInitialized(environment);
    return await this.client.listResources();
  }

  async readResource(uri: string, environment: Record<string, any> = {}) {
    await this.ensureInitialized(environment);
    return await this.client.readResource({ uri });
  }

  async listTools(environment: Record<string, any> = {}): Promise<Tool[]> {
    await this.ensureInitialized(environment);
    const response = await this.client.listTools();
    const tools = response.tools;

    if (!Array.isArray(tools)) {
      throw new Error('Expected an array of tools from client.listTools()');
    }

    return tools.map((tool: any) => {
      return new Tool({
        name: tool.name,
        description: tool.description || '',
        directive: tool.description || '', // Using description as directive as requested
        parameters: tool.inputSchema?.properties ? Object.entries(tool.inputSchema.properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type as ToolParameter['type'],
          description: prop.description,
          required: tool.inputSchema?.required?.includes(name) || false,
          enum: prop.enum,
          default: prop.default,
          properties: prop.properties,
          items: prop.items
        })) : [],
        handler: async (args: Record<string, any>, environment?: Record<string, string>) => {
          return await this.callTool(tool.name, environment || {}, args);
        }
      });
    });
  }

  async callTool(name: string, environment: Record<string, any>, args: Record<string, any>) {
    await this.ensureInitialized(environment);
    return await this.client.callTool({
      name,
      arguments: args
    });
  }

  async listPrompts(environment: Record<string, any> = {}) {
    await this.ensureInitialized(environment);
    return await this.client.listPrompts();
  }

  async getPrompt(name: string, environment: Record<string, any> = {}) {
    await this.ensureInitialized(environment);
    return await this.client.getPrompt({ name });
  }
} 