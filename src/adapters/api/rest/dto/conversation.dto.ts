import { ApiProperty } from '@nestjs/swagger';

export class ConversationDto {

  @ApiProperty({
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  agentId: string;

  @ApiProperty({
    description: 'The ID of the conversation state',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  stateId: string;

  @ApiProperty({
    description: 'When the conversation was created',
    example: '2024-04-15T08:00:00.000Z'
  })
  createdAt: string;

  @ApiProperty({
    description: 'When the conversation was last updated',
    example: '2024-04-15T08:00:00.000Z'
  })
  updatedAt: string;
} 