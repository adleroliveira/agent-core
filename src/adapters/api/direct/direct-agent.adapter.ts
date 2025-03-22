import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { Observable } from "rxjs";
import { AgentService } from "@core/application/agent.service";
import { Agent } from "@core/domain/agent.entity";
import { Message } from "@core/domain/message.entity";

/**
 * Direct adapter for integrating the Agent within other applications
 * This provides a programmatic interface to use the agent within the same process
 */
@Injectable()
export class DirectAgentAdapter {
  constructor(
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService
  ) {}

  async createAgent(params: {
    name: string;
    description?: string;
    modelId?: string;
    systemPromptContent: string;
    tools?: string[];
  }): Promise<Agent> {
    return this.agentService.createAgent(params);
  }

  async getAgent(id: string): Promise<Agent> {
    return this.agentService.findAgentById(id);
  }

  async getAllAgents(): Promise<Agent[]> {
    return this.agentService.findAllAgents();
  }

  async deleteAgent(id: string): Promise<boolean> {
    return this.agentService.deleteAgent(id);
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
   * Send a message to an agent in non-streaming mode
   * @param agentId The ID of the agent
   * @param content The message content
   * @param conversationId Optional conversation ID
   * @param options Processing options
   * @returns A complete message response
   */
  async sendMessageSync(
    agentId: string,
    content: string,
    conversationId?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<Message> {
    const response = await this.agentService.processMessage(
      agentId,
      content,
      conversationId,
      { ...options, stream: false }
    );

    // Ensure we received a Message object, not an Observable
    if (response instanceof Observable) {
      throw new Error(
        "Expected non-streaming response but received streaming response"
      );
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
    content: string,
    conversationId?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<Observable<Partial<Message>>> {
    const response = await this.agentService.processMessage(
      agentId,
      content,
      conversationId,
      { ...options, stream: true }
    );

    // Ensure we received an Observable, not a Message
    if (!(response instanceof Observable)) {
      throw new Error(
        "Expected streaming response but received non-streaming response"
      );
    }

    return response;
  }

  async updateSystemPrompt(agentId: string, content: string): Promise<Agent> {
    return this.agentService.updateSystemPrompt(agentId, content);
  }

  async addTool(agentId: string, toolName: string): Promise<Agent> {
    return this.agentService.addToolToAgent(agentId, toolName);
  }

  async removeTool(agentId: string, toolId: string): Promise<Agent> {
    return this.agentService.removeToolFromAgent(agentId, toolId);
  }

  async resetState(agentId: string): Promise<Agent> {
    return this.agentService.resetAgentState(agentId);
  }
}
