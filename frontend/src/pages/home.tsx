import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { AgentService } from '../api-client';
import { route } from 'preact-router';
import '../styles/home.css';

export const Home: ComponentType = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await AgentService.agentControllerGetAllAgents();
        setAgents(response);
      } catch (err) {
        setError('Failed to fetch agents. Please try again later.');
        console.error('Error fetching agents:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const handleCreateAgent = () => {
    route('/create-agent');
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await AgentService.agentControllerDeleteAgent(agentId);
      setAgents(agents.filter(agent => agent.id !== agentId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting agent:', err);
      setError('Failed to delete agent. Please try again.');
    }
  };

  if (loading) {
    return (
      <div class="home">
        <div class="loading">
          <div class="loading-spinner"></div>
          <span>Loading agents...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="home">
        <div class="error-container">
          <p class="error">{error}</p>
          <button class="retry-button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="home">
      <div class="page-header">
        <h1>Agents</h1>
        <button class="create-agent-button" onClick={handleCreateAgent}>
          <span>+</span> New Agent
        </button>
      </div>

      <div class="agents-section">
        {agents.length === 0 ? (
          <div class="empty-state">
            <h3>No Agents</h3>
            <p>Get started by creating your first agent</p>
          </div>
        ) : (
          <div class="agents-grid">
            {agents.map((agent) => (
              <div class="agent-card" key={agent.id}>
                <div class="agent-card-header">
                  <h4>{agent.name}</h4>
                  <div class="header-actions">
                    <button
                      class="delete-agent-button"
                      onClick={() => setDeleteConfirmId(agent.id)}
                      title="Delete agent"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div class="agent-card-content">
                  <div class="agent-card-main">
                    <p class="agent-description">{agent.description}</p>
                    <div class="agent-info">
                      <div class="info-item">
                        <span class="info-label">Model ID</span>
                        <span class="info-value">{agent.modelId}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">Created</span>
                        <span class="info-value">{new Date(agent.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div class="agent-card-bottom">
                    <div class="agent-tools">
                      <span class="tools-label">Tools:</span>
                      {agent.tools?.map((tool: { id: string; name: string; description: string }) => (
                        <span class="tool-tag" key={tool.id}>
                          {tool.name}
                        </span>
                      ))}
                    </div>
                    <div class="agent-actions">
                      <button class="talk-to-agent-button" onClick={() => route(`/chat/${agent.id}`)}>
                        Talk to Agent
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {deleteConfirmId && (
        <div class="modal-overlay">
          <div class="delete-modal">
            <h3>Delete Agent</h3>
            <p>Are you sure you want to delete this agent? This action cannot be undone.</p>
            <div class="modal-actions">
              <button class="cancel-delete-button" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button class="confirm-delete-button" onClick={() => handleDeleteAgent(deleteConfirmId)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 