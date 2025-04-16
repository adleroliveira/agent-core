import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './services/agent.service';
import { AdaptersModule } from '@adapters/adapters.module';
import { AGENT_SERVICE, MESSAGE_REPOSITORY } from './injection-tokens';
import { WorkspaceConfig } from './config/workspace.config';
import { ProcessManagerService } from './services/process-manager.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessageService } from './services/message.service';
import { MessageRepositoryPort } from '@ports/storage/message-repository.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileUploadService } from './services/file-upload.service';
import { FileService } from './services/file.service';

@Module({
  imports: [
    forwardRef(() => AdaptersModule),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    {
      provide: AGENT_SERVICE,
      useClass: AgentService,
    },
    WorkspaceConfig,
    ProcessManagerService,
    {
      provide: MessageService,
      useFactory: (messageRepository: MessageRepositoryPort, eventEmitter: EventEmitter2) => {
        return new MessageService(messageRepository, eventEmitter);
      },
      inject: [MESSAGE_REPOSITORY, EventEmitter2],
    },
    FileUploadService,
    FileService,
  ],
  exports: [
    AGENT_SERVICE, 
    WorkspaceConfig, 
    ProcessManagerService,
    MessageService,
    FileUploadService,
    FileService,
  ],
})
export class CoreModule {}