import { createContext } from 'preact';
import { useContext, useReducer } from 'preact/hooks';
import { McpServersService } from '@/api-client/services/McpServersService';
import { MCPServerDto } from '@/api-client/models/MCPServerDto';
import { McpToolDto } from '@/api-client/models/McpToolDto';
import { CreateMCPServerDto } from '@/api-client/models/CreateMCPServerDto';

interface Tool extends McpToolDto { }

interface Resource {
  name: string;
  type: string;
  description: string;
}

interface Prompt {
  name: string;
  description: string;
  template: string;
}

interface ToolsStudioState {
  servers: MCPServerDto[];
  selectedServer: MCPServerDto | null;
  tools: Tool[];
  resources: Resource[];
  prompts: Prompt[];
  isLoading: boolean;
  error: string | null;
  isCreatingServer: boolean;
  createServerError: string | null;
}

type ToolsStudioAction =
  | { type: 'SET_SERVERS'; payload: MCPServerDto[] }
  | { type: 'SET_SELECTED_SERVER'; payload: MCPServerDto | null }
  | { type: 'SET_TOOLS'; payload: Tool[] }
  | { type: 'SET_RESOURCES'; payload: Resource[] }
  | { type: 'SET_PROMPTS'; payload: Prompt[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CREATING_SERVER'; payload: boolean }
  | { type: 'SET_CREATE_SERVER_ERROR'; payload: string | null };

const initialState: ToolsStudioState = {
  servers: [],
  selectedServer: null,
  tools: [],
  resources: [],
  prompts: [],
  isLoading: false,
  error: null,
  isCreatingServer: false,
  createServerError: null,
};

function toolsStudioReducer(state: ToolsStudioState, action: ToolsStudioAction): ToolsStudioState {
  switch (action.type) {
    case 'SET_SERVERS':
      return { ...state, servers: action.payload };
    case 'SET_SELECTED_SERVER':
      return { ...state, selectedServer: action.payload };
    case 'SET_TOOLS':
      return { ...state, tools: action.payload };
    case 'SET_RESOURCES':
      return { ...state, resources: action.payload };
    case 'SET_PROMPTS':
      return { ...state, prompts: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CREATING_SERVER':
      return { ...state, isCreatingServer: action.payload };
    case 'SET_CREATE_SERVER_ERROR':
      return { ...state, createServerError: action.payload };
    default:
      return state;
  }
}

interface ToolsStudioContextType {
  state: ToolsStudioState;
  fetchServers: () => Promise<void>;
  createServer: (server: CreateMCPServerDto) => Promise<void>;
  updateServer: (server: MCPServerDto) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  selectServer: (server: MCPServerDto | null) => void;
  fetchServerDetails: (serverId: string) => Promise<void>;
  dismissCreateServerError: () => void;
  dismissError: () => void;
}

const ToolsStudioContext = createContext<ToolsStudioContextType | null>(null);

export function ToolsStudioProvider({ children }: { children: preact.ComponentChildren }) {
  const [state, dispatch] = useReducer(toolsStudioReducer, initialState);

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      try {
        // Try to parse the error message as JSON
        const errorObj = JSON.parse(err.message);
        if (errorObj.message) {
          return errorObj.message;
        }
      } catch (e) {
        // If parsing fails, check if it's an Axios error
        if ('response' in err) {
          const axiosError = err as any;
          if (axiosError.response?.data?.message) {
            return axiosError.response.data.message;
          }
        }
        // If all else fails, return the original error message
        return err.message;
      }
    }
    return 'An unexpected error occurred';
  };

  const fetchServers = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await McpServersService.mcpServerControllerGetAllMcpServers();
      dispatch({ type: 'SET_SERVERS', payload: response });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createServer = async (server: CreateMCPServerDto) => {
    try {
      dispatch({ type: 'SET_CREATING_SERVER', payload: true });
      dispatch({ type: 'SET_CREATE_SERVER_ERROR', payload: null });
      const response = await McpServersService.mcpServerControllerCreateMcpServer(server);
      dispatch({ type: 'SET_SERVERS', payload: [...state.servers, response] });
      dispatch({ type: 'SET_SELECTED_SERVER', payload: response });
      await fetchServerDetails(response.id);
    } catch (err) {
      dispatch({ type: 'SET_CREATE_SERVER_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_CREATING_SERVER', payload: false });
    }
  };

  const updateServer = async (server: MCPServerDto) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const { id, ...serverWithoutId } = server;
      const response = await McpServersService.mcpServerControllerUpdateMcpServer(id, serverWithoutId);
      dispatch({ type: 'SET_SERVERS', payload: state.servers.map(s => s.id === server.id ? response : s) });
      dispatch({ type: 'SET_SELECTED_SERVER', payload: response });
      await fetchServerDetails(response.id);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteServer = async (id: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await McpServersService.mcpServerControllerDeleteMcpServer(id);
      dispatch({ type: 'SET_SERVERS', payload: state.servers.filter(s => s.id !== id) });
      if (state.selectedServer?.id === id) {
        dispatch({ type: 'SET_SELECTED_SERVER', payload: null });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const selectServer = (server: MCPServerDto | null) => {
    dispatch({ type: 'SET_SELECTED_SERVER', payload: server });
    if (server) {
      fetchServerDetails(server.id);
    }
  };

  const fetchServerDetails = async (serverId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const server = await McpServersService.mcpServerControllerGetMcpServer(serverId);

      // Ensure tools is always an array and handle potential undefined/null cases
      const tools = Array.isArray(server.tools) ? server.tools : [];

      dispatch({ type: 'SET_TOOLS', payload: tools });
      // Clear resources and prompts since we're not using them for now
      dispatch({ type: 'SET_RESOURCES', payload: [] });
      dispatch({ type: 'SET_PROMPTS', payload: [] });
    } catch (err) {
      console.error('Error fetching server details:', err);
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      dispatch({ type: 'SET_TOOLS', payload: [] });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const dismissCreateServerError = () => {
    dispatch({ type: 'SET_CREATE_SERVER_ERROR', payload: null });
  };

  const dismissError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  return (
    <ToolsStudioContext.Provider
      value={{
        state,
        fetchServers,
        createServer,
        updateServer,
        deleteServer,
        selectServer,
        fetchServerDetails,
        dismissCreateServerError,
        dismissError,
      }}
    >
      {children}
    </ToolsStudioContext.Provider>
  );
}

export function useToolsStudioStore() {
  const context = useContext(ToolsStudioContext);
  if (!context) {
    throw new Error('useToolsStudioStore must be used within a ToolsStudioProvider');
  }
  return context;
} 