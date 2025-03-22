import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @IsArray()
  @IsOptional()
  tools?: string[];
}