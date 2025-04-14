import { Controller, Get, Inject, HttpException, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ModelServicePort } from "@ports/model/model-service.port";
import { MODEL_SERVICE } from "@core/injection-tokens";
import { ModelInfoDto } from "./dto/model-info.dto";

@ApiTags('Models')
@Controller("models")
export class ModelsController {
  constructor(
    @Inject(MODEL_SERVICE)
    private readonly modelService: ModelServicePort
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all available models' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all available models',
    type: [ModelInfoDto]
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error while fetching models' 
  })
  async getAvailableModels(): Promise<ModelInfoDto[]> {
    try {
      return await this.modelService.getAvailableModels();
    } catch (error) {
      throw new HttpException(
        `Failed to get available models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 