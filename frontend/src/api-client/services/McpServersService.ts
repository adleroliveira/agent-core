/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateMCPServerDto } from '../models/CreateMCPServerDto';
import type { MCPServerDto } from '../models/MCPServerDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class McpServersService {
    /**
     * Create a new MCP server
     * Creates a new MCP server with the specified configuration
     * @param requestBody
     * @returns MCPServerDto MCP server created successfully
     * @throws ApiError
     */
    public static mcpServerControllerCreateMcpServer(
        requestBody: CreateMCPServerDto,
    ): CancelablePromise<MCPServerDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp-servers',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request parameters or failed to connect to MCP server`,
            },
        });
    }
    /**
     * Get all MCP servers
     * Retrieves a list of all available MCP servers
     * @returns MCPServerDto List of MCP servers retrieved successfully
     * @throws ApiError
     */
    public static mcpServerControllerGetAllMcpServers(): CancelablePromise<Array<MCPServerDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/mcp-servers',
        });
    }
    /**
     * Get MCP server by ID
     * Retrieves a specific MCP server by its ID
     * @param id The ID of the MCP server to retrieve
     * @returns MCPServerDto MCP server retrieved successfully
     * @throws ApiError
     */
    public static mcpServerControllerGetMcpServer(
        id: string,
    ): CancelablePromise<MCPServerDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/mcp-servers/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `MCP server not found`,
            },
        });
    }
    /**
     * Update MCP server
     * Updates an existing MCP server with new configuration
     * @param id The ID of the MCP server to update
     * @param requestBody
     * @returns MCPServerDto MCP server updated successfully
     * @throws ApiError
     */
    public static mcpServerControllerUpdateMcpServer(
        id: string,
        requestBody: CreateMCPServerDto,
    ): CancelablePromise<MCPServerDto> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/mcp-servers/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `MCP server not found`,
            },
        });
    }
    /**
     * Delete MCP server
     * Deletes a specific MCP server by its ID
     * @param id The ID of the MCP server to delete
     * @returns any MCP server deleted successfully
     * @throws ApiError
     */
    public static mcpServerControllerDeleteMcpServer(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/mcp-servers/{id}',
            path: {
                'id': id,
            },
            errors: {
                400: `Cannot delete MCP server because its tools are being used by agents`,
                404: `MCP server not found`,
            },
        });
    }
}
