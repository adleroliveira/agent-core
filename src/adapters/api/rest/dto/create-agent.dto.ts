import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({
    description: 'The name of the agent',
    example: 'My Assistant'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'A description of what the agent does',
    example: 'An AI assistant that helps with daily tasks'
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'The ID of the model to use for this agent',
    example: 'gpt-4'
  })
  @IsString()
  @IsOptional()
  modelId?: string;

  @ApiProperty({
    description: 'The system prompt that defines the agent\'s behavior',
    example: 'You are a helpful AI assistant...'
  })
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @ApiPropertyOptional({
    description: 'List of tool IDs that the agent can use',
    example: ['tool1', 'tool2'],
    type: [String]
  })
  @IsArray()
  @IsOptional()
  tools?: string[];
}