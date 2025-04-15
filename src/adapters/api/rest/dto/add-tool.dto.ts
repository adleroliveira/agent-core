import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToolDto {
  @ApiProperty({
    description: 'The name of the tool to add to the agent',
    example: 'search'
  })
  @IsString()
  @IsNotEmpty()
  toolName: string;
}