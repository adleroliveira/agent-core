import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import '../styles/chat.css';
import Markdown from 'markdown-to-jsx';
import { useChatStore, ExtendedMessage } from '../stores/chat.store';
import { useMemoryStore } from '../stores/memory.store';
import { GenAIStreamLexer } from '../utils/StreamLexer';
import { ChatService } from '@/services/chat.service';
import { FrontendAgentService } from '@/services/agent.service';
import '@preact/compat';
import { MessageDto } from '../api-client/models/MessageDto';
import { Memory } from '@/components/Memory';
import { CollapsiblePanel } from '@/components/CollapsiblePanel';
import { CircleStackIcon } from '@heroicons/react/24/outline';
import { AgentInformation } from '@/components/AgentInformation';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import Prism from 'prismjs';
import 'prism-themes/themes/prism-nord.css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';

interface ChatProps {
  agentId?: string;
}

const CodeBlock = ({ className, children }: { className?: string; children: string }) => {
  const language = className?.replace('lang-', '') || 'text';
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [children]);

  return (
    <code className={`language-${language}`} ref={codeRef}>
      {children}
    </code>
  );
};

export const Chat: ComponentType<ChatProps> = ({ agentId }) => {
  const { state, dispatch, loadConversation, initializeConversations, refreshConversations } = useChatStore();
  const { fetchMemory } = useMemoryStore();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lexerRef = useRef<GenAIStreamLexer | null>(null);
  const initializedRef = useRef(false);
  const currentBlockType = useRef<'thinking' | 'tool' | 'normal' | null>(null);
  const currentMessageRef = useRef<ExtendedMessage | null>(null);
  const [isConfigPanelCollapsed, setIsConfigPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('agent');

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
            role: MessageDto.role.ASSISTANT,
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
          role: MessageDto.role.ASSISTANT,
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
        if (currentMessageRef.current?.role === MessageDto.role.ASSISTANT && !currentMessageRef.current.isComplete) {
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
            role: MessageDto.role.ASSISTANT,
            content: '',
            blockType: 'tool',
            isComplete: false
          }
        });
        break;

      case 'TOOL_RESULT':
        if (currentMessageRef.current?.role === MessageDto.role.ASSISTANT && currentMessageRef.current.blockType === 'tool' && !currentMessageRef.current.isComplete) {
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
              role: MessageDto.role.ASSISTANT,
              content: token.value || '',
              blockType: 'tool',
              isComplete: true
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
        if (currentMessageRef.current?.role === MessageDto.role.ASSISTANT && currentMessageRef.current.blockType === (currentBlockType.current || 'normal') && !currentMessageRef.current.isComplete) {
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
              role: MessageDto.role.ASSISTANT,
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
      payload: { role: MessageDto.role.USER, content, blockType: 'normal', isComplete: true }
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
          async () => {
            dispatch({ type: 'SET_IS_LOADING', payload: false });
            dispatch({ type: 'SET_IS_USING_TOOL', payload: false });
            dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: false });
            dispatch({ type: 'SET_SHOW_LOADING_CUE', payload: false });
            // Clear the current message ref after streaming is complete
            currentMessageRef.current = null;
            currentBlockType.current = null;
            // Refresh memory after streaming completes
            if (agentId && state.activeConversationId && state.agentService) {
              await fetchMemory(agentId, state.activeConversationId, state.agentService);
            }
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
          payload: {
            role: MessageDto.role.ASSISTANT,
            content: response.content,
            blockType: 'normal',
            isComplete: true
          }
        });
        dispatch({ type: 'SET_IS_LOADING', payload: false });
        // Refresh memory after non-streaming message completes
        if (agentId && state.activeConversationId && state.agentService) {
          await fetchMemory(agentId, state.activeConversationId, state.agentService);
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
    // If content is wrapped in triple backticks, remove them
    const markdownContent = content.trim().replace(/^```\n?/, '').replace(/\n?```$/, '');
    return markdownContent.replace(/^---$/gm, '***');
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
                key={conv.stateId}
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

      <div class={`chat-container ${isConfigPanelCollapsed ? 'config-panel-collapsed' : ''}`}>
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
                  class={`message ${msg.role}`}
                >
                  {msg.role === MessageDto.role.USER ? (
                    <div class="message-content">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      {msg.blockType === 'thinking' && state.showThinkingBubbles && (
                        <div class="message assistant thinking show">
                          <div class="thinking-content">
                            <div class="thinking-header">Thought Process</div>
                            <div class="thinking-body">
                              <span class="thinking-icon">🤔</span>
                              {(msg.thinking || msg.content || '').trimStart()}
                            </div>
                          </div>
                        </div>
                      )}
                      {msg.blockType === 'tool' ? (
                        <div class="message assistant tool-message">
                          <div class="tool-message-content">
                            <span class="tool-icon">🔧</span>
                            <span>Using tool...</span>
                          </div>
                        </div>
                      ) : (
                        <div class="message assistant">
                          <div class="message-content">
                            <Markdown options={{
                              forceBlock: true,
                              forceWrapper: true,
                              wrapper: 'div',
                              overrides: {
                                p: {
                                  component: 'p',
                                  props: {
                                    style: { marginBottom: '1em' }
                                  }
                                },
                                code: ({ className, children }: { className?: string; children: string }) => {
                                  if (className) {
                                    return <CodeBlock className={className}>{children}</CodeBlock>;
                                  }
                                  return <code>{children}</code>;
                                }
                              }
                            }}>
                              {renderMarkdown((msg.content || '').trimStart())}
                            </Markdown>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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

      <CollapsiblePanel
        isCollapsed={isConfigPanelCollapsed}
        onToggle={() => setIsConfigPanelCollapsed(!isConfigPanelCollapsed)}
        menuTabs={[
          {
            id: 'agent',
            icon: <InformationCircleIcon className="w-5 h-5" />,
            title: 'Agent Details',
            content: agentId && state.agentService ? (
              <AgentInformation
                agentId={agentId}
                agentService={state.agentService}
              />
            ) : null
          },
          {
            id: 'memory',
            icon: <CircleStackIcon className="w-5 h-5" />,
            title: 'Memory',
            content: agentId && state.activeConversationId && state.agentService ? (
              <Memory
                agentId={agentId}
                conversationId={state.activeConversationId}
                agentService={state.agentService}
              />
            ) : null
          }
        ]}
        activeTabId={activeTab}
        onTabClick={(tabId) => setActiveTab(tabId)}
      />
    </div>
  );
};