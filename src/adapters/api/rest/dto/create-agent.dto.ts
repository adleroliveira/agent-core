import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @IsArray()
  @IsOptional()
  tools?: string[];

  @IsString()
  @IsOptional()
  conversationId?: string;
}