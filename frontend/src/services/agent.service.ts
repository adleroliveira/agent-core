import { DefaultService } from '../api-client/services/DefaultService';

export class AgentService {
  async createAgent(name: string, description: string, systemPrompt?: string, tools?: string[]): Promise<string> {
    try {
      const response = await DefaultService.agentControllerCreateAgent({
        name,
        description,
        systemPrompt,
        tools
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

  async createNewConversation(agentId: string, conversationId?: string) {
    try {
      const response = await DefaultService.agentControllerCreateNewConversation(agentId, conversationId);
      return response;
    } catch (error) {
      console.error('Error creating new conversation:', error);
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

  async getConversationHistory(agentId: string, conversationId: string) {
    try {
      const response = await DefaultService.agentControllerGetConversationHistory(agentId, conversationId);
      
      return response.messages
        .map((message: { role: string; content: string | { text: string } }) => ({
          role: message.role,
          content: typeof message.content === 'string' ? message.content : message.content.text,
          blockType: 'normal' as const,
          isComplete: true
        }))
    } catch (error) {
      console.error('Error loading conversation history:', error);
      throw error;
    }
  }
} 