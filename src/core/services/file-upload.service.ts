import { Injectable } from '@nestjs/common';
import { FileUploadConfig, FileUploadOptions, FileInfo } from '../../ports/file-upload.port';

@Injectable()
export class FileUploadService {
  private defaultConfig: FileUploadConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxFiles: 1,
    destination: './uploads'
  };

  private uploadConfigs: FileUploadOptions = {
    chat: {
      ...this.defaultConfig,
      maxFileSize: 4 * 1024 * 1024, // 4MB
      maxFiles: 3
    }
  };

  getConfig(type: string): FileUploadConfig {
    return this.uploadConfigs[type] || this.defaultConfig;
  }

  validateFile(file: FileInfo, config: FileUploadConfig): boolean {
    if (file.size > config.maxFileSize) {
      return false;
    }

    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      return false;
    }

    return true;
  }
} 