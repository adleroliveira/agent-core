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
     * @param requestBody
     * @returns any
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
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static agentControllerGetAllAgents(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/agents',
        });
    }
    /**
     * @param id
     * @returns any
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
        });
    }
    /**
     * @param id
     * @returns any
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
     * @param id
     * @param requestBody
     * @returns any
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
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns any
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
        });
    }
    /**
     * @param id
     * @param toolId
     * @returns any
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
        });
    }
    /**
     * @param id
     * @returns any
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
        });
    }
    /**
     * @param id
     * @returns any
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
