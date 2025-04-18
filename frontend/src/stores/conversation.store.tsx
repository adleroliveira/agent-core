import { createContext } from 'preact';
import { useContext, useReducer } from 'preact/hooks';
import { ConversationDto } from '../api-client/models/ConversationDto';
import { AgentsService } from '../api-client/services/AgentsService';

interface ConversationState {
  conversations: ConversationDto[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ConversationState = {
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  error: null,
};

type ConversationAction =
  | { type: 'SET_CONVERSATIONS'; payload: ConversationDto[] }
  | { type: 'SET_ACTIVE_CONVERSATION_ID'; payload: string | null }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    case 'SET_ACTIVE_CONVERSATION_ID':
      return { ...state, activeConversationId: action.payload };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

const ConversationContext = createContext<{
  state: ConversationState;
  dispatch: (action: ConversationAction) => void;
  fetchConversations: (agentId: string, agentService: typeof AgentsService) => Promise<void>;
  createConversation: (agentId: string, agentService: typeof AgentsService) => Promise<void>;
  deleteConversation: (agentId: string, conversationId: string, agentService: typeof AgentsService) => Promise<void>;
  selectConversation: (conversationId: string) => void;
} | null>(null);

export function ConversationProvider({ children }: { children: preact.ComponentChildren }) {
  const [state, dispatch] = useReducer(conversationReducer, initialState);

  const fetchConversations = async (agentId: string, agentService: typeof AgentsService) => {
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    try {
      const conversations = await agentService.agentControllerGetConversations(agentId);
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
      if (conversations.length > 0) {
        dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: conversations[0].stateId });
      } else {
        dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: null });
      }
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error?.message || 'Failed to load conversations' });
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  };

  const createConversation = async (agentId: string, agentService: typeof AgentsService) => {
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    try {
      const conversation = await agentService.agentControllerCreateNewConversation(agentId);
      await fetchConversations(agentId, agentService);
      dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: conversation.stateId });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error?.message || 'Failed to create conversation' });
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  };

  const deleteConversation = async (agentId: string, conversationId: string, agentService: typeof AgentsService) => {
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    try {
      await agentService.agentControllerDeleteConversation(agentId, conversationId);
      await fetchConversations(agentId, agentService);
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error?.message || 'Failed to delete conversation' });
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  };

  const selectConversation = (conversationId: string) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: conversationId });
  };

  return (
    <ConversationContext.Provider value={{ state, dispatch, fetchConversations, createConversation, deleteConversation, selectConversation }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversationStore() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversationStore must be used within a ConversationProvider');
  }
  return context;
} 