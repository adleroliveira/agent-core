/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ToolDto = {
    /**
     * The unique identifier of the tool
     */
    id: string;
    /**
     * The name of the tool
     */
    name: string;
    /**
     * A description of what the tool does
     */
    description: string;
    /**
     * The parameters that the tool accepts
     */
    parameters: Record<string, any>;
    /**
     * The system prompt that describes how to use the tool
     */
    systemPrompt?: string;
};

