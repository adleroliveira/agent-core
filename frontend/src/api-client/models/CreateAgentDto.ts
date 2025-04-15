/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateAgentDto = {
    /**
     * The name of the agent
     */
    name: string;
    /**
     * A description of what the agent does
     */
    description: string;
    /**
     * The ID of the model to use for this agent
     */
    modelId?: string;
    /**
     * The system prompt that defines the agent's behavior
     */
    systemPrompt: string;
    /**
     * List of tool IDs that the agent can use
     */
    tools?: Array<string>;
};

