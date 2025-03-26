import { useEffect, useState, useRef } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { route } from 'preact-router';
import '../styles/chat.css';
import { ChatService, Message } from '../services/chat.service';

interface ChatProps {
  agentId?: string;
}

interface ParsedMessage {
  thinking?: string;
  content: string;
}

export const Chat: ComponentType<ChatProps> = ({ agentId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const chatService = useRef<ChatService | null>(null);

  const parseMessage = (content: string): ParsedMessage => {
    const thinkingMatch = content.match(/<thinking>(.*?)<\/thinking>/s);
    if (thinkingMatch) {
      return {
        thinking: thinkingMatch[1].trim(),
        content: content.replace(/<thinking>.*?<\/thinking>/s, '').trim()
      };
    }
    return { content };
  };

  const toggleThinking = (index: number) => {
    setExpandedThinking(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (agentId) {
      chatService.current = new ChatService(agentId);
    }
  }, [agentId]);

  const handleSendMessage = async (e: Event) => {
    e.preventDefault();
    if (!inputMessage.trim() || !chatService.current || isLoading) return;

    const userMessage = { role: 'user' as const, content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      if (isStreaming) {
        let assistantMessage = { role: 'assistant' as const, content: '' };
        setMessages(prev => [...prev, assistantMessage]);

        await chatService.current.sendStreamingMessage(
          inputMessage,
          (chunk) => {
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.content += chunk;
                return newMessages;
              }
              return prev;
            });
          },
          () => {
            setIsLoading(false);
          },
          (error) => {
            console.error('Error in streaming:', error);
            setIsLoading(false);
          }
        );
      } else {
        const response = await chatService.current.sendMessage(inputMessage, false);
        setMessages(prev => [...prev, response]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  return (
    <div class="chat-page">
      <div class="chat-container">
        <div class="chat-header">
          <h1>Chat with Agent</h1>
          <p class="chat-description">Interact with your AI agent</p>
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
        </div>

        <div class="chat-messages">
          {messages.length === 0 ? (
            <div class="empty-chat">
              <p>Start a conversation with your agent</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const parsedMessage = parseMessage(message.content);
              return (
                <div key={index} class={`message ${message.role}`}>
                  {parsedMessage.thinking && (
                    <div class="thinking-section">
                      <div
                        class="thinking-header"
                        onClick={() => toggleThinking(index)}
                      >
                        <svg
                          class={`thinking-icon ${expandedThinking.has(index) ? 'expanded' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <span>Thought Process</span>
                      </div>
                      <div class={`thinking-content ${expandedThinking.has(index) ? 'expanded' : ''}`}>
                        {parsedMessage.thinking}
                      </div>
                    </div>
                  )}
                  <div class="message-content">{parsedMessage.content}</div>
                </div>
              );
            })
          )}
        </div>

        <form class="chat-input-form" onSubmit={handleSendMessage}>
          <input
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
        <h2>Configurations</h2>
        <div class="config-placeholder">
          <p>Configuration options will appear here</p>
        </div>
      </div>
    </div>
  );
}; 