import { ApiProperty } from '@nestjs/swagger';
import { FileInfo } from '@ports/file-upload.port';

export class FileInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  mimetype: string;
}

export class ToolCallDto {
  @ApiProperty({
    description: 'The ID of the tool call',
    example: 'call_123'
  })
  id: string;

  @ApiProperty({
    description: 'The name of the tool being called',
    example: 'search'
  })
  name: string;

  @ApiProperty({
    description: 'The arguments passed to the tool',
    example: { query: 'weather in London' }
  })
  arguments: Record<string, any>;
}

export class ToolResultDto {
  @ApiProperty({
    description: 'The ID of the tool result',
    example: 'result_123'
  })
  id: string;

  @ApiProperty({
    description: 'The content of the tool result',
    example: 'The weather in London is sunny'
  })
  content: string;
}

export class MessageDto {
  @ApiProperty({
    description: 'The ID of the message',
    example: 'msg_123'
  })
  id: string;

  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello, how can I help you?'
  })
  content: string;

  @ApiProperty({
    description: 'The role of the message sender',
    enum: ['user', 'assistant', 'tool'],
    example: 'assistant'
  })
  role: 'user' | 'assistant' | 'tool';

  @ApiProperty({
    description: 'The ID of the conversation this message belongs to',
    example: 'conv_123'
  })
  stateId: string;

  @ApiProperty({
    description: 'When the message was created',
    example: '2024-03-14T12:00:00Z'
  })
  createdAt: string;

  @ApiProperty({
    description: 'Tool calls made in this message',
    type: [ToolCallDto],
    required: false
  })
  toolCalls?: ToolCallDto[];

  @ApiProperty({
    description: 'Results from tool calls',
    type: [ToolResultDto],
    required: false
  })
  toolResults?: ToolResultDto[];

  @ApiProperty({
    description: 'Additional metadata about the message',
    required: false
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Files attached to the message',
    type: [FileInfoDto],
    required: false
  })
  files?: FileInfo[];
} 