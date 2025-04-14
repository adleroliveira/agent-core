/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ModelInfoDto } from '../models/ModelInfoDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ModelsService {
    /**
     * Get all available models
     * @returns ModelInfoDto List of all available models
     * @throws ApiError
     */
    public static modelsControllerGetAvailableModels(): CancelablePromise<Array<ModelInfoDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/models',
            errors: {
                500: `Internal server error while fetching models`,
            },
        });
    }
}
