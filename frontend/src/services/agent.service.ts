import { DefaultService } from '../api-client/services/DefaultService';
import { SessionService } from './session.service';

export class AgentService {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  async createAgent(name: string, description: string, systemPrompt?: string, tools?: string[]): Promise<string> {
    try {
      const response = await DefaultService.agentControllerCreateAgent({
        name,
        description,
        systemPrompt,
        tools,
        conversationId: this.sessionService.getSessionId()
      });

      return response.id;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  async getAgentDetails(agentId: string) {
    try {
      const agent = await DefaultService.agentControllerGetAgent(agentId);
      return agent;
    } catch (error) {
      console.error('Error fetching agent details:', error);
      throw error;
    }
  }

  async resetAgentState(agentId: string) {
    try {
      await DefaultService.agentControllerResetState(agentId);
    } catch (error) {
      console.error('Error resetting agent state:', error);
      throw error;
    }
  }

  async getConversations(agentId: string) {
    try {
      const response = await DefaultService.agentControllerGetConversations(agentId);
      return response;
    } catch (error) {
      console.error('Error loading conversations:', error);
      throw error;
    }
  }
} 