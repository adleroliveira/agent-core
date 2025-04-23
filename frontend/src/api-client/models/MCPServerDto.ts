/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { McpToolDto } from './McpToolDto';
export type MCPServerDto = {
    /**
     * The unique identifier of the MCP server
     */
    id: string;
    /**
     * The provider of the MCP server
     */
    provider: string;
    /**
     * The repository of the MCP server
     */
    repository: string;
    /**
     * The name of the MCP server
     */
    name: string;
    /**
     * The command to start the server
     */
    command: string;
    /**
     * Command line arguments for the server
     */
    args: Array<string>;
    /**
     * Environment variables for the server
     */
    env: Record<string, string>;
    /**
     * A description of the MCP server
     */
    description?: string;
    /**
     * Tools associated with the MCP server
     */
    tools: Array<McpToolDto>;
};

