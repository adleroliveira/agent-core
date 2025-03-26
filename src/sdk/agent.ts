import { Agent as AgentEntity } from '@core/domain/agent.entity';
import { Message, MessageContent } from '@core/domain/message.entity';
import { DirectAgentAdapter } from '../adapters/api/direct/direct-agent.adapter';
import { StreamCallbacks } from './types';

export class Agent {
  constructor(
    private entity: AgentEntity,
    private adapter: DirectAgentAdapter
  ) { }

  /**
   * Get agent ID
   */
  get id(): string {
    return this.entity.id;
  }

  /**
   * Get agent name
   */
  get name(): string {
    return this.entity.name;
  }

  /**
   * Send a message to the agent and get a response
   * @returns The full Message entity from the agent's response
   */
  public async ask(message: string, conversationId?: string): Promise<Message> {
    const response = await this.adapter.sendMessageSync(
      this.id,
      message,
      conversationId || this.entity.state?.conversationId
    );

    return response;
  }

  /**
   * Send a message and get just the text content
   * Convenience method if you just want the text
   */
  public async askForText(message: string, conversationId?: string): Promise<string> {
    const response = await this.ask(message, conversationId);
    return response.getTextContent();
  }

  /**
   * Send a message to the agent and get a streaming response
   */
  public async askStream(
    message: string,
    callbacks: StreamCallbacks,
    conversationId?: string
  ): Promise<void> {
    const observable = await this.adapter.sendMessageStream(
      this.id,
      message,
      conversationId || this.entity.state?.conversationId
    );

    return new Promise((resolve, reject) => {
      const subscription = observable.subscribe({
        next: (chunk) => {
          if (chunk.content && callbacks.onChunk) {
            const content = typeof chunk.content === 'string'
              ? chunk.content
              : (chunk.content as MessageContent).text || JSON.stringify(chunk.content);

            callbacks.onChunk(content);
          }

          if (chunk.toolCalls && Array.isArray(chunk.toolCalls) &&
            chunk.toolCalls.length > 0 && callbacks.onToolCall) {
            chunk.toolCalls.forEach(call => callbacks.onToolCall!(call));
          }
        },
        error: (error) => {
          if (callbacks.onError) {
            callbacks.onError(error);
          }
          subscription.unsubscribe();
          reject(error);
        },
        complete: () => {
          if (callbacks.onComplete) {
            callbacks.onComplete();
          }
          subscription.unsubscribe();
          resolve();
        }
      });
    });
  }

  /**
   * Get the current conversation ID
   */
  public getConversationId(): string | undefined {
    return this.entity.state?.conversationId;
  }

  /**
   * Get the conversation history for this agent
   * @param conversationId Optional conversation ID to get history for a specific conversation
   * @returns The conversation history as an array of messages
   */
  public async getConversationHistory(conversationId?: string): Promise<Message[]> {
    return this.adapter.getConversationHistory(this.id, conversationId);
  }
}