import { useEffect, useState } from 'preact/hooks';
import { useMemoryStore } from '../stores/memory.store';
import { FrontendAgentService } from '@/services/agent.service';
import '../styles/memory.css';

interface MemoryProps {
  agentId: string;
  conversationId: string;
  agentService: FrontendAgentService;
}

// We need to be more explicit with this type
type PathType = Array<string>;

interface MemoryNodeProps {
  nodeKey: string;
  value: any;
  path: PathType;
  onUpdate: (path: PathType, value: any) => void;
  onDelete: (path: PathType) => void;
}

const MemoryNode = ({ nodeKey, value, path, onUpdate, onDelete }: MemoryNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleUpdate = () => {
    onUpdate(path, editValue);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete(path);
  };

  const handleAdd = () => {
    if (newKey && newValue) {
      const newPath = path.concat([newKey]);
      onUpdate(newPath, newValue);
      setIsAdding(false);
      setNewKey('');
      setNewValue('');
    }
  };

  if (typeof value === 'object' && value !== null) {
    return (
      <div class="memory-node">
        <div class="memory-node-header">
          <button class="expand-button" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? '▼' : '▶'}
          </button>
          <span class="memory-key">{nodeKey}:</span>
          <button class="add-button" onClick={() => setIsAdding(true)}>+</button>
          <button class="delete-button" onClick={handleDelete}>×</button>
        </div>
        {isExpanded && (
          <div class="memory-children">
            {isAdding && (
              <div class="memory-node new-node">
                <div class="memory-node-header">
                  <input
                    type="text"
                    placeholder="Key"
                    value={newKey}
                    onChange={(e) => setNewKey((e.target as HTMLInputElement).value)}
                    class="memory-input"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newValue}
                    onChange={(e) => setNewValue((e.target as HTMLInputElement).value)}
                    class="memory-input"
                  />
                  <button class="save-button" onClick={handleAdd}>✓</button>
                  <button class="cancel-button" onClick={() => setIsAdding(false)}>×</button>
                </div>
              </div>
            )}
            {Object.entries(value).map(([childKey, childValue]) => {
              const newPath: PathType = path.concat([childKey]);
              return (
                <MemoryNode
                  key={childKey}
                  nodeKey={childKey}
                  value={childValue}
                  path={newPath}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div class="memory-node">
      <div class="memory-node-header">
        <span class="memory-key">{nodeKey}:</span>
        {isEditing ? (
          <>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue((e.target as HTMLInputElement).value)}
              class="memory-input"
            />
            <button class="save-button" onClick={handleUpdate}>✓</button>
          </>
        ) : (
          <>
            <span class="memory-value">{value}</span>
            <button class="edit-button" onClick={() => setIsEditing(true)}>✎</button>
            <button class="delete-button" onClick={handleDelete}>×</button>
          </>
        )}
      </div>
    </div>
  );
};

export const Memory = ({ agentId, conversationId, agentService }: MemoryProps) => {
  const { state, fetchMemory, updateMemory } = useMemoryStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    fetchMemory(agentId, conversationId, agentService);
  }, [agentId, conversationId]);

  const handleUpdate = (path: PathType, value: any) => {
    if (!state.memory) return;

    const updatedMemory = { ...state.memory };
    let current = updatedMemory;

    // Navigate to the correct location in the object
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }

    // Update the value
    current[path[path.length - 1]] = value;

    updateMemory(agentId, conversationId, updatedMemory, agentService);
  };

  const handleDelete = (path: PathType) => {
    if (!state.memory) return;

    const updatedMemory = { ...state.memory };
    let current = updatedMemory;

    // Navigate to the parent of the node to delete
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }

    // Delete the node
    delete current[path[path.length - 1]];

    updateMemory(agentId, conversationId, updatedMemory, agentService);
  };

  const handleAddRoot = () => {
    if (newKey && newValue && state.memory) {
      const updatedMemory = { ...state.memory, [newKey]: newValue };
      updateMemory(agentId, conversationId, updatedMemory, agentService);
      setIsAdding(false);
      setNewKey('');
      setNewValue('');
    }
  };

  if (state.isLoading) {
    return <div class="memory-container loading">Loading memory...</div>;
  }

  if (state.error) {
    return <div class="memory-container error">Error: {state.error}</div>;
  }

  if (!state.memory) {
    return <div class="memory-container empty">No memory data available</div>;
  }

  if (Object.keys(state.memory).length === 0) {
    return (
      <div class="memory-container">
        <div class="memory-content">
          <div class="memory-empty">
            <p>Memory is empty</p>
            <button class="add-button" onClick={() => setIsAdding(true)}>Add New Node</button>
          </div>
          {isAdding && (
            <div class="memory-node new-node">
              <div class="memory-node-header">
                <input
                  type="text"
                  placeholder="Key"
                  value={newKey}
                  onChange={(e) => setNewKey((e.target as HTMLInputElement).value)}
                  class="memory-input"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newValue}
                  onChange={(e) => setNewValue((e.target as HTMLInputElement).value)}
                  class="memory-input"
                />
                <button class="save-button" onClick={handleAddRoot}>✓</button>
                <button class="cancel-button" onClick={() => setIsAdding(false)}>×</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="memory-container">
      <div class="memory-content">
        <div class="memory-header">
          <button class="add-button" onClick={() => setIsAdding(true)}>Add New Node</button>
        </div>
        {isAdding && (
          <div class="memory-node new-node">
            <div class="memory-node-header">
              <input
                type="text"
                placeholder="Key"
                value={newKey}
                onChange={(e) => setNewKey((e.target as HTMLInputElement).value)}
                class="memory-input"
              />
              <input
                type="text"
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue((e.target as HTMLInputElement).value)}
                class="memory-input"
              />
              <button class="save-button" onClick={handleAddRoot}>✓</button>
              <button class="cancel-button" onClick={() => setIsAdding(false)}>×</button>
            </div>
          </div>
        )}
        {Object.entries(state.memory).map(([key, value]) => {
          const initialPath: PathType = [key];
          return (
            <MemoryNode
              key={key}
              nodeKey={key}
              value={value}
              path={initialPath}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          );
        })}
      </div>
    </div>
  );
};