import { AgentService } from '../api-client/services/AgentService';

export class FrontendAgentService {
  async createAgent(name: string, description: string, systemPrompt?: string, tools?: string[]): Promise<string> {
    try {
      const response = await AgentService.agentControllerCreateAgent({
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
      const agent = await AgentService.agentControllerGetAgent(agentId);
      return agent;
    } catch (error) {
      console.error('Error fetching agent details:', error);
      throw error;
    }
  }

  async createNewConversation(agentId: string, conversationId?: string) {
    try {
      const response = await AgentService.agentControllerCreateNewConversation(agentId, conversationId);
      return response;
    } catch (error) {
      console.error('Error creating new conversation:', error);
      throw error;
    }
  }

  async deleteConversation(agentId: string, conversationId: string) {
    try {
      const response = await AgentService.agentControllerDeleteConversation(agentId, conversationId);
      return response;
    } catch (error) {
      console.error('Error deleting conversation:', error); 
      throw error;
    }
  }

  async getConversations(agentId: string) {
    try {
      const response = await AgentService.agentControllerGetConversations(agentId);
      return response;
    } catch (error) {
      console.error('Error loading conversations:', error);
      throw error;
    }
  }

  async getConversationHistory(agentId: string, conversationId: string) {
    try {
      const response = await AgentService.agentControllerGetConversationHistory(agentId, conversationId);
      
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