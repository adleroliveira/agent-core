/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SendMessageDto = {
    /**
     * The content of the message to send
     */
    content: string;
    /**
     * Optional conversation ID to continue an existing conversation. If not provided, a new conversation will be created.
     */
    conversationId?: string;
    /**
     * Temperature for response generation (0-1)
     */
    temperature?: number;
    /**
     * Maximum number of tokens to generate
     */
    maxTokens?: number;
};

