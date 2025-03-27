import { useEffect, useState, useRef } from 'preact/hooks';
import type { ComponentType } from 'preact';
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
  const [isUsingTool, setIsUsingTool] = useState(false);
  const chatService = useRef<ChatService | null>(null);

  // State for tracking streaming content
  const currentContentRef = useRef('');
  const currentBubbleTypeRef = useRef<'normal' | 'thinking' | 'tool'>('normal');
  const isInThinkingRef = useRef(false);
  const isInToolCallRef = useRef(false);

  useEffect(() => {
    if (agentId) {
      chatService.current = new ChatService(agentId);
    }
  }, [agentId]);

  const appendToLastMessage = (content: string, isThinking: boolean) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        if (isThinking && lastMessage.thinking !== undefined && !lastMessage.content) {
          lastMessage.thinking += content;
        } else if (!isThinking && lastMessage.content !== undefined && !lastMessage.thinking) {
          lastMessage.content += content;
        } else {
          // Create a new message if the type doesn't match
          newMessages.push({
            role: 'assistant',
            thinking: isThinking ? content : undefined,
            content: !isThinking ? content : ''
          });
        }
      } else {
        newMessages.push({
          role: 'assistant',
          thinking: isThinking ? content : undefined,
          content: !isThinking ? content : ''
        });
      }
      return newMessages;
    });
  };

  const addNewMessage = (bubbleType: 'normal' | 'thinking' | 'tool', content: string) => {
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant' as const,
        thinking: bubbleType === 'thinking' ? content : undefined,
        content: bubbleType === 'normal' || bubbleType === 'tool' ? content : ''
      }
    ]);
  };

  const handleSendMessage = async (e: Event) => {
    e.preventDefault();
    if (!inputMessage.trim() || !chatService.current || isLoading) return;

    const userMessage = { role: 'user' as const, content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsUsingTool(false);

    // Reset streaming state
    currentContentRef.current = '';
    currentBubbleTypeRef.current = 'normal';
    isInThinkingRef.current = false;
    isInToolCallRef.current = false;

    try {
      if (isStreaming) {
        await chatService.current.sendStreamingMessage(
          inputMessage,
          async (chunk) => {
            try {
              const data = JSON.parse(chunk);

              // Reset tool call state if this is not a tool-related chunk
              if (
                !data.toolCalls &&
                !(data.content && (
                  data.content.startsWith('\nExecuting ') ||
                  data.content.startsWith('\nTool ') ||
                  data.content.startsWith('\nProcessing results')
                ))
              ) {
                if (isInToolCallRef.current) {
                  isInToolCallRef.current = false;
                  currentBubbleTypeRef.current = 'normal';
                }
              }

              // Handle tool calls
              if (data.toolCalls) {
                setIsUsingTool(true);
                return;
              }

              // Handle tool execution messages
              if (
                data.content &&
                (data.content.startsWith('\nExecuting ') ||
                  data.content.startsWith('\nTool ') ||
                  data.content.startsWith('\nProcessing results'))
              ) {
                setIsUsingTool(true);
                return;
              }

              if (!data.content) return;

              // Accumulate content
              currentContentRef.current += data.content;
              let remainingContent = currentContentRef.current;

              // Handle opening thinking tag without closing
              if (remainingContent.includes('<thinking>') && !remainingContent.includes('</thinking>')) {
                const [before, after] = remainingContent.split('<thinking>', 2);
                if (before.trim() && !isInToolCallRef.current) {
                  if (messages[messages.length - 1]?.content && !messages[messages.length - 1]?.thinking) {
                    appendToLastMessage(before.trim(), false);
                  } else {
                    addNewMessage('normal', before.trim());
                  }
                }
                remainingContent = '<thinking>' + after;
                isInThinkingRef.current = true;
                currentBubbleTypeRef.current = 'thinking';
                currentContentRef.current = remainingContent;
              }
              // Handle closing thinking tag when already in thinking
              else if (isInThinkingRef.current && remainingContent.includes('</thinking>')) {
                const [thinkingPart, rest] = remainingContent.split('</thinking>', 2);
                const thinkingText = thinkingPart.replace('<thinking>', '').trim();
                if (thinkingText) {
                  if (messages[messages.length - 1]?.thinking) {
                    appendToLastMessage(thinkingText, true);
                  } else {
                    addNewMessage('thinking', thinkingText);
                  }
                }
                remainingContent = rest.trim();
                isInThinkingRef.current = false;
                currentBubbleTypeRef.current = 'normal';
                currentContentRef.current = remainingContent;

                if (remainingContent && !isInToolCallRef.current) {
                  if (messages[messages.length - 1]?.content && !messages[messages.length - 1]?.thinking) {
                    appendToLastMessage(remainingContent, false);
                  } else {
                    addNewMessage('normal', remainingContent);
                  }
                  currentContentRef.current = '';
                }
              }
              // Process complete thinking sections
              else if (remainingContent.includes('<thinking>') && remainingContent.includes('</thinking>')) {
                const thinkingStart = remainingContent.indexOf('<thinking>');
                const thinkingEnd = remainingContent.indexOf('</thinking>') + '</thinking>'.length;
                const beforeThinking = remainingContent.substring(0, thinkingStart);
                const thinkingSection = remainingContent.substring(thinkingStart, thinkingEnd);
                const afterThinking = remainingContent.substring(thinkingEnd);

                // Process content before thinking tag
                if (beforeThinking.trim() && !isInToolCallRef.current) {
                  if (messages[messages.length - 1]?.content && !messages[messages.length - 1]?.thinking) {
                    appendToLastMessage(beforeThinking.trim(), false);
                  } else {
                    addNewMessage('normal', beforeThinking.trim());
                  }
                }

                // Process thinking section
                const thinkingText = thinkingSection.replace('<thinking>', '').replace('</thinking>', '').trim();
                if (thinkingText) {
                  if (isInThinkingRef.current && messages[messages.length - 1]?.thinking) {
                    appendToLastMessage(thinkingText, true);
                  } else {
                    addNewMessage('thinking', thinkingText);
                  }
                }

                remainingContent = afterThinking;
                currentContentRef.current = remainingContent;
                isInThinkingRef.current = false;
                currentBubbleTypeRef.current = 'normal';
              }
              // Handle regular content
              else if (!isInThinkingRef.current && !isInToolCallRef.current) {
                const trimmedContent = remainingContent.trim();
                if (trimmedContent && !trimmedContent.includes('<thinking>')) {
                  if (messages[messages.length - 1]?.content && !messages[messages.length - 1]?.thinking) {
                    appendToLastMessage(trimmedContent, false);
                  } else {
                    addNewMessage('normal', trimmedContent);
                  }
                  currentContentRef.current = '';
                }
              }
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          },
          () => {
            // Finalize remaining content
            if (currentContentRef.current.trim()) {
              const finalContent = currentContentRef.current
                .replace(/<thinking>.*$/g, '') // Strip unclosed thinking tags
                .trim();
              if (finalContent && !isInToolCallRef.current) {
                if (isInThinkingRef.current && messages[messages.length - 1]?.thinking) {
                  appendToLastMessage(finalContent, true);
                } else if (isInThinkingRef.current) {
                  addNewMessage('thinking', finalContent);
                } else if (messages[messages.length - 1]?.content && !messages[messages.length - 1]?.thinking) {
                  appendToLastMessage(finalContent, false);
                } else {
                  addNewMessage('normal', finalContent);
                }
              }
              currentContentRef.current = '';
            }
            setIsLoading(false);
            setIsUsingTool(false);
          },
          (error) => {
            console.error('Error in streaming:', error);
            setIsLoading(false);
            setIsUsingTool(false);
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
            <>
              {messages.map((message, index) => (
                <div key={index} class={`message ${message.role} ${message.thinking ? 'thinking' : ''}`}>
                  <div class="message-content">
                    {message.thinking ? (
                      <div class="thinking-content">
                        <span class="thinking-icon">🤔</span>
                        {message.thinking}
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {isUsingTool && (
                <div class="tool-usage-indicator">
                  <span class="tool-icon">🔧</span>
                  <span>Using tool...</span>
                </div>
              )}
            </>
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