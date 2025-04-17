import { Injectable } from '@nestjs/common';
import { FileUploadConfig, FileUploadOptions, FileInfo } from '../../ports/file-upload.port';

@Injectable()
export class FileUploadService {
  private defaultConfig: FileUploadConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'text/plain',
      'text/csv',
      'text/markdown',
      'text/x-markdown',
      'application/json',
      'application/xml',
      'text/xml',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/x-javascript',
      'text/x-javascript',
      'text/x-js',
      'text/x-python',
      'text/x-java',
      'text/x-c',
      'text/x-c++',
      'text/x-csharp',
      'text/x-php',
      'text/x-ruby',
      'text/x-perl',
      'text/x-shellscript',
      'text/x-yaml',
      'text/x-toml',
      'text/x-ini',
      'text/x-properties',
      'text/x-log',
      'text/x-diff',
      'text/x-patch',
      'text/x-tex',
      'text/x-latex',
      'text/x-bibtex',
      'text/x-rst',
      'text/x-asciidoc',
      'text/x-org',
      'text/x-org-agenda',
      'text/x-org-journal',
      'text/x-org-todo',
      'text/x-org-checklist',
      'text/x-org-table',
      'text/x-org-drawer',
      'text/x-org-property',
      'text/x-org-block',
      'text/x-org-src',
      'text/x-org-example',
      'text/x-org-export',
      'text/x-org-macro',
      'text/x-org-footnote',
      'text/x-org-link',
      'text/x-org-radio',
      'text/x-org-checkbox',
      'text/x-org-timestamp',
      'text/x-org-planning',
      'text/x-org-property-drawer',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
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