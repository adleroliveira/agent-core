import { createContext } from 'preact';
import { useContext, useReducer } from 'preact/hooks';
import { FrontendAgentService } from '@/services/agent.service';

interface MemoryState {
  memory: Record<string, any> | null;
  isLoading: boolean;
  error: string | null;
}

type MemoryAction =
  | { type: 'SET_MEMORY'; payload: Record<string, any> | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: MemoryState = {
  memory: null,
  isLoading: false,
  error: null,
};

function memoryReducer(state: MemoryState, action: MemoryAction): MemoryState {
  switch (action.type) {
    case 'SET_MEMORY':
      return { ...state, memory: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface MemoryContextType {
  state: MemoryState;
  fetchMemory: (agentId: string, conversationId: string, agentService: FrontendAgentService) => Promise<void>;
  updateMemory: (agentId: string, conversationId: string, memory: Record<string, any>, agentService: FrontendAgentService) => Promise<void>;
  deleteMemory: (agentId: string, conversationId: string, agentService: FrontendAgentService) => Promise<void>;
  deleteMemoryEntry: (agentId: string, conversationId: string, key: string, agentService: FrontendAgentService) => Promise<void>;
}

const MemoryContext = createContext<MemoryContextType | null>(null);

export function MemoryProvider({ children }: { children: preact.ComponentChildren }) {
  const [state, dispatch] = useReducer(memoryReducer, initialState);

  const fetchMemory = async (agentId: string, conversationId: string, agentService: FrontendAgentService) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      const memoryResponse = await agentService.getMemory(agentId, conversationId);
      const memory = memoryResponse.memory || {};
      dispatch({ type: 'SET_MEMORY', payload: memory });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch memory' });
      console.error('Error fetching memory:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateMemory = async (agentId: string, conversationId: string, memory: Record<string, any>, agentService: FrontendAgentService) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      await agentService.updateMemory(agentId, conversationId, memory);
      dispatch({ type: 'SET_MEMORY', payload: memory });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update memory' });
      console.error('Error updating memory:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteMemory = async (agentId: string, conversationId: string, agentService: FrontendAgentService) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      await agentService.deleteMemory(agentId, conversationId);
      dispatch({ type: 'SET_MEMORY', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete memory' });
      console.error('Error deleting memory:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteMemoryEntry = async (agentId: string, conversationId: string, key: string, agentService: FrontendAgentService) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      await agentService.deleteMemoryEntry(agentId, conversationId, key);
      if (state.memory) {
        const updatedMemory = { ...state.memory };
        delete updatedMemory[key];
        dispatch({ type: 'SET_MEMORY', payload: updatedMemory });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete memory entry' });
      console.error('Error deleting memory entry:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <MemoryContext.Provider value={{ state, fetchMemory, updateMemory, deleteMemory, deleteMemoryEntry }}>
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemoryStore() {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemoryStore must be used within a MemoryProvider');
  }
  return context;
} 