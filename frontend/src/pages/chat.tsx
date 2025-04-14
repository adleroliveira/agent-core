import { useEffect, useRef } from 'preact/hooks';
import type { ComponentType } from 'preact';
import '../styles/chat.css';
import { marked } from 'marked';
import { useChatStore, ExtendedMessage } from '../stores/chat.store';
import { GenAIStreamLexer } from '../utils/StreamLexer';
import { ChatService } from '@/services/chat.service';
import { FrontendAgentService } from '@/services/agent.service';
import '@preact/compat';

interface ChatProps {
  agentId?: string;
}

export const Chat: ComponentType<ChatProps> = ({ agentId }) => {
  const { state, dispatch, loadConversation, initializeConversations, refreshConversations } = useChatStore();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lexerRef = useRef<GenAIStreamLexer | null>(null);
  const initializedRef = useRef(false);
  const currentBlockType = useRef<'thinking' | 'tool' | 'normal' | null>(null);
  const currentMessageRef = useRef<ExtendedMessage | null>(null);

  if (!lexerRef.current) {
    lexerRef.current = new GenAIStreamLexer();
  }

  const newConversation = async () => {
    if (!agentId || !state.agentService) return;

    try {
      dispatch({ type: 'SET_IS_LOADING', payload: true });
      const response = await state.agentService.createNewConversation(agentId);

      // Update the active conversation and load its history only if not streaming
      dispatch({ type: 'SET_ACTIVE_CONVERSATION_ID', payload: response.stateId });

      // Reset messages for the new conversation
      dispatch({ type: 'SET_MESSAGES', payload: [] });

      // Refresh the conversations list
      await refreshConversations(agentId, state.agentService);
    } catch (error) {
      console.error('Error creating new conversation:', error);
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  };

  // Initialize services and component
  useEffect(() => {
    if (!agentId) return;

    const initialize = async () => {
      try {
        // Initialize services
        const chatService = new ChatService(agentId);
        const agentService = new FrontendAgentService();

        // Set services in state first
        dispatch({ type: 'SET_CHAT_SERVICE', payload: chatService });
        dispatch({ type: 'SET_AGENT_SERVICE', payload: agentService });
        dispatch({ type: 'SET_AGENT_ID', payload: agentId });

        // Get agent details
        const agent = await agentService.getAgentDetails(agentId);
        dispatch({ type: 'SET_AGENT_NAME', payload: agent.name });

        // Initialize conversations with the current agentId and service
        await initializeConversations(agentId, agentService);

        initializedRef.current = true;
      } catch (error) {
        console.error('Error initializing chat:', error);
        dispatch({ type: 'SET_AGENT_NAME', payload: 'Agent' });
      }
    };

    initialize();

    return () => {
      initializedRef.current = false;
    };
  }, [agentId]);

  // Auto-scroll messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [state.messages, state.isUsingTool]);

  // Focus input when not loading
  useEffect(() => {
    if (!state.isLoading) {
      inputRef.current?.focus();
    }
  }, [state.isLoading]);

  const processToken = (token: any) => {
    switch (token.type) {
      case 'TEXT':
        if (!token.value) return;

        // If we have a current message being streamed, update it
        if (currentMessageRef.current) {
          const updatedMessage = {
            ...currentMessageRef.current,
            [currentBlockType.current === 'thinking' ? 'thinking' : 'content']:
              (currentMessageRef.current[currentBlockType.current === 'thinking' ? 'thinking' : 'content'] || '') + token.value
          };
          currentMessageRef.current = updatedMessage;
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: () => updatedMessage
          });
        } else {
          // Create a new message if we don't have one being streamed
          const newMessage = {
            role: 'assistant' as const,
            content: currentBlockType.current === 'thinking' ? '' : token.value,
            thinking: currentBlockType.current === 'thinking' ? token.value : undefined,
            blockType: currentBlockType.current || 'normal',
            isComplete: false
          };
          currentMessageRef.current = newMessage;
          dispatch({
            type: 'ADD_MESSAGE',
            payload: newMessage
          });
        }
        break;

      case 'BLOCK_START':
        if (!token.blockName) return;
        const blockType = token.blockName.toLowerCase() as 'thinking' | 'tool' | 'normal';
        currentBlockType.current = blockType;

        // If we have a current message, mark it as complete
        if (currentMessageRef.current) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: msg => ({ ...msg, isComplete: true })
          });
          currentMessageRef.current = null;
        }

        // Create a new message for the new block
        const newBlockMessage = {
          role: 'assistant' as const,
          content: '',
          thinking: blockType === 'thinking' ? '' : undefined,
          blockType,
          isComplete: false
        };
        currentMessageRef.current = newBlockMessage;
        dispatch({
          type: 'ADD_MESSAGE',
          payload: newBlockMessage
        });

        if (blockType === 'tool') {
          dispatch({ type: 'SET_IS_USING_TOOL', payload: true });
        }
        break;

      case 'BLOCK_END':
        if (currentMessageRef.current) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: msg => ({ ...msg, isComplete: true })
          });
          currentMessageRef.current = null;
        }
        currentBlockType.current = null;
        break;

      case 'TOOL_CALL':
        if (currentMessageRef.current?.role === 'assistant' && !currentMessageRef.current.isComplete) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: msg => ({ ...msg, isComplete: true })
          });
        }
        currentBlockType.current = 'tool';
        dispatch({ type: 'SET_IS_USING_TOOL', payload: true });

        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            role: 'assistant',
            content: '',
            blockType: 'tool',
            isComplete: false,
            toolName: token.toolInfo?.name
          }
        });
        break;

      case 'TOOL_RESULT':
        if (currentMessageRef.current?.role === 'assistant' && currentMessageRef.current.blockType === 'tool' && !currentMessageRef.current.isComplete) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: msg => ({
              ...msg,
              content: (msg.content || '') + (token.value || ''),
              isComplete: true
            })
          });
        } else {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              role: 'assistant',
              content: token.value || '',
              blockType: 'tool',
              isComplete: true,
              toolName: token.toolInfo?.name
            }
          });
        }
        dispatch({ type: 'SET_IS_USING_TOOL', payload: false });
        break;

      case 'DONE':
        if (currentMessageRef.current) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: msg => ({ ...msg, isComplete: true })
          });
          currentMessageRef.current = null;
        }
        currentBlockType.current = null;
        dispatch({ type: 'SET_IS_LOADING', payload: false });
        dispatch({ type: 'SET_IS_USING_TOOL', payload: false });
        break;

      case 'UNPARSEABLE':
        console.warn('Unparseable content:', token.value);
        if (currentMessageRef.current?.role === 'assistant' && currentMessageRef.current.blockType === (currentBlockType.current || 'normal') && !currentMessageRef.current.isComplete) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: msg => ({
              ...msg,
              [currentBlockType.current === 'thinking' ? 'thinking' : 'content']:
                (msg[currentBlockType.current === 'thinking' ? 'thinking' : 'content'] || '') + (token.value || '')
            })
          });
        } else {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              role: 'assistant',
              content: currentBlockType.current === 'thinking' ? '' : (token.value || ''),
              thinking: currentBlockType.current === 'thinking' ? (token.value || '') : undefined,
              blockType: currentBlockType.current || 'normal',
              isComplete: false
            }
          });
        }
        break;
    }
  };

  const handleSendMessage = async (e: Event) => {
    e.preventDefault();
    if (!state.inputMessage.trim() || !state.chatService || state.isLoading) return;

    const content = state.inputMessage;
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { role: 'user', content, blockType: 'normal', isComplete: true }
    });
    dispatch({ type: 'SET_INPUT_MESSAGE', payload: '' });
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: true });

    try {
      if (state.isStreaming) {
        dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: true });
        await state.chatService.sendStreamingMessage(
          content,
          state.activeConversationId,
          chunk => {
            dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: false });
            for (const token of lexerRef.current!.processChunk(chunk)) {
              processToken(token);
            }
          },
          () => {
            dispatch({ type: 'SET_IS_LOADING', payload: false });
            dispatch({ type: 'SET_IS_USING_TOOL', payload: false });
            dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: false });
            dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: false });
            if (agentId && state.agentService) {
              refreshConversations(agentId, state.agentService);
            }
            // Clear the current message ref after streaming is complete
            currentMessageRef.current = null;
            currentBlockType.current = null;
          },
          error => {
            console.error('Streaming error:', error);
            dispatch({ type: 'SET_IS_LOADING', payload: false });
            dispatch({ type: 'SET_IS_USING_TOOL', payload: false });
            dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: false });
            dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: false });
            // Clear the current message ref on error
            currentMessageRef.current = null;
            currentBlockType.current = null;
          }
        );
      } else {
        const response = await state.chatService.sendMessage(content, state.activeConversationId);
        dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: false });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { ...response, blockType: 'normal', isComplete: true }
        });
        dispatch({ type: 'SET_IS_LOADING', payload: false });
        if (agentId && state.agentService) {
          refreshConversations(agentId, state.agentService);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      dispatch({ type: 'SET_IS_LOADING', payload: false });
      dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: false });
      dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: false });
    }
  };

  const renderMarkdown = (content: string) => {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(content) as string;
  };

  return (
    <div class="chat-page">
      <div class="conversations-sidebar">
        <div class="conversations-header">
          <h2>Conversations</h2>
          <button
            class="new-conversation-button"
            onClick={() => newConversation()}
            disabled={state.isLoading}
          >
            <span>+</span> New
          </button>
        </div>
        <ul class="conversation-list">
          {state.conversations.length > 0 ? (
            state.conversations.map(conv => (
              <li
                key={conv.id}
                class={`conversation-item ${conv.stateId === state.activeConversationId ? 'active' : ''}`}
                onClick={() => {
                  if (agentId && state.agentService) {
                    loadConversation(agentId, conv.stateId, state.agentService);
                  }
                }}
              >
                <div class="conversation-title">
                  {conv.stateId === state.activeConversationId ? '✓ ' : ''}
                  Conversation {conv.stateId.slice(0, 8)}...
                </div>
                <div class="conversation-date">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </div>
                <button
                  class="delete-conversation-button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!agentId || !state.agentService) return;

                    try {
                      dispatch({ type: 'SET_IS_LOADING', payload: true });
                      await state.agentService.deleteConversation(agentId, conv.stateId);

                      // If we're deleting the active conversation, clear the messages
                      if (conv.stateId === state.activeConversationId) {
                        dispatch({ type: 'SET_MESSAGES', payload: [] });
                      }

                      // Refresh the conversations list and let it handle setting the active conversation
                      await refreshConversations(agentId, state.agentService);
                    } catch (error) {
                      console.error('Error deleting conversation:', error);
                    } finally {
                      dispatch({ type: 'SET_IS_LOADING', payload: false });
                    }
                  }}
                  disabled={state.isLoading}
                >
                  ×
                </button>
              </li>
            ))
          ) : (
            <div class="no-conversations">No conversations yet</div>
          )}
        </ul>
      </div>

      <div class="chat-container">
        <div class="chat-header">
          <h1>{state.agentName}</h1>
          <div class="chat-toggles">
            <div class="streaming-toggle">
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  checked={state.isStreaming}
                  onChange={e => dispatch({ type: 'SET_IS_STREAMING', payload: (e.target as HTMLInputElement).checked })}
                  disabled={state.isLoading}
                />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Streaming {state.isStreaming ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="thinking-toggle">
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  checked={state.showThinkingBubbles}
                  onChange={e => dispatch({ type: 'SET_SHOW_THINKING_BUBBLES', payload: (e.target as HTMLInputElement).checked })}
                  disabled={state.isLoading}
                />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Show Thought Process</span>
            </div>
          </div>
        </div>

        <div class="chat-messages" ref={messagesContainerRef}>
          {state.messages.length === 0 ? (
            <div class="empty-chat">
              <p>Start a conversation with your agent</p>
            </div>
          ) : (
            <>
              {state.messages.map((msg, idx) => (
                <div
                  key={idx}
                  class={`message ${msg.role} ${msg.blockType === 'thinking' ? 'thinking' : ''} ${msg.blockType === 'thinking' && state.showThinkingBubbles ? 'show' : ''} ${msg.blockType === 'tool' ? 'tool-message' : ''}`}
                >
                  <div class="message-content">
                    {msg.blockType === 'thinking' && state.showThinkingBubbles ? (
                      <div class="thinking-content">
                        <div class="thinking-header">Thought Process</div>
                        <div class="thinking-body">
                          <span class="thinking-icon">🤔</span>
                          {(msg.thinking || msg.content || '').trimStart()}
                        </div>
                      </div>
                    ) : msg.blockType === 'tool' ? (
                      <div class="tool-message-content">
                        <span class="tool-icon">🔧</span>
                        <span>Using {msg.toolName || 'tool'}...</span>
                      </div>
                    ) : (
                      <div class="message-content" dangerouslySetInnerHTML={{ __html: renderMarkdown((msg.content || '').trimStart()) }} />
                    )}
                  </div>
                </div>
              ))}
              {state.showLoadingCue && (
                <div class="message assistant">
                  <div class="loading-cue">
                    <div class="loading-dots">
                      <div class="loading-dot"></div>
                      <div class="loading-dot"></div>
                      <div class="loading-dot"></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <form class="chat-input-form" onSubmit={handleSendMessage}>
          <input
            ref={inputRef}
            type="text"
            value={state.inputMessage}
            onInput={e => dispatch({ type: 'SET_INPUT_MESSAGE', payload: (e.target as HTMLInputElement).value })}
            placeholder="Type your message..."
            class="chat-input"
            disabled={state.isLoading}
          />
          <button
            type="submit"
            class="send-button"
            disabled={state.isLoading}
          >
            {state.isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      <div class="configurations-panel">
        <div class="configurations-header">
          <h2>Configurations</h2>
        </div>
        <div class="config-placeholder">
          <p>Configuration options will appear here</p>
        </div>
      </div>
    </div>
  );
};