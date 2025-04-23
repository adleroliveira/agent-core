import { FunctionalComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useToolsStudioStore } from '../stores/tools-studio.store';
import { MCPServerDto } from '../api-client/models/MCPServerDto';
import { CreateMCPServerDto } from '../api-client/models/CreateMCPServerDto';
import Markdown from 'markdown-to-jsx';
import '../styles/tools-studio.css';

export const ToolsStudio: FunctionalComponent = () => {
  const {
    state,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    selectServer,
    dismissCreateServerError,
    dismissError,
  } = useToolsStudioStore();

  const [formState, setFormState] = useState<CreateMCPServerDto>({
    name: '',
    provider: '',
    repository: '',
    command: '',
    args: [],
    env: {},
  });

  const [editingEnvKeys, setEditingEnvKeys] = useState<Record<string, string>>({});
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [jsonInput, setJsonInput] = useState<string>('');

  useEffect(() => {
    fetchServers();
  }, []);

  const cleanMarkdown = (text: string) => {
    return text
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  };

  const handleJsonImport = () => {
    try {
      const config = JSON.parse(jsonInput);
      if (!config.mcpServers) {
        throw new Error('Invalid configuration format. Expected mcpServers object.');
      }

      const serverName = Object.keys(config.mcpServers)[0];
      const serverConfig = config.mcpServers[serverName];

      if (!serverConfig) {
        throw new Error('No server configuration found.');
      }

      const newServer: CreateMCPServerDto = {
        name: serverName,
        provider: 'custom',
        repository: '',
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {},
      };

      setFormState(newServer);
      setActiveTab('form');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error parsing JSON: ${errorMessage}`);
    }
  };

  const renderToolModal = () => {
    if (!selectedTool) return null;

    return (
      <div class="tool-modal-overlay" onClick={() => setSelectedTool(null)}>
        <div class="tool-modal" onClick={e => e.stopPropagation()}>
          <div class="tool-modal-header">
            <h3 class="tool-modal-title">{selectedTool.name}</h3>
            <button class="tool-modal-close" onClick={() => setSelectedTool(null)}>×</button>
          </div>
          <div class="tool-modal-content">
            <div class="tool-modal-description-container">
              <div class="tool-modal-description">
                <Markdown options={{
                  forceBlock: true,
                  wrapper: 'div',
                  overrides: {
                    p: {
                      component: 'p',
                      props: {
                        style: { marginBottom: '1em' }
                      }
                    },
                    pre: {
                      component: 'pre',
                      props: {
                        style: { whiteSpace: 'pre-wrap' }
                      }
                    }
                  }
                }}>{cleanMarkdown(selectedTool.description)}</Markdown>
              </div>
            </div>
            <div class="tool-parameters">
              <div class="parameters-header">Parameters</div>
              <table class="parameters-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selectedTool.inputSchema.properties).map(([name, prop]: [string, any]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{prop.type}</td>
                      <td>{selectedTool.inputSchema.required.includes(name) ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderServerCard = (server: MCPServerDto) => (
    <div
      class={`server-card ${state.selectedServer?.id === server.id ? 'selected' : ''}`}
      onClick={() => selectServer(server)}
    >
      <div class="server-card-header">
        <h4>{server.name}</h4>
        <button
          class="delete-server-button"
          onClick={(e) => {
            e.stopPropagation();
            deleteServer(server.id);
          }}
        >
          ×
        </button>
      </div>
      <div class="server-card-content">
        <p class="server-description" data-tooltip={server.description}>{server.description}</p>
        <div class="server-info">
          <div class="info-item">
            <span class="info-label">Provider</span>
            <span class="info-value">{server.provider}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Repository</span>
            <span class="info-value">{server.repository}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderServerForm = () => {
    const server = state.selectedServer || formState;
    const [showValidation, setShowValidation] = useState(false);

    const handleInputChange = (field: keyof CreateMCPServerDto, value: string | string[] | Record<string, string>) => {
      if (state.selectedServer) {
        selectServer({ ...state.selectedServer, [field]: value });
      } else {
        setFormState(prev => ({ ...prev, [field]: value }));
      }
    };

    const validateForm = (): boolean => {
      if (!server.name.trim()) return false;
      if (!server.provider.trim()) return false;
      if (!server.repository.trim()) return false;
      if (!server.command.trim()) return false;
      return true;
    };

    const handleSave = async () => {
      setShowValidation(true);
      if (!validateForm()) {
        return;
      }

      if (state.selectedServer) {
        await updateServer(state.selectedServer);
      } else {
        await createServer(formState);
      }
    };

    const handleEnvChange = (key: string, value: string) => {
      const newEnv = { ...server.env, [key]: value };
      if (state.selectedServer) {
        selectServer({ ...state.selectedServer, env: newEnv });
      } else {
        setFormState(prev => ({ ...prev, env: newEnv }));
      }
    };

    const handleAddEnv = () => {
      const newKey = '';
      const newEnv = { ...server.env, [newKey]: '' };

      if (state.selectedServer) {
        selectServer({ ...state.selectedServer, env: newEnv });
      } else {
        setFormState(prev => ({ ...prev, env: newEnv }));
      }
    };

    const handleEnvKeyChange = (oldKey: string, newKey: string) => {
      setEditingEnvKeys(prev => ({ ...prev, [oldKey]: newKey }));
    };

    const handleEnvKeyBlur = (oldKey: string) => {
      const newKey = editingEnvKeys[oldKey] || oldKey;
      if (newKey !== oldKey) {
        const newEnv = { ...server.env };
        const value = newEnv[oldKey];
        delete newEnv[oldKey];
        newEnv[newKey] = value;

        if (state.selectedServer) {
          selectServer({ ...state.selectedServer, env: newEnv });
        } else {
          setFormState(prev => ({ ...prev, env: newEnv }));
        }
      }
      setEditingEnvKeys(prev => {
        const newKeys = { ...prev };
        delete newKeys[oldKey];
        return newKeys;
      });
    };

    const handleRemoveEnv = (key: string) => {
      const newEnv = { ...server.env };
      delete newEnv[key];
      if (state.selectedServer) {
        selectServer({ ...state.selectedServer, env: newEnv });
      } else {
        setFormState(prev => ({ ...prev, env: newEnv }));
      }
    };

    return (
      <div class="server-details">
        <div class="server-details-header">
          <h3>{state.selectedServer ? 'Edit Server' : 'Create New Server'}</h3>
          <div class="server-details-actions">
            {state.isCreatingServer ? (
              <div class="creating-server-indicator">
                <span class="spinner"></span>
                <span>Creating Server...</span>
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={state.isCreatingServer}
              >
                Save
              </button>
            )}
          </div>
        </div>
        {state.createServerError && (
          <div class="error-message">
            <div class="error-content">
              {state.createServerError}
            </div>
            <button class="error-close-button" onClick={dismissCreateServerError}>
              ×
            </button>
          </div>
        )}
        <div class="tabs">
          <button
            class={`tab-button ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            Form
          </button>
          <button
            class={`tab-button ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            Import JSON
          </button>
        </div>
        {activeTab === 'form' ? (
          <div class="server-details-form">
            <div class="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={server.name}
                onChange={(e) => handleInputChange('name', e.currentTarget.value)}
                class={showValidation && !server.name.trim() ? 'error' : ''}
              />
              {showValidation && !server.name.trim() && <span class="error-message">Name is required</span>}
            </div>
            <div class="form-group">
              <label>Provider *</label>
              <input
                type="text"
                value={server.provider}
                onChange={(e) => handleInputChange('provider', e.currentTarget.value)}
                class={showValidation && !server.provider.trim() ? 'error' : ''}
              />
              {showValidation && !server.provider.trim() && <span class="error-message">Provider is required</span>}
            </div>
            <div class="form-group">
              <label>Repository *</label>
              <input
                type="text"
                value={server.repository}
                onChange={(e) => handleInputChange('repository', e.currentTarget.value)}
                class={showValidation && !server.repository.trim() ? 'error' : ''}
              />
              {showValidation && !server.repository.trim() && <span class="error-message">Repository is required</span>}
            </div>
            <div class="form-group">
              <label>Command *</label>
              <input
                type="text"
                value={server.command}
                onChange={(e) => handleInputChange('command', e.currentTarget.value)}
                class={showValidation && !server.command.trim() ? 'error' : ''}
              />
              {showValidation && !server.command.trim() && <span class="error-message">Command is required</span>}
            </div>
            <div class="form-group">
              <label>Command Arguments</label>
              <div class="args-list">
                {server.args.map((arg, index) => (
                  <div class="arg-item" key={index}>
                    <input
                      type="text"
                      value={arg}
                      onChange={(e) => {
                        const newArgs = [...server.args];
                        newArgs[index] = e.currentTarget.value;
                        handleInputChange('args', newArgs);
                      }}
                      placeholder="Enter argument"
                    />
                    <button
                      class="remove-arg-button"
                      onClick={() => {
                        const newArgs = server.args.filter((_, i) => i !== index);
                        handleInputChange('args', newArgs);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  class="add-arg-button"
                  onClick={() => {
                    const newArgs = [...server.args, ''];
                    handleInputChange('args', newArgs);
                  }}
                >
                  Add Argument
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>Environment Variables</label>
              <div class="env-variables">
                {Object.entries(server.env).map(([key, value]) => (
                  <div class="env-variable" key={key}>
                    <input
                      type="text"
                      value={editingEnvKeys[key] !== undefined ? editingEnvKeys[key] : key}
                      placeholder="Key"
                      onChange={(e) => handleEnvKeyChange(key, e.currentTarget.value)}
                      onBlur={() => handleEnvKeyBlur(key)}
                    />
                    <input
                      type="text"
                      value={value}
                      placeholder="Value"
                      onChange={(e) => handleEnvChange(key, e.currentTarget.value)}
                    />
                    <button onClick={() => handleRemoveEnv(key)}>×</button>
                  </div>
                ))}
                <button
                  class="add-env-button"
                  onClick={handleAddEnv}
                >
                  Add Environment Variable
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div class="json-import-section">
            <textarea
              class="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.currentTarget.value)}
              placeholder="Paste your JSON configuration here..."
            />
            <button class="import-button" onClick={handleJsonImport}>
              Import Configuration
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderToolsSection = () => (
    <div class="tools-section">
      <div class="tools-section-header">
        <h3>Tools</h3>
      </div>
      {state.isLoading ? (
        <div class="loading-spinner">
          Loading tools...
        </div>
      ) : state.tools.length === 0 ? (
        <div class="empty-state">
          <h3>No Tools Available</h3>
          <p>This server doesn't have any tools configured yet.</p>
        </div>
      ) : (
        <div class="tools-list">
          {state.tools.map(tool => (
            <div
              class="tool-item"
              key={tool.name}
              onClick={() => setSelectedTool(tool)}
            >
              <div class="tool-header">
                <h4 class="tool-name">{tool.name}</h4>
              </div>
              <p class="tool-description">{tool.description}</p>
              <div class="tool-parameters">
                <div class="parameters-header">Parameters</div>
                <table class="parameters-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(tool.inputSchema.properties).map(([name, prop]: [string, any]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{prop.type}</td>
                        <td>{tool.inputSchema.required?.includes(name) ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      {renderToolModal()}
    </div>
  );

  return (
    <div class="tools-studio">
      {state.error && (
        <div class="error-message">
          <div class="error-content">
            {state.error}
          </div>
          <button class="error-close-button" onClick={dismissError}>
            ×
          </button>
        </div>
      )}
      <div class="tools-studio-header">
        <h2>Tools Studio (MCP Servers)</h2>
        <button class="create-new-server-button" onClick={() => {
          setFormState({
            name: '',
            provider: '',
            repository: '',
            command: '',
            args: [],
            env: {},
          });
          selectServer(null);
        }}>
          Create New Server
        </button>
      </div>

      <div class="tools-studio-content">
        <div class="servers-section">
          {state.isLoading ? (
            <div class="empty-state">
              <h3>Loading...</h3>
            </div>
          ) : state.error ? (
            <div class="empty-state">
              <h3>Error</h3>
              <p>{state.error}</p>
            </div>
          ) : state.servers.length === 0 ? (
            <div class="empty-state">
              <h3>No Servers</h3>
              <p>Create your first server to get started</p>
            </div>
          ) : (
            <div class="servers-grid">
              {state.servers.map(renderServerCard)}
            </div>
          )}
        </div>

        <div class="details-section">
          <div class="server-form-section">
            {renderServerForm()}
          </div>

          <div class="tools-content-section">
            {state.selectedServer && renderToolsSection()}
          </div>
        </div>
      </div>
    </div>
  );
}; 