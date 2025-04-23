import { ApiProperty } from '@nestjs/swagger';

export class McpToolInputSchemaDto {
  @ApiProperty({
    description: 'The type of the input schema',
    example: 'object'
  })
  type: string;

  @ApiProperty({
    description: 'Properties of the input schema',
    example: {
      path: {
        type: 'string'
      }
    }
  })
  properties: Record<string, { type: string }>;

  @ApiProperty({
    description: 'Required properties',
    example: ['path']
  })
  required: string[];

  @ApiProperty({
    description: 'Whether additional properties are allowed',
    example: false
  })
  additionalProperties: boolean;

  @ApiProperty({
    description: 'JSON Schema version',
    example: 'http://json-schema.org/draft-07/schema#'
  })
  $schema: string;
}

export class McpToolDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: Object })
  inputSchema: Record<string, any>;

  @ApiProperty({
    description: 'The ID of the MCP server this tool belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  serverId: string;
} 