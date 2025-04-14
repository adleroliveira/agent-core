/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ModelPricingDto } from './ModelPricingDto';
export type ModelInfoDto = {
    /**
     * Unique identifier of the model
     */
    id: string;
    /**
     * Display name of the model
     */
    name: string;
    /**
     * Description of the model
     */
    description?: string;
    /**
     * List of model capabilities
     */
    capabilities?: Array<string>;
    /**
     * Maximum number of tokens the model can process
     */
    maxTokens?: number;
    /**
     * Context window size in tokens
     */
    contextWindow?: number;
    /**
     * Whether the model supports streaming responses
     */
    supportsStreaming: boolean;
    /**
     * Whether the model supports tool calls
     */
    supportsToolCalls: boolean;
    /**
     * Input modalities supported by the model
     */
    inputModalities: Array<string>;
    /**
     * Output modalities supported by the model
     */
    outputModalities: Array<string>;
    /**
     * Pricing information
     */
    pricing?: ModelPricingDto;
    /**
     * Additional metadata about the model
     */
    metadata?: Record<string, any>;
    /**
     * Provider of the model
     */
    provider?: string;
    /**
     * Whether the model is active
     */
    active?: boolean;
};

