import { Controller, Get, Inject, HttpException, HttpStatus } from "@nestjs/common";
import { ToolRegistryService } from "@core/services/tool-registry.service";
import { TOOL_REGISTRY } from "@core/constants";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";

@Controller("tools")
export class ToolsController {
  constructor(
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all available tools' })
  @ApiResponse({ status: 200, description: 'List of all available tools' })
  async getAllTools() {
    try {
      const tools = await this.toolRegistry.getAllTools();
      return tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to get tools: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 