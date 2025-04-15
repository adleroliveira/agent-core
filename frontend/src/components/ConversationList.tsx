import { ComponentType } from 'preact';
import '../styles/conversation-list.css';

interface Conversation {
  stateId: string;
  createdAt: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  onSelectConversation: (stateId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (stateId: string) => void;
}

export const ConversationList: ComponentType<ConversationListProps> = ({
  conversations,
  activeConversationId,
  isLoading,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation
}) => (
  <div class="conversations-sidebar">
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ul class="conversation-list" style={{ flex: 1 }}>
        <li
          class="conversation-item new-conversation-item"
          onClick={() => !isLoading && onNewConversation()}
          style={{ cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
          tabIndex={0}
          aria-disabled={isLoading}
        >
          <div class="conversation-title">+ New Conversation</div>
        </li>
        {conversations.length > 0 ? (
          conversations.map(conv => (
            <li
              key={conv.stateId}
              class={`conversation-item ${conv.stateId === activeConversationId ? 'active' : ''}`}
              onClick={() => onSelectConversation(conv.stateId)}
            >
              <div class={`conversation-title`}>
                Conversation {conv.stateId.slice(0, 8)}...
              </div>
              <div class="conversation-date">
                {new Date(conv.createdAt).toLocaleDateString()}
              </div>
              <button
                class="delete-conversation-button"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteConversation(conv.stateId);
                }}
                disabled={isLoading}
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
  </div>
); 