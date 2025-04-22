import { Controller, Get, Inject, HttpException, HttpStatus } from "@nestjs/common";
import { ToolRegistryService } from "@core/services/tool-registry.service";
import { TOOL_REGISTRY } from "@core/constants";
import { MCP_CLIENT } from "@core/injection-tokens";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ToolDto } from "./dto/tool.dto";
import { McpClientService } from "@core/services/mcp-client.service";

@ApiTags('tools')
@Controller("tools")
export class ToolsController {
  constructor(
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryService,
    @Inject(MCP_CLIENT)
    private readonly mcpClient: McpClientService
  ) { }

  @Get()
  @ApiOperation({
    summary: 'Get all available tools',
    description: 'Retrieves a list of all available tools that can be used by agents'
  })
  @ApiResponse({
    status: 200,
    description: 'List of all available tools',
    type: [ToolDto]
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  async getAllTools(): Promise<ToolDto[]> {
    try {
      const tools = await this.toolRegistry.getAllTools();
      return tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        systemPrompt: tool.systemPrompt
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to get tools: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('mcp')
  @ApiOperation({
    summary: 'Get all MCP tools',
    description: 'Retrieves a list of all MCP tools'
  })
  @ApiResponse({
    status: 200,
    description: 'List of all MCP tools',
    type: [ToolDto]
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  async getMcpTools() {
    try {
      const tools = await this.mcpClient.listTools();
      return tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        systemPrompt: tool.systemPrompt
      }));
    } catch (error) {
      console.error(error);
      throw new HttpException(`Failed to get MCP tools: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 