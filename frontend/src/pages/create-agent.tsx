import { useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { DefaultService } from '../api-client';
import { route } from 'preact-router';
import '../styles/create-agent.css';

export const CreateAgent: ComponentType = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    modelId: 'us.amazon.nova-lite-v1:0',
    systemPrompt: 'You are a helpful agent that assists users with their tasks. You are friendly, professional, and always aim to provide accurate and useful information.',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await DefaultService.agentControllerCreateAgent({
        name: formData.name,
        description: formData.description,
        modelId: formData.modelId,
        systemPrompt: formData.systemPrompt,
      });
      route('/');
    } catch (err) {
      setError('Failed to create agent. Please try again.');
      console.error('Error creating agent:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    setFormData(prev => ({
      ...prev,
      [target.name]: target.value
    }));
  };

  return (
    <div class="create-agent-page">
      <h2>Create New Agent</h2>

      <form onSubmit={handleSubmit} class="create-agent-form">
        <div class="form-group">
          <label for="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter agent name"
          />
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            placeholder="Enter agent description"
            rows={4}
          />
        </div>

        <div class="form-group">
          <label for="modelId">Model ID</label>
          <input
            type="text"
            id="modelId"
            name="modelId"
            value={formData.modelId}
            onChange={handleChange}
            required
            placeholder="Enter model ID"
          />
        </div>

        <div class="form-group">
          <label for="systemPrompt">System Prompt</label>
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            value={formData.systemPrompt}
            onChange={handleChange}
            required
            placeholder="Enter the system prompt for the agent"
            rows={6}
          />
        </div>

        {error && <p class="error">{error}</p>}

        <div class="form-actions">
          <button type="button" class="cancel-button" onClick={() => route('/')}>
            Cancel
          </button>
          <button type="submit" class="submit-button" disabled={loading}>
            {loading ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </form>
    </div>
  );
}; 