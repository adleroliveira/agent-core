import { ApiProperty } from '@nestjs/swagger';

export class FileUploadResponseDto {
  @ApiProperty({ description: 'Unique file identifier' })
  id: string;

  @ApiProperty({ description: 'Generated filename' })
  filename: string;

  @ApiProperty({ description: 'Original filename' })
  originalName: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'File MIME type' })
  mimetype: string;
} 