import { createContext } from 'preact';
import { useContext, useReducer } from 'preact/hooks';
import { ChatService } from '../services/chat.service';
import { AgentService } from '../services/agent.service';

interface Conversation {
  id: string;
  stateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtendedMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  thinking?: string;
  blockType: 'normal' | 'thinking' | 'tool';
  isComplete: boolean;
  toolName?: string;
}

interface ChatState {
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
  isStreamingActive: boolean;
}

type ChatAction =
  | { type: 'SET_MESSAGES'; payload: ExtendedMessage[] }
  | { type: 'SET_INPUT_MESSAGE'; payload: string }
  | { type: 'SET_IS_STREAMING'; payload: boolean }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_IS_USING_TOOL'; payload: boolean }
  | { type: 'SET_SHOW_THINKING_BUBBLES'; payload: boolean }
  | { type: 'SET_AGENT_NAME'; payload: string }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_ACTIVE_CONVERSATION_ID'; payload: string }
  | { type: 'SET_CHAT_SERVICE'; payload: ChatService }
  | { type: 'SET_AGENT_SERVICE'; payload: AgentService }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_CONVERSATION_TITLE'; payload: string }
  | { type: 'SET_CONVERSATION_ID'; payload: string | null }
  | { type: 'SET_CONVERSATION_MEMORY'; payload: Record<string, any> }
  | { type: 'SET_CONVERSATION_TTL'; payload: number }
  | { type: 'SET_CURRENT_BLOCK_TYPE'; payload: 'normal' | 'thinking' | 'tool' | null }
  | { type: 'SET_AGENT_ID'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: ExtendedMessage }
  | { type: 'UPDATE_LAST_MESSAGE'; payload: (message: ExtendedMessage) => ExtendedMessage }
  | { type: 'SET_IS_STREAMING_ACTIVE'; payload: boolean }
  | { type: 'CLEAR_CURRENT_MESSAGE_REF'; payload: null };

const initialState: ChatState = {
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
  isStreamingActive: false,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: [...action.payload] };
    case 'SET_INPUT_MESSAGE':
      return { ...state, inputMessage: action.payload };
    case 'SET_IS_STREAMING':
      return { ...state, isStreaming: action.payload };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_IS_USING_TOOL':
      return { ...state, isUsingTool: action.payload };
    case 'SET_SHOW_THINKING_BUBBLES':
      return { ...state, showThinkingBubbles: action.payload };
    case 'SET_AGENT_NAME':
      return { ...state, agentName: action.payload };
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: [...action.payload] };
    case 'SET_ACTIVE_CONVERSATION_ID':
      return { ...state, activeConversationId: action.payload };
    case 'SET_CHAT_SERVICE':
      return { ...state, chatService: action.payload };
    case 'SET_AGENT_SERVICE':
      return { ...state, agentService: action.payload };
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'SET_CONVERSATION_TITLE':
      return { ...state, conversationTitle: action.payload };
    case 'SET_CONVERSATION_ID':
      return { ...state, conversationId: action.payload };
    case 'SET_CONVERSATION_MEMORY':
      return { ...state, conversationMemory: action.payload };
    case 'SET_CONVERSATION_TTL':
      return { ...state, conversationTtl: action.payload };
    case 'SET_CURRENT_BLOCK_TYPE':
      return { ...state, currentBlockType: action.payload };
    case 'SET_AGENT_ID':
      return { ...state, agentId: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_LAST_MESSAGE': {
      if (state.messages.length === 0) return state;

      const newMessages = [...state.messages];
      const lastMessage = newMessages[newMessages.length - 1];
      const updatedMessage = action.payload(lastMessage);

      if (lastMessage.role === updatedMessage.role &&
        lastMessage.blockType === updatedMessage.blockType) {
        newMessages[newMessages.length - 1] = updatedMessage;
        return { ...state, messages: newMessages };
      }

      return { ...state, messages: [...state.messages, updatedMessage] };
    }
    case 'SET_IS_STREAMING_ACTIVE':
      return { ...state, isStreamingActive: action.payload };
    case 'CLEAR_CURRENT_MESSAGE_REF':
      return { ...state, messages: [], currentBlockType: null };
    default:
      return state;
  }
}

const ChatContext = createContext<{
  state: ChatState;
  dispatch: (action: ChatAction) => void;
  loadConversation: (agentId: string, conversationId: string, agentService: AgentService) => Promise<void>;
  initializeConversations: (agentId: string, agentService: AgentService) => Promise<void>;
  refreshConversations: (agentId: string, agentService: AgentService) => Promise<void>;
  resetState: () => void;
} | null>(null);

export function ChatProvider({ children }: { children: preact.ComponentChildren }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const resetState = () => {
    dispatch({ type: 'SET_MESSAGES', payload: [] });
    dispatch({ type: 'SET_INPUT_MESSAGE', payload: '' });
    dispatch({ type: 'SET_IS_STREAMING', payload: true });
    dispatch({ type: 'SET_IS_LOADING', payload: false });
    dispatch({ type: 'SET_IS_USING_TOOL', payload: false });
    dispatch({ type: 'SET_SHOW_THINKING_BUBBLES', payload: true });
    dispatch({ type: 'SET_AGENT_NAME', payload: '' });
    dispatch({ type: 'SET_CONVERSATIONS', payload: [] });
    dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: '' });
    dispatch({ type: 'SET_CHAT_SERVICE', payload: null as unknown as ChatService });
    dispatch({ type: 'SET_AGENT_SERVICE', payload: null as unknown as AgentService });
    dispatch({ type: 'SET_SESSION_ID', payload: '' });
    dispatch({ type: 'SET_CONVERSATION_TITLE', payload: 'New Conversation' });
    dispatch({ type: 'SET_CONVERSATION_ID', payload: null });
    dispatch({ type: 'SET_CONVERSATION_MEMORY', payload: {} });
    dispatch({ type: 'SET_CONVERSATION_TTL', payload: 0 });
    dispatch({ type: 'SET_CURRENT_BLOCK_TYPE', payload: null });
    dispatch({ type: 'SET_AGENT_ID', payload: '' });
    dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: false });
  };

  const loadConversation = async (agentId: string, conversationId: string, agentService: AgentService) => {
    if (!agentService || state.isStreamingActive) {
      return;
    }

    try {
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      dispatch({ type: 'CLEAR_CURRENT_MESSAGE_REF', payload: null });
      dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: conversationId });

      const history = await agentService.getConversationHistory(agentId, conversationId);
      const processedMessages: ExtendedMessage[] = [];

      for (const message of history) {
        if (message.role === 'tool') {
          processedMessages.push({
            ...message,
            blockType: 'tool' as const,
            isComplete: true
          });
          continue;
        }

        const thinkingRegex = /<thinking>(.*?)<\/thinking>/gs;
        let lastIndex = 0;
        let match;
        let content = message.content || '';

        while ((match = thinkingRegex.exec(content)) !== null) {
          if (match.index > lastIndex) {
            processedMessages.push({
              role: message.role,
              content: content.slice(lastIndex, match.index).trim(),
              blockType: 'normal' as const,
              isComplete: true
            });
          }

          processedMessages.push({
            role: message.role,
            content: '',
            thinking: match[1].trim(),
            blockType: 'thinking' as const,
            isComplete: true
          });

          lastIndex = match.index + match[0].length;
        }

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

      dispatch({ type: 'SET_MESSAGES', payload: processedMessages });
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const refreshConversations = async (agentId: string, agentService: AgentService) => {
    if (!agentService) {
      console.warn("Agent service not provided");
      return;
    }

    try {
      const conversationsList = await agentService.getConversations(agentId);
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversationsList });
    } catch (error) {
      console.error("Error refreshing conversations:", error);
    }
  };

  const initializeConversations = async (agentId: string, agentService: AgentService) => {
    if (!agentService) {
      console.warn("Agent service not provided");
      return;
    }

    try {
      const conversationsList = await agentService.getConversations(agentId);
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversationsList });

      // If we have conversations, set and load the first one as active
      if (conversationsList.length > 0) {
        const firstConversation = conversationsList[0];
        dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: firstConversation.stateId });
        await loadConversation(agentId, firstConversation.stateId, agentService);
      }
    } catch (error) {
      console.error("Error initializing conversations:", error);
    }
  };

  return (
    <ChatContext.Provider value={{ state, dispatch, loadConversation, initializeConversations, refreshConversations, resetState }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatStore() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatStore must be used within a ChatProvider');
  }
  return context;
} 