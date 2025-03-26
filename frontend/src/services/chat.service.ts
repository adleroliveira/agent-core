import { DefaultService } from '../api-client/services/DefaultService';
import type { SendMessageDto } from '../api-client/models/SendMessageDto';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatService {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  async sendMessage(content: string, stream: boolean = true): Promise<Message> {
    const messageDto: SendMessageDto = {
      content,
    };

    try {
      const response = await DefaultService.agentControllerSendMessage(
        this.agentId,
        stream.toString(),
        messageDto
      );

      return {
        role: 'assistant',
        content: response.content,
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendStreamingMessage(
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<void> {
    const messageDto: SendMessageDto = {
      content,
    };

    try {
      const response = await DefaultService.agentControllerSendMessage(
        this.agentId,
        'true',
        messageDto
      );

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  onChunk(parsed.content);
                }
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in streaming message:', error);
      onError(error);
    }
  }
} 