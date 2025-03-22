import { IsString, IsNotEmpty } from 'class-validator';

export class UpdatePromptDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}