/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddToolDto } from '../models/AddToolDto';
import type { CreateAgentDto } from '../models/CreateAgentDto';
import type { MessageDto } from '../models/MessageDto';
import type { SendMessageDto } from '../models/SendMessageDto';
import type { UpdatePromptDto } from '../models/UpdatePromptDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Create a new agent
     * Creates a new agent with the specified configuration
     * @param requestBody The agent configuration including name, description, and system prompt
     * @returns any Agent created successfully
     * @throws ApiError
     */
    public static agentControllerCreateAgent(
        requestBody: CreateAgentDto,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/agents',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request parameters`,
            },
        });
    }
    /**
     * Get all agents
     * Retrieves a list of all available agents
     * @returns any List of agents retrieved successfully
     * @throws ApiError
     */
    public static agentControllerGetAllAgents(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/agents',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get agent by ID
     * Retrieves detailed information about a specific agent
     * @param id The ID of the agent to retrieve
     * @returns any Agent retrieved successfully
     * @throws ApiError
     */
    public static agentControllerGetAgent(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/agents/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Agent not found`,
            },
        });
    }
    /**
     * Delete an agent
     * Deletes a specific agent by ID
     * @param id The ID of the agent to delete
     * @returns any Agent deleted successfully
     * @throws ApiError
     */
    public static agentControllerDeleteAgent(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/agents/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Agent not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Send a message to an agent
     * Send a message to an agent. The conversationId is required to identify the conversation.
     * @param id The ID of the agent
     * @param requestBody The message to send, including conversationId to identify the conversation
     * @param stream Whether to stream the response
     * @returns MessageDto Message processed successfully
     * @throws ApiError
     */
    public static agentControllerSendMessage(
        id: string,
        requestBody: SendMessageDto,
        stream?: boolean,
    ): CancelablePromise<MessageDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/agents/{id}/message',
            path: {
                'id': id,
            },
            query: {
                'stream': stream,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request parameters`,
                404: `Agent not found`,
            },
        });
    }
    /**
     * Update system prompt
     * Updates the system prompt for a specific agent
     * @param id The ID of the agent
     * @param requestBody The new system prompt content
     * @returns any System prompt updated successfully
     * @throws ApiError
     */
    public static agentControllerUpdateSystemPrompt(
        id: string,
        requestBody: UpdatePromptDto,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/agents/{id}/prompt',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Agent not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Add tool to agent
     * Adds a new tool to the agent's capabilities
     * @param id The ID of the agent
     * @param requestBody The tool to add to the agent
     * @returns any Tool added successfully
     * @throws ApiError
     */
    public static agentControllerAddTool(
        id: string,
        requestBody: AddToolDto,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/agents/{id}/tools',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Agent not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Remove tool from agent
     * Removes a tool from the agent's capabilities
     * @param id The ID of the agent
     * @param toolId The ID of the tool to remove
     * @returns any Tool removed successfully
     * @throws ApiError
     */
    public static agentControllerRemoveTool(
        id: string,
        toolId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/agents/{id}/tools/{toolId}',
            path: {
                'id': id,
                'toolId': toolId,
            },
            errors: {
                404: `Agent or tool not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Reset agent state
     * Resets the state of a specific agent
     * @param id The ID of the agent to reset
     * @returns any Agent state reset successfully
     * @throws ApiError
     */
    public static agentControllerResetState(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/agents/{id}/reset',
            path: {
                'id': id,
            },
            errors: {
                404: `Agent not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create new conversation
     * Creates a new conversation for a specific agent
     * @param id The ID of the agent
     * @param conversationId Optional conversation ID to specify when creating a new conversation
     * @returns any New conversation created successfully
     * @throws ApiError
     */
    public static agentControllerCreateNewConversation(
        id: string,
        conversationId?: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/agents/{id}/new-conversation',
            path: {
                'id': id,
            },
            query: {
                'conversationId': conversationId,
            },
            errors: {
                404: `Agent not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get agent conversations
     * Retrieves all conversations for a specific agent
     * @param id The ID of the agent
     * @returns any Conversations retrieved successfully
     * @throws ApiError
     */
    public static agentControllerGetConversations(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/agents/{id}/conversations',
            path: {
                'id': id,
            },
            errors: {
                404: `Agent not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * @param id
     * @param conversationId
     * @param limit
     * @param beforeTimestamp
     * @returns any
     * @throws ApiError
     */
    public static agentControllerGetConversationHistory(
        id: string,
        conversationId: string,
        limit?: number,
        beforeTimestamp?: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/agents/{id}/conversation-history',
            path: {
                'id': id,
            },
            query: {
                'conversationId': conversationId,
                'limit': limit,
                'beforeTimestamp': beforeTimestamp,
            },
        });
    }
    /**
     * Get all available tools
     * @returns any List of all available tools
     * @throws ApiError
     */
    public static toolsControllerGetAllTools(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/tools',
        });
    }
}
