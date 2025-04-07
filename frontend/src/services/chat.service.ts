import { DefaultService } from '../api-client/services/DefaultService';
import type { SendMessageDto } from '../api-client/models/SendMessageDto';
import { SessionService } from './session.service';

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
  private sessionService: SessionService;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.sessionService = new SessionService();
  }

  public getSessionId(): string {
    return this.sessionService.getSessionId();
  }

  async sendMessage(content: string, stream: boolean = true): Promise<Message> {
    const messageDto: SendMessageDto = {
      content,
      conversationId: this.sessionService.getSessionId()
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
      conversationId: this.sessionService.getSessionId()
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
              onChunk('[DONE]');
              onComplete();
            } else {
              try {
                // Parse the JSON data
                const parsedData = JSON.parse(data);
                
                // Handle tool calls
                if (parsedData.toolCalls && Array.isArray(parsedData.toolCalls)) {
                  for (const toolCall of parsedData.toolCalls) {
                    // Emit a tool call token
                    onChunk(JSON.stringify({
                      type: 'TOOL_CALL',
                      toolInfo: {
                        name: toolCall.name,
                        id: toolCall.id,
                        arguments: toolCall.arguments
                      }
                    }));
                  }
                }
                
                // Handle tool results
                if (parsedData.content && typeof parsedData.content === 'string' && 
                    parsedData.content.includes('Tool') && parsedData.content.includes('result:')) {
                  onChunk(JSON.stringify({
                    type: 'TOOL_RESULT',
                    value: parsedData.content
                  }));
                }
                
                // Handle regular content
                if (parsedData.content && typeof parsedData.content === 'string') {
                  onChunk(parsedData.content);
                }
              } catch (error) {
                console.warn('Error parsing chunk:', error);
                // If parsing fails, pass the raw data
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

  public resetConversation(): void {
    this.sessionService.resetSession();
  }
} 