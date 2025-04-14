import { ModelsService as ApiModelsService } from '../api-client/services/ModelsService';
import type { ModelInfoDto } from '../api-client/models/ModelInfoDto';

export class ModelService {
  private static instance: ModelService;
  private models: ModelInfoDto[] = [];
  private initialized = false;

  private constructor() {}

  public static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    return ModelService.instance;
  }

  public async getAvailableModels(): Promise<ModelInfoDto[]> {
    if (!this.initialized) {
      this.models = await ApiModelsService.modelsControllerGetAvailableModels();
      this.initialized = true;
    }
    return this.models;
  }
} 