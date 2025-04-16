import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../domain/message.entity';

@Injectable()
export class FileService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Reads the contents of all files from a message as Buffers
   * @param message The message containing the files
   * @returns A Promise that resolves to an array of file contents as Buffers
   * @throws Error if any file cannot be read
   */
  public async getMessageFileContents(message: Message): Promise<Buffer[]> {
    if (!message.files || message.files.length === 0) {
      return [];
    }

    const uploadsDir = this.configService.get<string>('UPLOADS_DIR', './uploads');

    try {
      const fileContentsPromises = message.files.map(async (fileInfo) => {
        const filePath = path.join(uploadsDir, fileInfo.filename);
        return await fs.promises.readFile(filePath);
      });

      return await Promise.all(fileContentsPromises);
    } catch (error) {
      throw new Error(`Failed to read files: ${error.message}`);
    }
  }
} 