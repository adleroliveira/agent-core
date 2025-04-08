import { create } from 'zustand';
import { ChatService } from '../services/chat.service';
import { AgentService } from '../services/agent.service';

interface Conversation {
  id: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ExtendedMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  thinking?: string;
  blockType: 'normal' | 'thinking' | 'tool';
  isComplete: boolean;
  toolName?: string;
}

interface ChatStore {
  // State
  messages: ExtendedMessage[];
  inputMessage: string;
  isStreaming: boolean;
  isLoading: boolean;
  isUsingTool: boolean;
  showThinkingBubbles: boolean;
  agentName: string;
  conversations: Conversation[];
  activeConversationId: string;
  chatService: ChatService | null;
  agentService: AgentService | null;
  sessionId: string;
  conversationTitle: string;
  conversationId: string | null;
  conversationMemory: Record<string, any>;
  conversationTtl: number;
  currentBlockType: 'normal' | 'thinking' | 'tool' | null;
  agentId: string | undefined;

  // Actions
  setMessages: (newMessages: ExtendedMessage[]) => void;
  setInputMessage: (message: string) => void;
  setIsStreaming: (isStreamingValue: boolean) => void;
  setIsLoading: (isLoadingValue: boolean) => void;
  setIsUsingTool: (isUsingToolValue: boolean) => void;
  setShowThinkingBubbles: (show: boolean) => void;
  setAgentName: (name: string) => void;
  setConversations: (newConversations: Conversation[]) => void;
  setActiveConversationId: (id: string) => void;
  setChatService: (service: ChatService) => void;
  setAgentService: (service: AgentService) => void;
  setSessionId: (id: string) => void;
  setConversationTitle: (title: string) => void;
  setConversationId: (id: string | null) => void;
  setConversationMemory: (memory: Record<string, any>) => void;
  setConversationTtl: (ttl: number) => void;
  setCurrentBlockType: (type: 'normal' | 'thinking' | 'tool' | null) => void;
  setAgentId: (id: string) => void;
  addMessage: (message: ExtendedMessage) => void;
  updateLastMessage: (updater: (message: ExtendedMessage) => ExtendedMessage) => void;
  resetConversation: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  initializeConversations: () => Promise<void>;
}

// Create the store
const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  messages: [],
  inputMessage: '',
  isStreaming: true,
  isLoading: false,
  isUsingTool: false,
  showThinkingBubbles: true,
  agentName: '',
  conversations: [],
  activeConversationId: '',
  chatService: null,
  agentService: null,
  sessionId: '',
  conversationTitle: 'New Conversation',
  conversationId: null,
  conversationMemory: {},
  conversationTtl: 0,
  currentBlockType: null,
  agentId: undefined,

  // Actions
  setMessages: (newMessages) => set({ messages: [...newMessages] }),
  setInputMessage: (message) => set({ inputMessage: message }),
  setIsStreaming: (isStreamingValue) => set({ isStreaming: isStreamingValue }),
  setIsLoading: (isLoadingValue) => set({ isLoading: isLoadingValue }),
  setIsUsingTool: (isUsingToolValue) => set({ isUsingTool: isUsingToolValue }),
  setShowThinkingBubbles: (show) => set({ showThinkingBubbles: show }),
  setAgentName: (name) => set({ agentName: name }),
  setConversations: (newConversations) => set({ conversations: [...newConversations] }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setChatService: (service) => set({ chatService: service }),
  setAgentService: (service) => set({ agentService: service }),
  setSessionId: (id) => set({ sessionId: id }),
  setConversationTitle: (title) => set({ conversationTitle: title }),
  setConversationId: (id) => set({ conversationId: id }),
  setConversationMemory: (memory) => set({ conversationMemory: memory }),
  setConversationTtl: (ttl) => set({ conversationTtl: ttl }),
  setCurrentBlockType: (type) => set({ currentBlockType: type }),
  setAgentId: (id) => set({ agentId: id }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateLastMessage: (updater) => set((state) => {
    const currentMessages = [...state.messages];
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (lastMessage) {
      currentMessages[currentMessages.length - 1] = updater(lastMessage);
      return { messages: currentMessages };
    }
    return state;
  }),

  resetConversation: async () => {
    const { agentId, agentService, setMessages, setConversationMemory, setConversations, setActiveConversationId } = get();
    if (!agentId || !agentService) return;

    try {
      // Create a new conversation
      await agentService.createNewConversation(agentId);

      // Clear the chat messages
      setMessages([]);
      setConversationMemory({});

      // Reload conversations and set the newest one as active
      const conversationsList = await agentService.getConversations(agentId);
      setConversations(conversationsList);

      // Set the active conversation to the newest one
      if (conversationsList.length > 0) {
        setActiveConversationId(conversationsList[0].conversationId);
      }
    } catch (error) {
      console.error("Error resetting conversation:", error);
    }
  },

  loadConversation: async (conversationId) => {
    const { agentId, agentService, setActiveConversationId, setMessages } = get();
    if (!agentId || !agentService) return;

    try {
      // Set the active conversation
      setActiveConversationId(conversationId);

      // Load conversation history
      const history = await agentService.getConversationHistory(agentId, conversationId);

      // Process messages to handle thinking tags and tool messages
      const processedMessages: ExtendedMessage[] = [];
      
      for (const message of history) {
        // Handle tool messages
        if (message.role === 'tool') {
          processedMessages.push({
            ...message,
            blockType: 'tool' as const,
            isComplete: true
          });
          continue;
        }

        // Parse thinking tags in the content
        const thinkingRegex = /<thinking>(.*?)<\/thinking>/gs;
        let lastIndex = 0;
        let match;
        let content = message.content || '';

        while ((match = thinkingRegex.exec(content)) !== null) {
          // Add any content before the thinking tag as a normal message
          if (match.index > lastIndex) {
            processedMessages.push({
              role: message.role,
              content: content.slice(lastIndex, match.index).trim(),
              blockType: 'normal' as const,
              isComplete: true
            });
          }

          // Add the thinking content as a separate message
          processedMessages.push({
            role: message.role,
            content: '',
            thinking: match[1].trim(),
            blockType: 'thinking' as const,
            isComplete: true
          });

          lastIndex = match.index + match[0].length;
        }

        // Add any remaining content after the last thinking tag
        if (lastIndex < content.length) {
          const remainingContent = content.slice(lastIndex).trim();
          if (remainingContent) {
            processedMessages.push({
              role: message.role,
              content: remainingContent,
              blockType: 'normal' as const,
              isComplete: true
            });
          }
        }
      }
      
      // Update messages using the setter method
      setMessages(processedMessages);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  },

  initializeConversations: async () => {
    const { agentId, agentService, setConversations, loadConversation } = get();
    if (!agentId || !agentService) return;

    try {
      // Load conversations
      const conversationsList = await agentService.getConversations(agentId);
      setConversations(conversationsList);

      // Set the active conversation to the newest one
      if (conversationsList.length > 0) {
        await loadConversation(conversationsList[0].conversationId);
      }
    } catch (error) {
      console.error("Error initializing conversations:", error);
    }
  }
}));

export { useChatStore }; 