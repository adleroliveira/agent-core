import { Message } from '@core/domain/message.entity';

export interface MessageRepositoryPort {
  appendMessages(messages: Message[]): Promise<void>;
  getMessages(conversationId: string, options?: {
    limit?: number;
    beforeTimestamp?: Date;
    afterTimestamp?: Date;
    role?: string;
  }): Promise<{
    messages: Message[];
    hasMore: boolean;
  }>;
  deleteMessages(messageIds: string[]): Promise<void>;
  updateMessage(message: Message): Promise<void>;
} 