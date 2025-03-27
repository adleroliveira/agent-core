import { DefaultService } from '../api-client/services/DefaultService';
import type { SendMessageDto } from '../api-client/models/SendMessageDto';

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface ToolResult {
  id: string;
  content: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isExecutingTool?: boolean;
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
      const response = await fetch(`/api/agents/${this.agentId}/message?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageDto),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body available');
      }

      const reader = response.body.getReader();
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
              onChunk(data);
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