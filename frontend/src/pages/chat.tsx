import { useEffect, useState, useRef } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { route } from 'preact-router';
import '../styles/chat.css';
import { ChatService, Message } from '../services/chat.service';

interface ChatProps {
  agentId?: string;
}

export const Chat: ComponentType<ChatProps> = ({ agentId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const chatService = useRef<ChatService | null>(null);

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
            messages.map((message, index) => (
              <div key={index} class={`message ${message.role}`}>
                <div class="message-content">{message.content}</div>
              </div>
            ))
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