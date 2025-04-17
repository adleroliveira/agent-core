import { Injectable } from '@nestjs/common';

@Injectable()
export class MimeTypeService {
  private readonly mimeTypeMap: { [key: string]: string } = {
    // Office Documents
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    
    // PDF
    '.pdf': 'application/pdf',
    
    // Text Files
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    
    // Programming Files
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.cs': 'text/x-csharp',
    '.php': 'text/x-php',
    '.rb': 'text/x-ruby',
    '.pl': 'text/x-perl',
    '.sh': 'text/x-shellscript',
    
    // Configuration Files
    '.yaml': 'text/x-yaml',
    '.yml': 'text/x-yaml',
    '.toml': 'text/x-toml',
    '.ini': 'text/x-ini',
    '.properties': 'text/x-properties',
    
    // Documentation
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.rst': 'text/x-rst',
    '.asciidoc': 'text/x-asciidoc',
    '.org': 'text/x-org',
    
    // Other Text Formats
    '.log': 'text/x-log',
    '.diff': 'text/x-diff',
    '.patch': 'text/x-patch',
    '.tex': 'text/x-tex',
    '.latex': 'text/x-latex',
    '.bibtex': 'text/x-bibtex'
  };

  /**
   * Get the MIME type for a file based on its extension
   * @param filename The filename or extension to get the MIME type for
   * @param fallbackMimeType Optional fallback MIME type if no mapping is found
   * @returns The MIME type for the file
   */
  getMimeType(filename: string, fallbackMimeType?: string): string {
    const ext = filename.toLowerCase();
    const extension = ext.startsWith('.') ? ext : `.${ext}`;
    return this.mimeTypeMap[extension] || fallbackMimeType || 'application/octet-stream';
  }

  /**
   * Check if a MIME type is allowed
   * @param mimeType The MIME type to check
   * @param allowedMimeTypes Array of allowed MIME types
   * @returns True if the MIME type is allowed
   */
  isMimeTypeAllowed(mimeType: string, allowedMimeTypes: string[]): boolean {
    return allowedMimeTypes.includes(mimeType);
  }
} 