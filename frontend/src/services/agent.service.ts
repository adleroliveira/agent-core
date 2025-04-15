import { AgentsService } from '../api-client/services/AgentsService';

export class FrontendAgentService {
  async createAgent(name: string, description: string, systemPrompt?: string, tools?: string[]): Promise<string> {
    try {
      const response = await AgentsService.agentControllerCreateAgent({
        name,
        description,
        systemPrompt: systemPrompt || '',
        tools
      });

      return response.id;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  async getMemory(agentId: string, conversationId: string) {
    try {
      const response = await AgentsService.agentControllerGetMemory(agentId, conversationId);
      return response;
    } catch (error) {
      console.error('Error fetching memory:', error);
      throw error;
    }
  }

  async setMemory(agentId: string, conversationId: string, memory: Record<string, any>) {
    try {
      const response = await AgentsService.agentControllerSetMemory(agentId, conversationId, memory);
      return response;
    } catch (error) {
      console.error('Error setting memory:', error);  
      throw error;
    }
  }

  async updateMemory(agentId: string, conversationId: string, memory: Record<string, any>) {
    try {
      const response = await AgentsService.agentControllerUpdateMemory(agentId, conversationId, memory);
      return response;
    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    }
  }

  async deleteMemory(agentId: string, conversationId: string) {
    try {
      const response = await AgentsService.agentControllerDeleteMemory(agentId, conversationId);
      return response;
    } catch (error) {
      console.error('Error deleting memory:', error); 
      throw error;
    }
  }

  async deleteMemoryEntry(agentId: string, conversationId: string, key: string) {
    try {
      const response = await AgentsService.agentControllerDeleteMemoryEntry(agentId, conversationId, key);
      return response;
    } catch (error) {
      console.error('Error deleting memory entry:', error);
      throw error;
    }
  }

  async getAgentDetails(agentId: string) {
    try {
      const agent = await AgentsService.agentControllerGetAgent(agentId);
      return agent;
    } catch (error) {
      console.error('Error fetching agent details:', error);
      throw error;
    }
  }

  async createNewConversation(agentId: string, conversationId?: string) {
    try {
      const response = await AgentsService.agentControllerCreateNewConversation(agentId, conversationId);
      return response;
    } catch (error) {
      console.error('Error creating new conversation:', error);
      throw error;
    }
  }

  async deleteConversation(agentId: string, conversationId: string) {
    try {
      const response = await AgentsService.agentControllerDeleteConversation(agentId, conversationId);
      return response;
    } catch (error) {
      console.error('Error deleting conversation:', error); 
      throw error;
    }
  }

  async getConversations(agentId: string) {
    try {
      const response = await AgentsService.agentControllerGetConversations(agentId);
      return response;
    } catch (error) {
      console.error('Error loading conversations:', error);
      throw error;
    }
  }

  async getConversationHistory(agentId: string, conversationId: string) {
    try {
      const response = await AgentsService.agentControllerGetConversationHistory(agentId, conversationId);
      
      return (response?.messages || [])
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