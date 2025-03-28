import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { DefaultService } from '../api-client';
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
        const response = await DefaultService.agentControllerGetAllAgents();
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
      await DefaultService.agentControllerDeleteAgent(agentId);
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
        <div class="header-content">
          <h1>Agents</h1>
          <button class="create-agent-button" onClick={handleCreateAgent}>
            Create Agent
          </button>
        </div>
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
                  <span class="status active">Active</span>
                </div>
                <p class="agent-description">{agent.description}</p>
                <div class="agent-info">
                  <div class="info-item">
                    <span class="info-label">Model ID:</span>
                    <span class="info-value">{agent.modelId}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Created:</span>
                    <span class="info-value">{new Date(agent.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div class="agent-actions">
                  <button class="talk-to-agent-button" onClick={() => route(`/chat/${agent.id}`)}>
                    Talk to Agent
                  </button>
                  {deleteConfirmId === agent.id ? (
                    <div class="delete-confirmation">
                      <p>Are you sure?</p>
                      <div class="confirmation-buttons">
                        <button
                          class="confirm-delete-button"
                          onClick={() => handleDeleteAgent(agent.id)}
                        >
                          Delete
                        </button>
                        <button
                          class="cancel-delete-button"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      class="delete-agent-button"
                      onClick={() => setDeleteConfirmId(agent.id)}
                    >
                      Delete Agent
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 