import { Message } from '@core/domain/message.entity';

export interface MessageRepositoryPort {
  appendMessages(stateId: string, messages: Message[]): Promise<void>;
  getMessages(stateId: string, options?: {
    limit?: number;
    beforeTimestamp?: Date;
    afterTimestamp?: Date;
    role?: string;
  }): Promise<{
    messages: Message[];
    hasMore: boolean;
  }>;
  deleteMessages(stateId: string, messageIds: string[]): Promise<void>;
  updateMessage(message: Message): Promise<void>;
} 