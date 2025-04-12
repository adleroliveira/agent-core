/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ToolCallDto } from './ToolCallDto';
import type { ToolResultDto } from './ToolResultDto';
export type MessageDto = {
    /**
     * The ID of the message
     */
    id: string;
    /**
     * The content of the message
     */
    content: string;
    /**
     * The role of the message sender
     */
    role: MessageDto.role;
    /**
     * The ID of the conversation this message belongs to
     */
    stateId: string;
    /**
     * When the message was created
     */
    createdAt: string;
    /**
     * Tool calls made in this message
     */
    toolCalls?: Array<ToolCallDto>;
    /**
     * Results from tool calls
     */
    toolResults?: Array<ToolResultDto>;
    /**
     * Additional metadata about the message
     */
    metadata?: Record<string, any>;
};
export namespace MessageDto {
    /**
     * The role of the message sender
     */
    export enum role {
        USER = 'user',
        ASSISTANT = 'assistant',
    }
}

