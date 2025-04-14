import { Injectable, Inject } from '@nestjs/common';
import { MessageRepositoryPort } from '@ports/storage/message-repository.port';
import { Message } from '@core/domain/message.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MESSAGE_REPOSITORY } from "@core/injection-tokens";

export class MessageAppendedEvent {
  constructor(public readonly message: Message) {}
}

export class MessageUpdatedEvent {
  constructor(public readonly message: Message) {}
}

export class MessageDeletedEvent {
  constructor(public readonly messageIds: string[]) {}
}

@Injectable()
export class MessageService {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepositoryPort,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async appendMessages(messages: Message[]): Promise<void> {
    await this.messageRepository.appendMessages(messages);
    
    // Emit events for each message
    for (const message of messages) {
      await this.eventEmitter.emitAsync('message.appended', new MessageAppendedEvent(message));
    }
  }

  async getMessages(
    stateId: string,
    options?: {
      limit?: number;
      beforeTimestamp?: Date;
      afterTimestamp?: Date;
      role?: string;
    }
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
  }> {
    return this.messageRepository.getMessages(stateId, options);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    await this.messageRepository.deleteMessages(messageIds);
    await this.eventEmitter.emitAsync('message.deleted', new MessageDeletedEvent(messageIds));
  }

  async updateMessage(message: Message): Promise<void> {
    await this.messageRepository.updateMessage(message);
    await this.eventEmitter.emitAsync('message.updated', new MessageUpdatedEvent(message));
  }
} 