export interface FileInfo {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

export interface FileUploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  maxFiles?: number;
  destination?: string;
}

export interface FileUploadOptions {
  [key: string]: FileUploadConfig;
} 