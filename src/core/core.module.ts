import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './application/agent.service';
import { AdaptersModule, AGENT_SERVICE, PROCESS_REPOSITORY, MESSAGE_REPOSITORY } from '@adapters/adapters.module';
import { WorkspaceConfig } from './config/workspace.config';
import { ProcessManagerService } from './application/process-manager.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessageService } from './services/message.service';
import { MessageRepositoryPort } from '@ports/storage/message-repository.port';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
  ],
  exports: [
    AGENT_SERVICE, 
    WorkspaceConfig, 
    ProcessManagerService,
    MessageService,
  ],
})
export class CoreModule {}