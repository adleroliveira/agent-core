import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response, NextFunction, json, urlencoded } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Ensure data directory exists
  const dataDir = path.resolve('./data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Ensure uploads directory exists
  const uploadsDir = path.resolve('./uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Create app with specific rawBody config
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false, // Disable built-in body parser
  });

  // Configure body parsing middleware
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  
  // Skip body parsing for multipart requests to let multer/busboy handle them
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      next();
    } else {
      json()(req, res, next);
    }
  });
  
  // Get configuration
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  
  // Enable CORS
  app.enableCors();
  
  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: true,
      skipNullProperties: true,
      skipUndefinedProperties: true,
    }),
  );
  
  // Add global prefix
  app.setGlobalPrefix('api');

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Agent Core API')
    .setDescription('The Agent Core API description')
    .setVersion('1.0')
    .addTag('agents')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  // Export OpenAPI specification
  fs.writeFileSync(
    path.resolve('./openapi.json'),
    JSON.stringify(document, null, 2)
  );
  
  // Serve static files from the public directory
  app.useStaticAssets(path.join(__dirname, '../dist/public'), {
    index: false,
  });

  // Serve index.html for all other routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip middleware for API requests and multipart/form-data
    if (req.path.startsWith('/api') || req.headers['content-type']?.includes('multipart/form-data')) {
      return next();
    }
    
    // Serve SPA for all other routes
    res.sendFile(path.join(__dirname, '../dist/public/index.html'));
  });
  
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation is available at: http://localhost:${port}/api/docs`);
}

bootstrap();