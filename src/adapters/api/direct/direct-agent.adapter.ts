import { Injectable } from '@nestjs/common';
import { AgentService } from '@core/application/agent.service';
import { Agent } from '@core/domain/agent.entity';
import { Message } from '@core/domain/message.entity';
import { Tool } from '@core/domain/tool.entity';
import { Prompt } from '@core/domain/prompt.entity';
import { Observable } from 'rxjs';
import { NotFoundException } from '@nestjs/common';
import { StateRepositoryPort } from '@ports/storage/state-repository.port';
import { AgentState } from '@core/domain/agent-state.entity';

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
  conversationHistory?: Message[];
}

/**
 * Direct adapter for integrating the Agent within other applications
 * This provides a programmatic interface to use the agent within the same process
 */
@Injectable()
export class DirectAgentAdapter {
  constructor(
    private readonly agentService: AgentService,
    private readonly stateRepository: StateRepositoryPort
  ) {}

  async createAgent(
    name: string,
    description: string,
    systemPrompt?: string,
    tools?: string[]
  ): Promise<Agent> {
    return this.agentService.createAgent({
      name,
      description,
      systemPromptContent: systemPrompt || "",
      tools
    });
  }

  async getAgent(id: string): Promise<Agent> {
    const agent = await this.agentService.findAgentById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  async getAllAgents(): Promise<Agent[]> {
    return this.agentService.findAllAgents();
  }

  async deleteAgent(id: string): Promise<void> {
    await this.agentService.deleteAgent(id);
  }

  /**
   * Send a message to an agent
   * @param agentId The ID of the agent
   * @param content The message content
   * @param conversationId Optional conversation ID
   * @param options Processing options
   * @returns A message response or an observable stream of message chunks
   */
  async sendMessage(
    agentId: string,
    content: string,
    conversationId?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<Message | Observable<Partial<Message>>> {
    return this.agentService.processMessage(
      agentId,
      content,
      conversationId,
      options
    );
  }

  /**
   * Get the conversation history for an agent
   * @param agentId The ID of the agent
   * @param conversationId Optional conversation ID to get history for a specific conversation
   * @returns The conversation history as an array of messages
   */
  async getConversationHistory(
    agentId: string,
    conversationId?: string
  ): Promise<Message[]> {
    const agent = await this.agentService.findAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    return agent.state?.conversationHistory || [];
  }

  /**
   * Send a message to an agent in non-streaming mode
   * @param agentId The ID of the agent
   * @param content The message content
   * @param conversationId Optional conversation ID
   * @param options Processing options
   * @returns A complete message response
   */
  async sendMessageSync(
    agentId: string,
    message: string,
    conversationId?: string,
    options?: MessageOptions
  ): Promise<Message> {
    const response = await this.agentService.processMessage(
      agentId,
      message,
      conversationId,
      { ...options, stream: false }
    );

    if (response instanceof Observable) {
      throw new Error('Expected non-streaming response but received streaming response');
    }

    return response;
  }

  /**
   * Send a message to an agent in streaming mode
   * @param agentId The ID of the agent
   * @param content The message content
   * @param conversationId Optional conversation ID
   * @param options Processing options
   * @returns An observable stream of message chunks
   */
  async sendMessageStream(
    agentId: string,
    message: string,
    conversationId?: string,
    options?: MessageOptions
  ): Promise<Observable<Message>> {
    const response = await this.agentService.processMessage(
      agentId,
      message,
      conversationId,
      { ...options, stream: true }
    );

    if (!(response instanceof Observable)) {
      throw new Error('Expected streaming response but received non-streaming response');
    }

    return response as Observable<Message>;
  }

  async updateSystemPrompt(agentId: string, promptContent: string): Promise<void> {
    await this.agentService.updateSystemPrompt(agentId, promptContent);
  }

  async addToolToAgent(agentId: string, toolName: string): Promise<void> {
    await this.agentService.addToolToAgent(agentId, toolName);
  }

  async removeToolFromAgent(agentId: string, toolId: string): Promise<void> {
    await this.agentService.removeToolFromAgent(agentId, toolId);
  }

  async resetAgentState(agentId: string): Promise<void> {
    await this.agentService.resetAgentState(agentId);
  }

  /**
   * Get the current conversation ID for an agent
   */
  async getCurrentConversationId(agentId: string): Promise<string | undefined> {
    const state = await this.stateRepository.findByAgentId(agentId);
    return state?.conversationId;
  }

  /**
   * Get all conversation IDs for an agent
   */
  async getConversationIds(agentId: string): Promise<string[]> {
    const states = await this.stateRepository.findAllByAgentId(agentId);
    return states.map((state: AgentState) => state.conversationId).filter(Boolean) as string[];
  }
}
