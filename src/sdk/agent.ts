import { Agent as AgentEntity } from '@core/domain/agent.entity';
import { Message, MessageContent } from '@core/domain/message.entity';
import { DirectAgentAdapter } from '../adapters/api/direct/direct-agent.adapter';
import { StreamCallbacks } from './types';
import { MCPTool } from '@core/domain/mcp-tool.entity';
import { Prompt } from '@core/domain/prompt.entity';

export interface MessageOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /**
   * Number of past interactions (message pairs) to include in the context.
   * For example, a value of 5 means the last 5 user-assistant message pairs will be included.
   * Defaults to the value of AGENT_MEMORY_SIZE environment variable or 10.
   */
  memorySize?: number;
}

export class Agent {
  private _memorySize?: number;
  private _conversationId?: string;

  constructor(
    private entity: AgentEntity,
    private adapter: DirectAgentAdapter
  ) {
    this._conversationId = entity.getMostRecentState().id;
  }

  get mostRecentStateId(): string {
    return this.entity.getMostRecentState().id;
  }

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
   * Get agent description
   */
  get description(): string | undefined {
    return this.entity.description;
  }

  /**
   * Get agent model ID
   */
  get modelId(): string {
    return this.entity.modelId;
  }

  /**
   * Set the number of past interactions to include in future messages
   * @param size Number of past interactions (message pairs) to include
   */
  setMemorySize(size?: number): void {
    this._memorySize = size;
  }

  /**
   * Send a message to the agent and get a response
   * @returns The full Message entity from the agent's response
   */
  public async ask(
    message: string,
    options?: MessageOptions & { conversationId?: string }
  ): Promise<Message> {
    const response = await this.adapter.sendMessageSync(
      this.id,
      message,
      options?.conversationId || this._conversationId,
      {
        ...options,
        memorySize: options?.memorySize || this._memorySize
      }
    );

    return response;
  }

  /**
   * Send a message and get just the text content
   * Convenience method if you just want the text
   */
  public async askForText(
    message: string,
    options?: MessageOptions & { conversationId?: string }
  ): Promise<string> {
    const response = await this.ask(message, { ...options, conversationId: this._conversationId ? this._conversationId : options?.conversationId });
    return response.getTextContent();
  }

  /**
   * Send a message to the agent and get a streaming response
   */
  public async askStream(
    message: string,
    callbacks: StreamCallbacks,
    options?: MessageOptions & { conversationId?: string }
  ): Promise<void> {
    const observable = await this.adapter.sendMessageStream(
      this.id,
      message,
      options?.conversationId || this._conversationId,
      {
        ...options,
        memorySize: options?.memorySize || this._memorySize
      }
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
   * Create a new conversation
   * @returns The ID of the new conversation
   */
  public async createNewConversation(): Promise<string> {
    this._conversationId = await this.adapter.createNewConversation(this.id);
    return this._conversationId;
  }

  /**
   * Get the current conversation ID
   */
  public async getConversationId(): Promise<string | undefined> {
    return this._conversationId;
  }

  /**
   * Get the conversation history for this agent
   * @param conversationId Optional conversation ID to get history for a specific conversation
   * @returns The conversation history as an array of messages
   */
  public async getConversationHistory(conversationId?: string): Promise<Message[]> {
    return this.adapter.getConversationHistory(this.id, conversationId);
  }

  /**
   * Get all available conversation IDs for this agent
   */
  public async getConversationIds(): Promise<string[]> {
    return this.adapter.getConversationIds(this.id);
  }

  /**
   * Add a tool to the agent
   * @param tool The tool to add
   */
  public async addTool(tool: MCPTool): Promise<void> {
    await this.adapter.addToolToAgent(this.id, tool.id);
  }

  /**
   * Remove a tool from the agent
   * @param toolId The ID of the tool to remove
   */
  public async removeTool(toolId: string): Promise<void> {
    await this.adapter.removeToolFromAgent(this.id, toolId);
  }

  /**
   * Update the agent's system prompt
   * @param promptContent The new system prompt content
   */
  public async updateSystemPrompt(promptContent: string): Promise<void> {
    await this.adapter.updateSystemPrompt(this.id, promptContent);
  }

  /**
   * Reset the agent's state
   */
  public async resetState(): Promise<void> {
    await this.adapter.resetAgentState(this.id);
  }

  /**
   * Get all tools registered with this agent
   */
  public getTools(): MCPTool[] {
    return this.entity.tools;
  }

  /**
   * Get the agent's system prompt
   */
  public getSystemPrompt(): Prompt {
    return this.entity.systemPrompt;
  }
}