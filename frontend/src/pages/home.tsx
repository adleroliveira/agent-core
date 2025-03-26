import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { DefaultService } from '../api-client';
import { route } from 'preact-router';
import '../styles/home.css';

export const Home: ComponentType = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div class="home">
        <div class="hero-section">
          <h1>Welcome to Agent Core</h1>
          <p class="hero-description">Your AI Agent Management Platform</p>
          <div class="loading">Loading agents...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="home">
        <div class="hero-section">
          <h1>Welcome to Agent Core</h1>
          <p class="hero-description">Your AI Agent Management Platform</p>
          <p class="error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div class="home">
      <div class="hero-section">
        <h1>Welcome to Agent Core</h1>
        <p class="hero-description">Your AI Agent Management Platform</p>
        <div class="hero-actions">
          <button class="create-agent-button" onClick={handleCreateAgent}>
            Create New Agent
          </button>
        </div>
      </div>

      <div class="agents-section">
        <div class="section-header">
          <h2>Your Agents</h2>
          <p class="section-description">Manage and interact with your AI agents</p>
        </div>

        {agents.length === 0 ? (
          <div class="empty-state">
            <p>No agents found. Create your first agent to get started!</p>
          </div>
        ) : (
          <div class="agents-grid">
            {agents.map((agent) => (
              <div class="agent-card" key={agent.id}>
                <h4>{agent.name}</h4>
                <p>{agent.description}</p>
                <div class="agent-info">
                  <span>Model ID: {agent.modelId}</span>
                  <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
                </div>
                <button class="talk-to-agent-button" onClick={() => console.log('Talk to agent:', agent.id)}>
                  Talk to Agent
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 