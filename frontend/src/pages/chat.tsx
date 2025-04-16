import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import '../styles/chat.css';
import Markdown from 'markdown-to-jsx';
import { useChatStore, ExtendedMessage } from '../stores/chat.store';
import { useConversationStore } from '../stores/conversation.store';
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
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { ConversationList } from '@/components/ConversationList';
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
import { DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  const { state, dispatch, loadConversation, uploadFile } = useChatStore();
  const {
    state: convState,
    fetchConversations,
    createConversation,
    deleteConversation,
    selectConversation
  } = useConversationStore();
  const { fetchMemory } = useMemoryStore();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lexerRef = useRef<GenAIStreamLexer | null>(null);
  const initializedRef = useRef(false);
  const currentBlockType = useRef<'thinking' | 'tool' | 'normal' | null>(null);
  const currentMessageRef = useRef<ExtendedMessage | null>(null);
  const [isConfigPanelCollapsed, setIsConfigPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('conversations');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!lexerRef.current) {
    lexerRef.current = new GenAIStreamLexer();
  }

  const newConversation = async () => {
    if (!agentId || !state.agentService) return;
    await createConversation(agentId, state.agentService);
    // No need to loadConversation here; handled by useEffect below
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

        // Fetch conversations for this agent
        await fetchConversations(agentId, agentService);

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
        if (!convState.activeConversationId) {
          throw new Error('No active conversation ID');
        }
        dispatch({ type: 'SET_IS_STREAMING_ACTIVE', payload: true });
        await state.chatService.sendStreamingMessage(
          content,
          convState.activeConversationId,
          state.uploadedDocuments,
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
            // Clear uploaded documents after message is sent
            dispatch({ type: 'CLEAR_DOCUMENTS', payload: null });
            // Refresh memory after streaming completes
            if (agentId && convState.activeConversationId && state.agentService) {
              await fetchMemory(agentId, convState.activeConversationId, state.agentService);
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
        let response;
        if (convState.activeConversationId) {
          response = await state.chatService.sendMessage(content, convState.activeConversationId, state.uploadedDocuments);
        } else {
          throw new Error('No active conversation ID');
        }
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
        // Clear uploaded documents after message is sent
        dispatch({ type: 'CLEAR_DOCUMENTS', payload: null });
        // Refresh memory after non-streaming message completes
        if (agentId && convState.activeConversationId && state.agentService) {
          await fetchMemory(agentId, convState.activeConversationId, state.agentService);
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

  // Add this effect to always load conversation history when activeConversationId changes
  useEffect(() => {
    if (agentId && state.agentService && convState.activeConversationId) {
      loadConversation(agentId, convState.activeConversationId, state.agentService);
    } else if (!convState.activeConversationId) {
      dispatch({ type: 'SET_MESSAGES', payload: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convState.activeConversationId]);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!e.dataTransfer?.files.length) return;

    try {
      for (const file of e.dataTransfer.files) {
        await uploadFile(file);
      }
    } catch (error) {
      console.error('Error handling dropped files:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleFileInput = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;

    try {
      for (const file of input.files) {
        await uploadFile(file);
      }
      input.value = ''; // Reset the input
    } catch (error) {
      console.error('Error handling file input:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleRemoveDocument = (id: string) => {
    dispatch({ type: 'REMOVE_DOCUMENT', payload: id });
  };

  return (
    <div class="chat-page">
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
            id: 'conversations',
            icon: <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />,
            title: 'Conversations',
            content: (
              <ConversationList
                conversations={convState.conversations}
                activeConversationId={convState.activeConversationId}
                isLoading={convState.isLoading}
                onSelectConversation={async (stateId) => {
                  if (agentId && state.agentService && stateId) {
                    selectConversation(stateId);
                    await loadConversation(agentId, stateId, state.agentService);
                  }
                }}
                onNewConversation={newConversation}
                onDeleteConversation={async (stateId) => {
                  if (!agentId || !state.agentService) return;
                  const wasActive = stateId === convState.activeConversationId;
                  await deleteConversation(agentId, stateId, state.agentService);
                  // No need to loadConversation here; handled by useEffect below
                  if (wasActive && !convState.activeConversationId) {
                    dispatch({ type: 'SET_MESSAGES', payload: [] });
                  }
                }}
              />
            )
          },
          {
            id: 'memory',
            icon: <CircleStackIcon className="w-5 h-5" />,
            title: 'Memory',
            content: agentId && convState.activeConversationId && state.agentService ? (
              <Memory
                agentId={agentId}
                conversationId={convState.activeConversationId}
                agentService={state.agentService}
              />
            ) : null
          },
          {
            id: 'tools',
            icon: <WrenchScrewdriverIcon className="w-5 h-5" />,
            title: 'Tools',
            content: agentId && state.agentService ? (
              <AgentInformation
                agentId={agentId}
                agentService={state.agentService}
                showToolsOnly={true}
              />
            ) : null
          }
        ]}
        activeTabId={activeTab}
        onTabClick={(tabId) => setActiveTab(tabId)}
      />
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

        <div
          class={`chat-messages ${isDragging ? 'dragging' : ''}`}
          ref={messagesContainerRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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
          <div class="chat-input-container">
            {state.uploadedDocuments.length > 0 && (
              <div class="uploaded-documents-section">
                {state.uploadedDocuments.slice(0, 3).map(doc => (
                  <div key={doc.id} class="document-item">
                    <DocumentIcon />
                    <span class="document-name">{doc.originalName}</span>
                    <button
                      type="button"
                      class="remove-document"
                      onClick={() => handleRemoveDocument(doc.id)}
                      title="Remove document"
                    >
                      <XMarkIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div class="chat-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                value={state.inputMessage}
                onInput={e => dispatch({ type: 'SET_INPUT_MESSAGE', payload: (e.target as HTMLInputElement).value })}
                placeholder="Type your message..."
                class="chat-input"
                disabled={state.isLoading}
              />
              <input
                ref={fileInputRef}
                type="file"
                class="file-input"
                onChange={handleFileInput}
                accept=".txt,.csv,.md,.json,.xml,.html,.css,.js,.py,.java,.c,.cpp,.cs,.php,.rb,.pl,.sh,.yaml,.toml,.ini,.properties,.log,.diff,.patch,.tex,.latex,.bibtex,.rst,.asciidoc,.org"
              />
              <button
                type="button"
                class="file-upload-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={state.isLoading || state.isUploading}
              >
                {state.isUploading ? (
                  <div class="uploading-spinner"></div>
                ) : (
                  <DocumentIcon />
                )}
              </button>
              <button
                type="submit"
                class="send-button"
                disabled={state.isLoading}
              >
                {state.isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};