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

  // ... other methods ...
} 