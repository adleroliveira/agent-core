import { Controller, Post, Param, Req, Res, Injectable } from '@nestjs/common';
import { FileUploadService } from '../../../core/services/file-upload.service';
import { FileInfo } from '@ports/file-upload.port';
import { FileUploadResponseDto } from './dto/file-upload.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as busboy from 'busboy';

// Ensure uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * A custom file upload service using busboy
 * This bypasses NestJS's built-in file handling which appears to be problematic in this app
 */
@Injectable()
export class BusboyFileUploadService {
  constructor(private readonly fileValidationService: FileUploadService) {}

  /**
   * Process a file upload using busboy
   */
  async processUpload(
    req: Request, 
    res: Response, 
    type: string
  ): Promise<void> {
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      res.status(400).json({ message: 'Content-Type must be multipart/form-data' });
      return;
    }
    
    try {
      // Create a busboy instance
      const bb = busboy({ headers: req.headers });
      
      // File information
      let fileInfo: FileInfo | null = null;
      let saveFilePath = '';
      
      // Handle file
      bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
        
        // Generate unique filename
        const uniqueId = uuidv4();
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${uniqueId}-${uniqueSuffix}${extname(info.filename)}`;
        saveFilePath = join(uploadsDir, filename);
        
        // Create file meta object
        fileInfo = {
          id: uniqueId,
          filename: filename,
          originalName: info.filename,
          size: 0,
          mimetype: info.mimeType,
        };
        
        // Create a write stream
        const writeStream = fs.createWriteStream(saveFilePath);
        
        // Count bytes for file size
        file.on('data', (data: Buffer) => {
          if (fileInfo) {
            fileInfo.size += data.length;
          }
        });
        
        // Pipe file data to the write stream
        file.pipe(writeStream);
        
        // Handle write errors
        writeStream.on('error', (err: Error) => {
          console.error('Error writing file:', err);
          bb.emit('error', err);
        });
      });
      
      // Handle errors
      bb.on('error', (err: Error) => {
        console.error('Busboy error:', err);
        res.status(400).json({ message: 'File upload error', error: err.message });
      });
      
      // Handle end of parsing
      bb.on('close', () => {
        // No file was provided
        if (!fileInfo) {
          console.error('No file was provided');
          res.status(400).json({ message: 'No file uploaded' });
          return;
        }
        
        try {
          const config = this.fileValidationService.getConfig(type);
          
          // Create a file object compatible with what validateFile expects
          const tempFile: any = {
            originalname: fileInfo.originalName,
            filename: fileInfo.filename,
            path: saveFilePath,
            size: fileInfo.size,
            mimetype: fileInfo.mimetype,
          };
          
          // Validate the file
          if (!this.fileValidationService.validateFile(tempFile, config)) {
            // Delete invalid file
            this.deleteFile(saveFilePath);
            res.status(400).json({ message: 'File is invalid' });
            return;
          }
          
          // Return success response
          res.status(201).json([fileInfo]);
        } catch (error: any) {
          console.error('Error in file validation:', error);
          
          // Clean up the file on error
          this.deleteFile(saveFilePath);
          res.status(400).json({ message: 'Error processing file', error: error.message });
        }
      });
      
      // Pipe the request to busboy
      req.pipe(bb);
    } catch (error: any) {
      console.error('Exception in file upload processor:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
  
  /**
   * Helper method to delete a file
   */
  private deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  }
}

@ApiTags('Files')
@Controller('files')
export class FileUploadController {
  constructor(
    private readonly busboyUploadService: BusboyFileUploadService,
  ) {}

  @Post('upload/:type')
  @ApiOperation({ summary: 'Upload files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'File uploaded successfully',
    type: FileUploadResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async uploadFiles(
    @Param('type') type: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    
    // Delegate to the busboy service
    await this.busboyUploadService.processUpload(req, res, type);
  }
} 