import { AgentsService } from '../api-client';
import type { SendMessageDto } from '../api-client/models/SendMessageDto';
import { FileInfoDto } from '../api-client/models/FileInfoDto';
import { MessageDto } from '../api-client/models/MessageDto';

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface ToolResult {
  id: string;
  content: string;
}

export class ChatService {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  async sendStreamingMessage(
    content: string,
    stateId: string,
    files: FileInfoDto[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: any) => void,
    stream: boolean
  ): Promise<void> {
    const messageDto: SendMessageDto = {
      content,
      stateId,
      files: files
    };

    try {
        const response = await fetch(`http://localhost:3000/api/agents/${this.agentId}/message?stream=${stream}`, {
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
          if (line.trim()) {
            try {
              const parsedData = JSON.parse(line);
              
              switch (parsedData.type) {
                case 'chunk':
                  // Standardize the chunk data before sending to lexer
                  if (parsedData.data.role === 'tool') {
                    // Handle tool results
                    if (parsedData.data.toolResults && Array.isArray(parsedData.data.toolResults)) {
                      for (const result of parsedData.data.toolResults) {
                        onChunk(JSON.stringify({
                          type: 'TOOL_RESULT',
                          toolInfo: {
                            id: result.toolCallId,
                            name: parsedData.data.toolName,
                            results: result.result
                          }
                        }));
                      }
                    }
                  } else if (parsedData.data.toolCalls && Array.isArray(parsedData.data.toolCalls)) {
                    // Handle tool calls
                    for (const toolCall of parsedData.data.toolCalls) {
                      onChunk(JSON.stringify({
                        type: 'TOOL_CALL',
                        toolInfo: {
                          id: toolCall.id,
                          name: toolCall.name,
                          arguments: toolCall.arguments
                        }
                      }));
                    }
                  } else if (parsedData.data.content) {
                    // Handle regular content
                    onChunk(parsedData.data.content);
                  }
                  break;
                case 'complete':
                  onComplete();
                  return;
                case 'error':
                  onError(parsedData.data);
                  return;
              }
            } catch (error) {
              console.warn('Error parsing chunk:', error);
              onChunk(line);
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