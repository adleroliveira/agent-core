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
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  toolResults?: Array<{
    id: string;
    content: string;
  }>;
  isExecutingTool?: boolean;
}

export class ChatService {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  async sendMessage(content: string, stateId: string): Promise<Message> {
    const messageDto: SendMessageDto = {
      content,
      stateId,
    };

    try {
      const response = await DefaultService.agentControllerSendMessage(
        this.agentId,
        messageDto
      );

      return {
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls?.map(toolCall => ({
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments
        })),
        toolResults: response.toolResults?.map(result => ({
          id: result.id,
          content: result.content
        }))
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendStreamingMessage(
    content: string,
    stateId: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<void> {
    const messageDto: SendMessageDto = {
      content,
      stateId,
    };

    try {
      const response = await fetch(`http://localhost:3000/api/agents/${this.agentId}/message?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: JSON.stringify(messageDto),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
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
              return;
            } else {
              try {
                const parsedData = JSON.parse(data);
                if (parsedData.content) {
                  onChunk(parsedData.content);
                } else if (parsedData.message) {
                  onChunk(parsedData.message);
                } else if (parsedData.choices && parsedData.choices[0]?.delta?.content) {
                  onChunk(parsedData.choices[0].delta.content);
                } else {
                  onChunk(data);
                }
              } catch (error) {
                console.warn('Error parsing chunk:', error);
                onChunk(data);
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