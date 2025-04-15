import { useState, useEffect } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { AgentsService, ToolsService } from '../api-client';
import { route } from 'preact-router';
import { ModelService } from '../services/models.service';
import type { ModelInfoDto } from '../api-client/models/ModelInfoDto';
import { ModelSelector } from '../components/ModelSelector';
import '../styles/create-agent.css';

interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: any;
}

export const CreateAgent: ComponentType = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    modelId: '',
    systemPrompt: 'You are a helpful agent that assists users with their tasks. You are friendly, professional, and always aim to provide accurate and useful information.',
    tools: [] as string[],
  });
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [_availableModels, setAvailableModels] = useState<ModelInfoDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const [tools, models] = await Promise.all([
          ToolsService.toolsControllerGetAllTools(),
          ModelService.getInstance().getAvailableModels()
        ]);
        setAvailableTools(tools);
        setAvailableModels(models);
        // Set default model if available
        if (models.length > 0) {
          setFormData(prev => ({ ...prev, modelId: models[0].id }));
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load available tools and models');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await AgentsService.agentControllerCreateAgent({
        name: formData.name,
        description: formData.description,
        modelId: formData.modelId,
        systemPrompt: formData.systemPrompt,
        tools: formData.tools,
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
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    setFormData(prev => ({
      ...prev,
      [target.name]: target.value
    }));
  };

  const handleToolToggle = (toolName: string) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.includes(toolName)
        ? prev.tools.filter(t => t !== toolName)
        : [...prev.tools, toolName]
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
          <label>Model</label>
          <ModelSelector
            value={formData.modelId}
            onChange={(modelId) => setFormData(prev => ({ ...prev, modelId }))}
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

        <div class="form-group">
          <label>Available Tools</label>
          <div class="tools-grid">
            {availableTools.map(tool => (
              <div key={tool.id} class="tool-card">
                <label class="tool-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.tools.includes(tool.name)}
                    onChange={() => handleToolToggle(tool.name)}
                  />
                  <div class="tool-info">
                    <h4>{tool.name}</h4>
                    <p>{tool.description}</p>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {error && <p class="error">{error}</p>}

        <div class="form-actions">
          <button type="button" class="cancel-button" onClick={() => route('/')}>
            Cancel
          </button>
          <button
            type="submit"
            class="submit-button"
            disabled={loading || loadingData}
          >
            {loading ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </form>
    </div>
  );
}; 