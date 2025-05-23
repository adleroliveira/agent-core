import { createContext } from 'preact';
import { useContext, useReducer } from 'preact/hooks';
import { ChatService } from '../services/chat.service';
import { AgentsService } from '../api-client/services/AgentsService';
import { MessageDto } from '../api-client/models/MessageDto';

export interface ExtendedMessage extends Partial<MessageDto> {
  thinking?: string;
  blockType: 'normal' | 'thinking' | 'tool';
  isComplete: boolean;
  toolCallId?: string;
  toolName?: string;
  toolArguments?: Record<string, any>;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
}

interface UploadedDocument {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

interface ChatState {
  messages: ExtendedMessage[];
  inputMessage: string;
  isStreaming: boolean;
  isLoading: boolean;
  isUsingTool: boolean;
  showThinkingBubbles: boolean;
  showToolUsage: boolean;
  showLoadingCue: boolean;
  agentName: string;
  chatService: ChatService | null;
  agentService: typeof AgentsService | null;
  sessionId: string;
  conversationTitle: string;
  conversationId: string | null;
  conversationMemory: Record<string, any>;
  conversationTtl: number;
  currentBlockType: 'normal' | 'thinking' | 'tool' | null;
  agentId: string | undefined;
  isStreamingActive: boolean;
  uploadedDocuments: UploadedDocument[];
  isUploading: boolean;
  uploadError: string | null;
}

type ChatAction =
  | { type: 'SET_MESSAGES'; payload: ExtendedMessage[] }
  | { type: 'SET_INPUT_MESSAGE'; payload: string }
  | { type: 'SET_IS_STREAMING'; payload: boolean }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_IS_USING_TOOL'; payload: boolean }
  | { type: 'SET_SHOW_THINKING_BUBBLES'; payload: boolean }
  | { type: 'SET_SHOW_TOOL_USAGE'; payload: boolean }
  | { type: 'SET_SHOW_LOADING_CUE'; payload: boolean }
  | { type: 'SET_AGENT_NAME'; payload: string }
  | { type: 'SET_CHAT_SERVICE'; payload: ChatService }
  | { type: 'SET_AGENT_SERVICE'; payload: typeof AgentsService }
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
  | { type: 'CLEAR_CURRENT_MESSAGE_REF'; payload: null }
  | { type: 'ADD_DOCUMENT'; payload: UploadedDocument }
  | { type: 'REMOVE_DOCUMENT'; payload: string }
  | { type: 'SET_IS_UPLOADING'; payload: boolean }
  | { type: 'CLEAR_DOCUMENTS'; payload: null }
  | { type: 'SET_UPLOAD_ERROR'; payload: string | null };

const initialState: ChatState = {
  messages: [],
  inputMessage: '',
  isStreaming: true,
  isLoading: false,
  isUsingTool: false,
  showThinkingBubbles: true,
  showToolUsage: true,
  showLoadingCue: false,
  agentName: '',
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
  uploadedDocuments: [],
  isUploading: false,
  uploadError: null,
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
    case 'SET_SHOW_TOOL_USAGE':
      return { ...state, showToolUsage: action.payload };
    case 'SET_SHOW_LOADING_CUE':
      return { ...state, showLoadingCue: action.payload };
    case 'SET_AGENT_NAME':
      return { ...state, agentName: action.payload };
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
    case 'ADD_DOCUMENT':
      return { ...state, uploadedDocuments: [...state.uploadedDocuments, action.payload] };
    case 'REMOVE_DOCUMENT':
      return { ...state, uploadedDocuments: state.uploadedDocuments.filter(doc => doc.id !== action.payload) };
    case 'SET_IS_UPLOADING':
      return { ...state, isUploading: action.payload };
    case 'CLEAR_DOCUMENTS':
      return { ...state, uploadedDocuments: [] };
    case 'SET_UPLOAD_ERROR':
      return { ...state, uploadError: action.payload };
    default:
      return state;
  }
}

const ChatContext = createContext<{
  state: ChatState;
  dispatch: (action: ChatAction) => void;
  loadConversation: (agentId: string, conversationId: string, agentService: typeof AgentsService) => Promise<void>;
  resetState: () => void;
  uploadFile: (file: File) => Promise<void>;
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
    dispatch({ type: 'SET_SHOW_TOOL_USAGE', payload: true });
    dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: false });
    dispatch({ type: 'SET_AGENT_NAME', payload: '' });
    dispatch({ type: 'SET_CHAT_SERVICE', payload: null as unknown as ChatService });
    dispatch({ type: 'SET_AGENT_SERVICE', payload: null as unknown as typeof AgentsService });
    dispatch({ type: 'SET_SESSION_ID', payload: '' });
    dispatch({ type: 'SET_CONVERSATION_TITLE', payload: 'New Conversation' });
    dispatch({ type: 'SET_CONVERSATION_ID', payload: null });
    dispatch({ type: 'SET_CONVERSATION_MEMORY', payload: {} });
    dispatch({ type: 'SET_CONVERSATION_TTL', payload: 0 });
    dispatch({ type: 'SET_CURRENT_BLOCK_TYPE', payload: null });
    dispatch({ type: 'SET_AGENT_ID', payload: '' });
    dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: false });
    dispatch({ type: 'ADD_DOCUMENT', payload: { id: '', filename: '', originalName: '', size: 0, mimetype: '' } });
    dispatch({ type: 'SET_IS_UPLOADING', payload: false });
  };

  const loadConversation = async (agentId: string, conversationId: string, agentService: typeof AgentsService) => {
    if (!agentService || state.isStreamingActive) {
      return;
    }

    try {
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      dispatch({ type: 'CLEAR_CURRENT_MESSAGE_REF', payload: null });

      const history = await agentService.agentControllerGetConversationHistory(agentId, conversationId);
      const processedMessages: ExtendedMessage[] = [];

      for (const message of history.messages || []) {
        // Handle assistant messages with tool calls
        if (message.role === MessageDto.role.ASSISTANT) {
          // First add the assistant's content if there is any
          const content = message.content;
          if (content && content.toString().trim()) {
            processedMessages.push({
              role: MessageDto.role.ASSISTANT,
              content: content.toString(),
              blockType: 'normal' as const,
              isComplete: true
            });
          }

          // Then add the tool call messages if they exist
          if (message.toolCalls && message.toolCalls.length > 0) {
            for (const toolCall of message.toolCalls) {
              // Check if we already have this tool call in our processed messages
              const existingToolCallIndex = processedMessages.findIndex(
                m => m.blockType === 'tool' && m.toolCallId === toolCall.id
              );

              if (existingToolCallIndex === -1) {
                processedMessages.push({
                  role: MessageDto.role.ASSISTANT,
                  content: '',
                  blockType: 'tool' as const,
                  isComplete: true,
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  toolArguments: toolCall.arguments
                });
              }
            }
          }
        } else if (message.role === MessageDto.role.TOOL) {
          // Handle tool result messages
          if (message.toolResults && message.toolResults.length > 0) {
            for (const toolResult of message.toolResults) {
              // Find the corresponding tool call message
              const toolCallIndex = processedMessages.findIndex(
                m => m.blockType === 'tool' && m.toolCallId === toolResult.toolCallId
              );

              if (toolCallIndex !== -1) {
                // Update the tool call message with the result
                processedMessages[toolCallIndex] = {
                  ...processedMessages[toolCallIndex],
                  content: toolResult.result,
                  isComplete: true
                };
              }
            }
          }
        } else {
          // Handle user messages
          processedMessages.push({
            role: message.role,
            content: message.content.toString(),
            blockType: 'normal' as const,
            isComplete: true
          });
        }
      }

      dispatch({ type: 'SET_MESSAGES', payload: processedMessages });
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const uploadFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) { // 4MB limit
      dispatch({ type: 'SET_UPLOAD_ERROR', payload: 'File size exceeds 4MB limit' });
      return;
    }

    const allowedTypes = [
      // Office Documents
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint', // .ppt

      // PDF
      'application/pdf',

      // Text Files
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'text/html',
      'text/css',

      // Programming Files
      'application/javascript',
      'application/typescript',
      'text/x-python',
      'text/x-java',
      'text/x-c',
      'text/x-c++',
      'text/x-csharp',
      'text/x-php',
      'text/x-ruby',
      'text/x-perl',
      'text/x-shellscript',

      // Configuration Files
      'text/x-yaml',
      'text/x-toml',
      'text/x-ini',
      'text/x-properties',

      // Documentation
      'text/markdown',
      'text/x-rst',
      'text/x-asciidoc',
      'text/x-org',

      // Other Text Formats
      'text/x-log',
      'text/x-diff',
      'text/x-patch',
      'text/x-tex',
      'text/x-latex',
      'text/x-bibtex'
    ];

    if (!allowedTypes.includes(file.type)) {
      dispatch({ type: 'SET_UPLOAD_ERROR', payload: 'File type not allowed. Only text-based documents are supported.' });
      return;
    }

    try {
      dispatch({ type: 'SET_IS_UPLOADING', payload: true });
      dispatch({ type: 'SET_UPLOAD_ERROR', payload: null });

      // Create a new FormData instance and append the file
      const formData = new FormData();
      formData.append('files', file);

      const apiUrl = '/api/files/upload/chat'

      // Make a direct fetch request with explicit CORS settings
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        mode: 'cors',
        headers: {
          'Accept': '*/*',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error response:', errorText);
        dispatch({ type: 'SET_UPLOAD_ERROR', payload: `Upload failed: ${errorText}` });
        return;
      }

      const result = await response.json();
      dispatch({ type: 'ADD_DOCUMENT', payload: result[0] });
    } catch (error) {
      console.error('Error uploading file:', error);
      dispatch({ type: 'SET_UPLOAD_ERROR', payload: error instanceof Error ? error.message : 'Failed to upload file' });
    } finally {
      dispatch({ type: 'SET_IS_UPLOADING', payload: false });
    }
  };

  return (
    <ChatContext.Provider value={{ state, dispatch, loadConversation, resetState, uploadFile }}>
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