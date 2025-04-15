import { Controller, Get, Inject, HttpException, HttpStatus } from "@nestjs/common";
import { ToolRegistryService } from "@core/services/tool-registry.service";
import { TOOL_REGISTRY } from "@core/constants";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ToolDto } from "./dto/tool.dto";

@ApiTags('tools')
@Controller("tools")
export class ToolsController {
  constructor(
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryService
  ) {}

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
} 