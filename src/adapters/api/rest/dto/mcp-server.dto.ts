import { IsString, IsNotEmpty, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { McpToolDto } from './mcp-tool.dto';

export class CreateMCPServerDto {
  @ApiProperty({
    description: 'The provider of the MCP server',
    example: 'openai'
  })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({
    description: 'The repository of the MCP server',
    example: 'openai/gpt-4'
  })
  @IsString()
  @IsNotEmpty()
  repository: string;

  @ApiProperty({
    description: 'The name of the MCP server',
    example: 'GPT-4 Server'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'A description of the MCP server',
    example: 'A powerful language model server',
    required: false
  })
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The command to start the server',
    example: 'python server.py'
  })
  @IsString()
  @IsNotEmpty()
  command: string;

  @ApiProperty({
    description: 'Command line arguments for the server',
    example: ['--port', '8000'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  args: string[];

  @ApiProperty({
    description: 'Environment variables for the server',
    example: { API_KEY: 'secret-key' },
    type: 'object',
    additionalProperties: { type: 'string' }
  })
  @IsObject()
  env: Record<string, string>;
}

export class MCPServerDto {
  @ApiProperty({
    description: 'The unique identifier of the MCP server',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'The provider of the MCP server',
    example: 'openai'
  })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({
    description: 'The repository of the MCP server',
    example: 'openai/gpt-4'
  })
  @IsString()
  @IsNotEmpty()
  repository: string;

  @ApiProperty({
    description: 'The name of the MCP server',
    example: 'GPT-4 Server'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The command to start the server',
    example: 'python server.py'
  })
  @IsString()
  @IsNotEmpty()
  command: string;

  @ApiProperty({
    description: 'Command line arguments for the server',
    example: ['--port', '8000'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  args: string[];

  @ApiProperty({
    description: 'Environment variables for the server',
    example: { API_KEY: 'secret-key' },
    type: 'object',
    additionalProperties: { type: 'string' }
  })
  @IsObject()
  env: Record<string, string>;

  @ApiProperty({
    description: 'A description of the MCP server',
    example: 'A powerful language model server',
    required: false
  })
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Tools associated with the MCP server',
    type: [McpToolDto]
  })
  @IsArray()
  tools: McpToolDto[];
} 