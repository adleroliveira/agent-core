import { ApiProperty } from "@nestjs/swagger";

export class ModelPricingDto {
  @ApiProperty({ description: 'Price per input token', required: false })
  input?: number;

  @ApiProperty({ description: 'Price per output token', required: false })
  output?: number;
}

export class ModelInfoDto {
  @ApiProperty({ description: 'Unique identifier of the model' })
  id: string;

  @ApiProperty({ description: 'Display name of the model' })
  name: string;

  @ApiProperty({ description: 'Description of the model', required: false })
  description?: string;

  @ApiProperty({ description: 'List of model capabilities', required: false, type: [String] })
  capabilities?: string[];

  @ApiProperty({ description: 'Maximum number of tokens the model can process', required: false })
  maxTokens?: number;

  @ApiProperty({ description: 'Context window size in tokens', required: false })
  contextWindow?: number;

  @ApiProperty({ description: 'Whether the model supports streaming responses' })
  supportsStreaming: boolean;

  @ApiProperty({ description: 'Whether the model supports tool calls' })
  supportsToolCalls: boolean;

  @ApiProperty({ description: 'Input modalities supported by the model', type: [String] })
  inputModalities: string[];

  @ApiProperty({ description: 'Output modalities supported by the model', type: [String] })
  outputModalities: string[];

  @ApiProperty({ description: 'Pricing information', type: ModelPricingDto, required: false })
  pricing?: ModelPricingDto;

  @ApiProperty({ description: 'Additional metadata about the model', required: false })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Provider of the model', required: false })
  provider?: string;

  @ApiProperty({ description: 'Whether the model is active', required: false })
  active?: boolean;
  
} 