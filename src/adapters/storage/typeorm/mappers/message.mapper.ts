import {
  Message,
  MessageRole,
  MessageContent,
  ToolCall,
} from "@core/domain/message.entity";
import { MessageEntity } from "../entities/message.entity";

export class MessageMapper {
  static toDomain(entity: MessageEntity): Message {
    // Parse content if it's a JSON string
    let parsedContent: string | MessageContent = entity.content;
    try {
      if (entity.content.startsWith("{")) {
        parsedContent = JSON.parse(entity.content) as MessageContent;
      }
    } catch (e) {
      // If parsing fails, keep original string content
      parsedContent = entity.content;
    }

    // Parse metadata if it exists
    let parsedMetadata: Record<string, any> | undefined = undefined;
    if (entity.metadata) {
      try {
        parsedMetadata = JSON.parse(entity.metadata);
      } catch (e) {
        // If parsing fails, leave as undefined
      }
    }

    // Parse toolCalls if it exists
    let parsedToolCalls: ToolCall[] | undefined = undefined;
    if (entity.toolCalls) {
      try {
        parsedToolCalls = JSON.parse(entity.toolCalls) as ToolCall[];
      } catch (e) {
        // If parsing fails, leave as undefined
      }
    }

    return new Message({
      id: entity.id,
      role: entity.role as MessageRole,
      content: parsedContent,
      stateId: entity.stateId,
      metadata: parsedMetadata,
      toolCalls: parsedToolCalls,
      toolCallId: entity.toolCallId || undefined, // Convert null to undefined
      toolName: entity.toolName || undefined, // Convert null to undefined
      isStreaming: entity.isStreaming,
    });
  }

  static toPersistence(domain: Message): MessageEntity {
    const entity = new MessageEntity();
    entity.id = domain.id;
    entity.role = domain.role;

    // Stringify content if it's an object
    entity.content =
      typeof domain.content === "object"
        ? JSON.stringify(domain.content)
        : domain.content;

    entity.stateId = domain.stateId;

    // Stringify metadata if it exists
    entity.metadata = domain.metadata ? JSON.stringify(domain.metadata) : null;

    // Stringify toolCalls if it exists
    entity.toolCalls = domain.toolCalls
      ? JSON.stringify(domain.toolCalls)
      : null;

    // Convert undefined to null for database storage
    entity.toolCallId = domain.toolCallId || null;
    entity.toolName = domain.toolName || null;
    entity.isStreaming = domain.isStreaming || false;

    entity.createdAt = domain.createdAt;

    return entity;
  }
}
