/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FileInfoDto } from './FileInfoDto';
export type SendMessageDto = {
    /**
     * The content of the message to send
     */
    content: string;
    /**
     * Optional state ID to continue an existing conversation. If not provided, a new conversation will be created.
     */
    stateId?: string;
    /**
     * Temperature for response generation (0-1)
     */
    temperature?: number;
    /**
     * Maximum number of tokens to generate
     */
    maxTokens?: number;
    /**
     * Array of files attached to the message
     */
    files?: Array<FileInfoDto>;
};

