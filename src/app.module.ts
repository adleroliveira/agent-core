import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './adapters/storage/typeorm/entities/agent.entity';
import { StateEntity } from './adapters/storage/typeorm/entities/state.entity';
import { MessageEntity } from './adapters/storage/typeorm/entities/message.entity';
import { ToolEntity } from './adapters/storage/typeorm/entities/tool.entity';
import { CoreModule } from './core/core.module';
import { AdaptersModule } from './adapters/adapters.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get<string>('DATABASE_TYPE') || 'sqlite';
        
        if (dbType === 'sqlite') {
          const dbPath = configService.get<string>('DATABASE_PATH') || './data/';
          const dbName = configService.get<string>('DATABASE_NAME') || 'agent.sqlite';
          
          return {
            type: 'sqlite',
            database: `${dbPath}${dbName}`,
            entities: [AgentEntity, StateEntity, MessageEntity, ToolEntity],
            synchronize: true, // Set to false in production
          };
        }
        
        // Add other database configurations as needed (PostgreSQL, MySQL, etc.)
        
        return {
          type: 'sqlite', // Default fallback
          database: './data/agent.sqlite',
          entities: [AgentEntity, StateEntity, MessageEntity, ToolEntity],
          synchronize: true,
        };
      },
    }),
    CoreModule,
    AdaptersModule,
    ToolsModule,
  ],
})
export class AppModule {}