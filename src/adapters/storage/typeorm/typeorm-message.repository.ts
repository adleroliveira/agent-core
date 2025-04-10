import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageRepositoryPort } from '@ports/storage/message-repository.port';
import { MessageEntity } from './entities/message.entity';
import { MessageMapper } from './mappers/message.mapper';
import { Message } from '@core/domain/message.entity';

@Injectable()
export class TypeOrmMessageRepository implements MessageRepositoryPort {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>
  ) {}

  async appendMessages(stateId: string, messages: Message[]): Promise<void> {
    const messageEntities = messages.map(msg => MessageMapper.toPersistence(msg, stateId));
    await this.messageRepository.save(messageEntities);
  }

  async getMessages(
    stateId: string,
    options: {
      limit?: number;
      beforeTimestamp?: Date;
      afterTimestamp?: Date;
      role?: string;
    } = {}
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
  }> {
    const { limit = 20, beforeTimestamp, afterTimestamp, role } = options;

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.stateId = :stateId', { stateId })
      .orderBy('message.createdAt', 'ASC');

    if (beforeTimestamp) {
      queryBuilder.andWhere('message.createdAt < :beforeTimestamp', { beforeTimestamp });
    }

    if (afterTimestamp) {
      queryBuilder.andWhere('message.createdAt > :afterTimestamp', { afterTimestamp });
    }

    if (role) {
      queryBuilder.andWhere('message.role = :role', { role });
    }

    // Get one more message than the limit to determine if there are more
    const messages = await queryBuilder
      .take(limit + 1)
      .getMany();

    // Check if there are more messages
    const hasMore = messages.length > limit;
    
    // If we have more, remove the extra message
    if (hasMore) {
      messages.pop();
    }

    return {
      messages: messages.map(msg => MessageMapper.toDomain(msg)),
      hasMore
    };
  }

  async deleteMessages(stateId: string, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    
    await this.messageRepository
      .createQueryBuilder()
      .delete()
      .where('stateId = :stateId', { stateId })
      .andWhere('id IN (:...messageIds)', { messageIds })
      .execute();
  }

  async updateMessage(message: Message): Promise<void> {
    const messageEntity = MessageMapper.toPersistence(message);
    await this.messageRepository.save(messageEntity);
  }
} 