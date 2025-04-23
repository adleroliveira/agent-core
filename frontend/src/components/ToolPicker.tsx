import { ComponentType } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { McpServersService } from '../api-client/services/McpServersService';
import { MCPServerDto } from '../api-client/models/MCPServerDto';
import { McpToolDto } from '../api-client/models/McpToolDto';
import Markdown from 'markdown-to-jsx';
import '../styles/tool-picker.css';

interface ToolPickerProps {
  tools: McpToolDto[];
  selectedTools: string[];
  onToolToggle: (toolName: string) => void;
}

export const ToolPicker: ComponentType<ToolPickerProps> = ({ selectedTools, onToolToggle }) => {
  const [mcpServers, setMcpServers] = useState<MCPServerDto[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverTools, setServerTools] = useState<McpToolDto[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpToolDto | null>(null);

  useEffect(() => {
    const fetchMcpServers = async () => {
      try {
        const servers = await McpServersService.mcpServerControllerGetAllMcpServers();
        setMcpServers(servers);
        if (servers.length > 0) {
          setSelectedServer(servers[0].id);
        }
      } catch (err) {
        setError('Failed to load MCP servers');
        console.error('Error fetching MCP servers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMcpServers();
  }, []);

  useEffect(() => {
    const fetchServerTools = async () => {
      if (!selectedServer) {
        setServerTools([]);
        return;
      }

      try {
        const server = await McpServersService.mcpServerControllerGetMcpServer(selectedServer);
        setServerTools(server.tools || []);
      } catch (err) {
        setError('Failed to load server tools');
        console.error('Error fetching server tools:', err);
      }
    };

    fetchServerTools();
  }, [selectedServer]);

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
              }}>{selectedTool.description}</Markdown>
            </div>
            {selectedTool.inputSchema && (
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
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div>Loading MCP servers...</div>;
  }

  if (error) {
    return <div class="error">{error}</div>;
  }

  return (
    <div class="tool-picker">
      <div class="server-selector">
        <h3>Select MCP Server</h3>
        <div class="server-grid">
          {mcpServers.map(server => (
            <div
              key={server.id}
              class={`server-card ${selectedServer === server.id ? 'selected' : ''}`}
              onClick={() => setSelectedServer(server.id)}
            >
              <div class="server-provider">{server.provider}</div>
              <div class="server-content">
                <div class="server-field">
                  <span class="field-label">Name</span>
                  <span class="field-value">{server.name}</span>
                </div>
                <div class="server-field">
                  <span class="field-label">Command</span>
                  <span class="field-value">{server.command}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div class="tools-section">
        <h3>Available Tools</h3>
        <div class="tools-grid">
          {serverTools.map(tool => (
            <div
              key={tool.id}
              class="tool-card"
              onClick={() => setSelectedTool(tool)}
            >
              <div class="tool-header">
                <label class="tool-checkbox" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool.id)}
                    onChange={() => onToolToggle(tool.id)}
                  />
                  <span class="tool-name">{tool.name}</span>
                </label>
              </div>
              <div class="tool-content">
                <div class="tool-field">
                  <span class="field-label">Description</span>
                  <div class="field-value tool-description" title={tool.description}>
                    {tool.description}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {renderToolModal()}
    </div>
  );
}; 