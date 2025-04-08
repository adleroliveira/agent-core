import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'The content of the message to send',
    example: 'Hello, how can you help me today?'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    name: 'conversationId',
    description: 'Optional conversation ID to continue an existing conversation. If not provided, a new conversation will be created.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false
  })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Temperature for response generation (0-1)',
    minimum: 0,
    maximum: 1,
    default: 0.7
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of tokens to generate',
    minimum: 1,
    default: 1000
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;
}