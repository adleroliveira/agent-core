import { ApiProperty } from '@nestjs/swagger';

export class ToolDto {
  @ApiProperty({
    description: 'The unique identifier of the tool',
    example: 'tool_123'
  })
  id: string;

  @ApiProperty({
    description: 'The name of the tool',
    example: 'search'
  })
  name: string;

  @ApiProperty({
    description: 'A description of what the tool does',
    example: 'Searches for information using a search engine'
  })
  description: string;

  @ApiProperty({
    description: 'The parameters that the tool accepts',
    example: {
      query: {
        type: 'string',
        description: 'The search query',
        required: true
      }
    }
  })
  parameters: Record<string, any>;

  @ApiProperty({
    description: 'The system prompt that describes how to use the tool',
    example: 'Use this tool to search for information on the web',
    required: false
  })
  systemPrompt?: string;
} 