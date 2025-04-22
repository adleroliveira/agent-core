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
import { ToolRegistryService } from './tool-registry.service';
import { Tool } from '@core/domain/tool.entity';
import { TOOL_REGISTRY } from '@core/constants';

@Injectable()
export class McpServerService {
  private server: Server;
  private currentTransport: DirectTransport | null = null;

  constructor(
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryService,
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
      const tools = await this.toolRegistry.getAllTools();

      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: this.convertToolParametersToSchema(tool.parameters)
        }))
      };
    });

    // Handler for tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = await this.toolRegistry.getToolByName(request.params.name);
      if (!tool) {
        throw new Error(`Tool ${request.params.name} not found`);
      }

      const environment = this.getEnvironment();
      const result = await tool.execute(request.params.arguments || {}, environment);

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

  private convertToolParametersToSchema(parameters: Tool['parameters']): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description
      };

      if (param.required) {
        required.push(param.name);
      }

      if (param.enum) {
        properties[param.name].enum = param.enum;
      }

      if (param.default !== undefined) {
        properties[param.name].default = param.default;
      }

      if (param.properties) {
        properties[param.name].properties = param.properties;
      }

      if (param.items) {
        properties[param.name].items = param.items;
      }
    }

    return {
      type: "object",
      properties,
      required
    };
  }

  async connect(transport: Transport) {
    if (!(transport instanceof DirectTransport)) {
      throw new Error('McpServerService only supports DirectTransport');
    }
    this.currentTransport = transport;
    await this.server.connect(transport);
  }

  private getEnvironment(): Record<string, any> {
    return this.currentTransport?.getEnvironment() || {};
  }
} 