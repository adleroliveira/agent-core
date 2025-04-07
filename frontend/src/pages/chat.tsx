import { useEffect, useState, useRef } from 'preact/hooks';
import type { ComponentType } from 'preact';
import '../styles/chat.css';
import { ChatService, Message } from '../services/chat.service';
import { AgentService } from '../services/agent.service';
import { GenAIStreamLexer, TokenType, Token } from '../utils/StreamLexer';
import { marked } from 'marked';

interface ChatProps {
  agentId?: string;
}

interface ExtendedMessage extends Message {
  blockType: 'normal' | 'thinking' | 'tool';
  isComplete: boolean;
  toolName?: string;
}

interface Conversation {
  id: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export const Chat: ComponentType<ChatProps> = ({ agentId }) => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingTool, setIsUsingTool] = useState(false);
  const [showThinkingBubbles, setShowThinkingBubbles] = useState(true);
  const [agentName, setAgentName] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const chatService = useRef<ChatService | null>(null);
  const agentService = useRef<AgentService | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lexerRef = useRef<GenAIStreamLexer | null>(null);
  const currentBlockType = useRef<'normal' | 'thinking' | 'tool' | null>(null); // Track current block
  const [_sessionId, setSessionId] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [_conversationTitle, setConversationTitle] = useState<string>("New Conversation");
  const [_conversationId, setConversationId] = useState<string | null>(null);
  const [_conversationHistory, setConversationHistory] = useState<ExtendedMessage[]>([]);
  const [_conversationMemory, setConversationMemory] = useState<Record<string, any>>({});
  const [_conversationTtl, setConversationTtl] = useState<number>(0);

  useEffect(() => {
    if (agentId) {
      chatService.current = new ChatService(agentId);
      agentService.current = new AgentService();
      lexerRef.current = new GenAIStreamLexer();

      // Get agent details
      agentService.current.getAgentDetails(agentId)
        .then(agent => setAgentName(agent.name))
        .catch(error => {
          console.error('Error fetching agent details:', error);
          setAgentName('Agent');
        });

      // Get initial session ID
      if (chatService.current) {
        setSessionId(chatService.current.getSessionId());
      }

      // Load conversations
      loadConversations();
    }
  }, [agentId]);

  const loadConversations = async () => {
    if (!agentId || !agentService.current) return;
    try {
      const response = await agentService.current.getConversations(agentId);
      // Sort conversations by date in descending order (newest first)
      const sortedConversations = [...response].sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      console.log('Sorted conversations:', sortedConversations.map(c => ({
        id: c.id,
        date: c.createdAt,
        messageCount: c.messageCount
      })));

      setConversations(sortedConversations);
      return sortedConversations;
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isUsingTool]);

  useEffect(() => {
    // Focus input when loading state changes from true to false
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const processToken = (token: Token) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      switch (token.type) {
        case TokenType.TEXT:
          if (!token.value) return newMessages;
          // Always append to the last message if it's from the assistant and not complete
          if (lastMessage?.role === 'assistant' && !lastMessage.isComplete) {
            if (currentBlockType.current === 'thinking') {
              lastMessage.thinking = (lastMessage.thinking || '') + token.value;
            } else {
              lastMessage.content = (lastMessage.content || '') + token.value;
            }
          } else {
            // If the last message is a tool message, create a new normal message for the text
            if (lastMessage?.blockType === 'tool') {
              newMessages.push({
                role: 'assistant',
                content: token.value,
                blockType: 'normal',
                isComplete: false
              });
            } else {
              newMessages.push({
                role: 'assistant',
                content: currentBlockType.current === 'thinking' ? '' : token.value,
                thinking: currentBlockType.current === 'thinking' ? token.value : undefined,
                blockType: currentBlockType.current || 'normal',
                isComplete: false
              });
            }
          }
          break;

        case TokenType.BLOCK_START:
          if (!token.blockName) return newMessages;
          const blockType = token.blockName.toLowerCase() as 'thinking' | 'tool' | 'normal';
          currentBlockType.current = blockType;
          if (lastMessage?.role === 'assistant' && !lastMessage.isComplete) {
            lastMessage.isComplete = true;
          }
          newMessages.push({
            role: 'assistant',
            content: '',
            thinking: blockType === 'thinking' ? '' : undefined,
            blockType,
            isComplete: false
          });
          if (blockType === 'tool') setIsUsingTool(true);
          break;

        case TokenType.BLOCK_END:
          if (lastMessage?.role === 'assistant' && !lastMessage.isComplete) {
            lastMessage.isComplete = true;
          }
          currentBlockType.current = null;
          break;

        case TokenType.TOOL_CALL:
          if (lastMessage?.role === 'assistant' && !lastMessage.isComplete) {
            lastMessage.isComplete = true;
          }
          currentBlockType.current = 'tool';
          setIsUsingTool(true);
          newMessages.push({
            role: 'assistant',
            content: '',
            blockType: 'tool',
            isComplete: false,
            toolName: token.toolInfo?.name
          });
          break;

        case TokenType.TOOL_RESULT:
          if (lastMessage?.role === 'assistant' && lastMessage.blockType === 'tool' && !lastMessage.isComplete) {
            lastMessage.content = (lastMessage.content || '') + (token.value || '');
            lastMessage.isComplete = true;
          } else {
            newMessages.push({
              role: 'assistant',
              content: token.value || '',
              blockType: 'tool',
              isComplete: true,
              toolName: token.toolInfo?.name
            });
          }
          setIsUsingTool(false);
          break;

        case TokenType.DONE:
          if (lastMessage?.role === 'assistant' && !lastMessage.isComplete) {
            lastMessage.isComplete = true;
          }
          currentBlockType.current = null;
          setIsLoading(false);
          setIsUsingTool(false);
          break;

        case TokenType.UNPARSEABLE:
          console.warn('Unparseable content:', token.value);
          if (lastMessage?.role === 'assistant' && lastMessage.blockType === (currentBlockType.current || 'normal') && !lastMessage.isComplete) {
            if (currentBlockType.current === 'thinking') {
              lastMessage.thinking = (lastMessage.thinking || '') + (token.value || '');
            } else {
              lastMessage.content = (lastMessage.content || '') + (token.value || '');
            }
          } else {
            newMessages.push({
              role: 'assistant',
              content: currentBlockType.current === 'thinking' ? '' : (token.value || ''),
              thinking: currentBlockType.current === 'thinking' ? (token.value || '') : undefined,
              blockType: currentBlockType.current || 'normal',
              isComplete: false
            });
          }
          break;
      }
      return newMessages;
    });
  };

  const handleSendMessage = async (e: Event) => {
    e.preventDefault();
    if (!inputMessage.trim() || !chatService.current || isLoading) return;

    const userMessage: ExtendedMessage = {
      role: 'user',
      content: inputMessage,
      blockType: 'normal',
      isComplete: true
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsUsingTool(false);
    currentBlockType.current = null; // Reset block type on new message

    try {
      if (isStreaming) {
        await chatService.current.sendStreamingMessage(
          inputMessage,
          (chunk) => {
            if (lexerRef.current) {
              for (const token of lexerRef.current.processChunk(chunk)) {
                processToken(token);
              }
            }
          },
          () => {
            setIsLoading(false);
            setIsUsingTool(false);
            // Reload conversations after message is complete
            loadConversations();
          },
          (error) => {
            console.error('Error in streaming:', error);
            setIsLoading(false);
            setIsUsingTool(false);
          }
        );
      } else {
        const response = await chatService.current.sendMessage(inputMessage, false);
        setMessages(prev => [
          ...prev,
          { ...response, blockType: 'normal', isComplete: true }
        ]);
        setIsLoading(false);
        // Reload conversations after message is complete
        loadConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  const renderMarkdown = (content: string): string => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    return marked.parse(content) as string;
  };

  const handleResetConversation = async () => {
    if (!agentId || !agentService.current) return;

    try {
      // Reset the conversation state
      setMessages([]);
      setActiveConversationId('');
      setConversationTitle("New Conversation");
      setConversationId(null);
      setConversationHistory([]);
      setConversationMemory({});
      setConversationTtl(0);

      // Reset the agent state
      await agentService.current.resetAgentState(agentId);

      // Reload conversations to update the list
      const updatedConversations = await loadConversations();

      // Set the active conversation to the newest one (first in the sorted list)
      if (updatedConversations && updatedConversations.length > 0) {
        setActiveConversationId(updatedConversations[0].conversationId);
      }
    } catch (error) {
      console.error("Error resetting conversation:", error);
    }
  };

  return (
    <div class="chat-page">
      <div class="conversations-sidebar">
        <div class="conversations-header">
          <h2>Conversations</h2>
          <button
            class="new-conversation-button"
            onClick={handleResetConversation}
            disabled={isLoading}
          >
            <span>+</span> New
          </button>
        </div>
        <ul class="conversation-list">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              class={`conversation-item ${conversation.conversationId === activeConversationId ? 'active' : ''}`}
              onClick={() => setActiveConversationId(conversation.conversationId)}
            >
              <div class="conversation-title">
                Conversation {conversation.id.slice(0, 8)}...
              </div>
              <div class="conversation-date">
                {new Date(conversation.createdAt).toLocaleDateString()}
              </div>
              <div class="conversation-message-count">
                {conversation.messageCount} messages
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div class="chat-container">
        <div class="chat-header">
          <h1>{agentName}</h1>
          <div class="chat-toggles">
            <div class="streaming-toggle">
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  checked={isStreaming}
                  onChange={(e) => setIsStreaming((e.target as HTMLInputElement).checked)}
                  disabled={isLoading}
                />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Streaming {isStreaming ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="thinking-toggle">
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  checked={showThinkingBubbles}
                  onChange={(e) => setShowThinkingBubbles((e.target as HTMLInputElement).checked)}
                  disabled={isLoading}
                />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Show Thought Process</span>
            </div>
          </div>
        </div>

        <div class="chat-messages" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div class="empty-chat">
              <p>Start a conversation with your agent</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  class={`message ${message.role} ${message.blockType === 'thinking' ? 'thinking' : ''} ${message.blockType === 'thinking' && showThinkingBubbles ? 'show' : ''} ${message.blockType === 'tool' ? 'tool-message' : ''}`}
                >
                  <div class="message-content">
                    {message.blockType === 'thinking' && showThinkingBubbles ? (
                      <div class="thinking-content">
                        <div class="thinking-header">Thought Process</div>
                        <div class="thinking-body">
                          <span class="thinking-icon">🤔</span>
                          {(message.thinking || message.content || '').trimStart()}
                        </div>
                      </div>
                    ) : message.blockType === 'tool' ? (
                      <div class="tool-message-content">
                        <span class="tool-icon">🔧</span>
                        <span>Using {message.toolName || 'tool'}...</span>
                      </div>
                    ) : (
                      <div class="message-content" dangerouslySetInnerHTML={{ __html: renderMarkdown((message.content || '').trimStart()) }} />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <form class="chat-input-form" onSubmit={handleSendMessage}>
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onInput={(e) => setInputMessage((e.target as HTMLInputElement).value)}
            placeholder="Type your message..."
            class="chat-input"
            disabled={isLoading}
          />
          <button type="submit" class="send-button" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
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