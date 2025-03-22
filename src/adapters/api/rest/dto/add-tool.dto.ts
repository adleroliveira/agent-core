import { IsString, IsNotEmpty } from 'class-validator';

export class AddToolDto {
  @IsString()
  @IsNotEmpty()
  toolName: string;
}