/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ToolDto } from '../models/ToolDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ToolsService {
    /**
     * Get all available tools
     * Retrieves a list of all available tools that can be used by agents
     * @returns ToolDto List of all available tools
     * @throws ApiError
     */
    public static toolsControllerGetAllTools(): CancelablePromise<Array<ToolDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tools',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
