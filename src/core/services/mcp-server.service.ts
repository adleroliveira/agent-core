import { Inject, Injectable } from '@nestjs/common';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import { DirectTransport } from './mcp-transport';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_SERVER_REPOSITORY } from '@core/injection-tokens';
import { MCPServer } from '@core/domain/mcp-server.entity';

@Injectable()
export class McpServerService {
  private server: Server;
  private currentTransport: DirectTransport | null = null;
  private currentServer: MCPServer | null = null;

  constructor(
    @Inject(MCP_SERVER_REPOSITORY)
    private readonly mcpServerRepository: any, // TODO: Add proper type
  ) {
    this.server = new Server(
      {
        name: "test-server",
        version: "0.1.0",
      },
      {
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
        },
      }
    );

    // Set up request handlers
    this.setupHandlers();
  }

  private setupHandlers() {
    // Handler for listing available notes as resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: []
      };
    });

    // Handler for reading the contents of a specific note
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      throw new Error("Resources not implemented");
    });

    // Handler that lists available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.currentServer) {
        throw new Error("No MCP server connected");
      }

      const tools = this.currentServer.tools || [];

      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.getInputSchema()
        }))
      };
    });

    // Handler for tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.currentServer) {
        throw new Error("No MCP server connected");
      }

      const tool = this.currentServer.tools?.find(t => t.id === request.params.name);
      if (!tool) {
        throw new Error(`Tool with ID ${request.params.name} not found`);
      }

      const environment = this.getEnvironment();
      const result = await tool.execute(
        this.currentServer.command,
        this.currentServer.args,
        tool.name,
        request.params.arguments || {},
        { ...this.currentServer.env, ...environment }
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result)
        }]
      };
    });

    // Handler that lists available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: []
      };
    });

    // Handler for the summarize_notes prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      throw new Error("Prompts not implemented");
    });
  }

  async connect(transport: Transport, serverId: string) {
    if (!(transport instanceof DirectTransport)) {
      throw new Error('McpServerService only supports DirectTransport');
    }

    const server = await this.mcpServerRepository.findById(serverId);
    if (!server) {
      throw new Error(`MCP server with ID ${serverId} not found`);
    }

    this.currentTransport = transport;
    this.currentServer = server;
    await this.server.connect(transport);
  }

  private getEnvironment(): Record<string, any> {
    return this.currentTransport?.getEnvironment() || {};
  }
} 