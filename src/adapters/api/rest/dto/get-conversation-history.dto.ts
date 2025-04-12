import { IsOptional, IsNumber, IsDate, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class GetConversationHistoryDto {
  @IsString()
  @IsNotEmpty()
  stateId: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  beforeTimestamp?: Date;
} 