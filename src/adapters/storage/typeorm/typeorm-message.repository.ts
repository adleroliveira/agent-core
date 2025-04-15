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

  async appendMessages(messages: Message[]): Promise<void> {
    const messageEntities = messages.filter(msg => msg.isNew).map(msg => MessageMapper.toPersistence(msg));
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
    const { limit = 50, beforeTimestamp, afterTimestamp, role } = options;

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.stateId = :stateId', { stateId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'ASC');

    if (beforeTimestamp) {
      queryBuilder.andWhere('message.createdAt < :beforeTimestamp', { beforeTimestamp });
    }

    if (afterTimestamp) {
      queryBuilder.andWhere('message.createdAt > :afterTimestamp', { afterTimestamp });
    }

    if (role) {
      queryBuilder.andWhere('message.role = :role', { role });
    }

    // First, get messages up to the limit
    let messages = await queryBuilder
      .take(limit)
      .getMany();

    // If we have messages, check if the last one is from a user
    if (messages.length > 0 && messages[messages.length - 1].role !== 'user') {
      // If not, get more messages until we find a user message or run out
      const additionalMessages = await queryBuilder
        .skip(limit)
        .take(limit) // Get another batch of messages
        .getMany();

      // Find the first user message in the additional messages
      const firstUserMessageIndex = additionalMessages.findIndex(msg => msg.role === 'user');
      
      if (firstUserMessageIndex !== -1) {
        // If we found a user message, include all messages up to and including it
        messages = [...messages, ...additionalMessages.slice(0, firstUserMessageIndex + 1)];
      } else {
        // If we didn't find a user message, include all additional messages
        messages = [...messages, ...additionalMessages];
      }
    }

    // Check if there are more messages beyond what we've fetched
    const totalCount = await queryBuilder.getCount();
    const hasMore = messages.length < totalCount;

    // Reverse the messages to get them in chronological order
    messages.reverse();

    return {
      messages: messages.map(msg => MessageMapper.toDomain(msg)),
      hasMore
    };
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    
    await this.messageRepository
      .createQueryBuilder()
      .delete()
      .whereInIds(messageIds)
      .execute();
  }

  async updateMessage(message: Message): Promise<void> {
    const messageEntity = MessageMapper.toPersistence(message);
    await this.messageRepository.save(messageEntity);
  }
} 