import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FileInfoDto {
  @ApiProperty({ description: 'Unique file identifier' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Generated filename' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: 'Original filename' })
  @IsString()
  @IsNotEmpty()
  originalName: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  @IsNotEmpty()
  size: number;

  @ApiProperty({ description: 'File MIME type' })
  @IsString()
  @IsNotEmpty()
  mimetype: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'The content of the message to send',
    example: 'Hello, how can you help me today?'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    name: 'stateId',
    description: 'Optional state ID to continue an existing conversation. If not provided, a new conversation will be created.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false
  })
  @IsString()
  @IsOptional()
  stateId?: string;

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
    default: 2000
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'Array of files attached to the message',
    type: [FileInfoDto],
    required: false
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileInfoDto)
  @IsOptional()
  files?: FileInfoDto[];
}