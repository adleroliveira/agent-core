import { useState, useEffect } from 'preact/hooks';
import type { ModelInfoDto } from '../api-client/models/ModelInfoDto';
import { ModelService } from '../services/models.service';
import '../styles/model-selector.css';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export const ModelSelector = ({ value, onChange }: ModelSelectorProps) => {
  const [models, setModels] = useState<ModelInfoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [showProvisionedOnly, setShowProvisionedOnly] = useState(false);
  const [showEmbeddingOnly, setShowEmbeddingOnly] = useState(false);
  const [showImageOnly, setShowImageOnly] = useState(false);
  const [showVideoOnly, setShowVideoOnly] = useState(false);
  const [showSpeechOnly, setShowSpeechOnly] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('Amazon');

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const availableModels = await ModelService.getInstance().getAvailableModels();
        setModels(availableModels);
      } catch (error) {
        console.error('Error fetching models:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const allModalities = Array.from(
    new Set(
      models.flatMap(model => [...model.inputModalities, ...model.outputModalities])
    )
  ).sort();

  const allProviders = Array.from(
    new Set(models.map(model => model.metadata?.provider || 'Unknown'))
  ).sort();

  const selectedModel = models.find(model => model.id === value);

  const filteredModels = models.filter(model => {
    const matchesSearch = model.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModality = selectedModality === 'all' ||
      model.inputModalities.includes(selectedModality) ||
      model.outputModalities.includes(selectedModality);

    const matchesActiveFilter = showInactive || model.active !== false;

    const matchesProvider = selectedProvider === 'all' ||
      model.metadata?.provider === selectedProvider;

    const isProvisionedOnly = model.metadata?.inferenceTypes?.length === 1 &&
      model.metadata.inferenceTypes[0] === 'PROVISIONED';

    const matchesProvisionedFilter = showProvisionedOnly || !isProvisionedOnly;

    const isEmbeddingOnly = model.outputModalities.length === 1 &&
      model.outputModalities[0] === 'embeddings';
    const matchesEmbeddingFilter = showEmbeddingOnly || !isEmbeddingOnly;

    const isImageOnly = model.outputModalities.length === 1 &&
      model.outputModalities[0] === 'image';
    const matchesImageFilter = showImageOnly || !isImageOnly;

    const isVideoOnly = model.outputModalities.length === 1 &&
      model.outputModalities[0] === 'video';
    const matchesVideoFilter = showVideoOnly || !isVideoOnly;

    const isSpeechOnly = model.inputModalities.length === 1 &&
      model.inputModalities[0] === 'speech';
    const matchesSpeechFilter = showSpeechOnly || !isSpeechOnly;

    return matchesSearch && matchesModality && matchesActiveFilter &&
      matchesProvider && matchesProvisionedFilter &&
      matchesEmbeddingFilter && matchesImageFilter && matchesVideoFilter && matchesSpeechFilter;
  });

  const handleProviderClick = (provider: string) => {
    setSelectedProvider(provider);
  };

  if (loading) {
    return <div class="loading">Loading models...</div>;
  }

  return (
    <div class="model-selector">
      {selectedModel && (
        <div class="selected-model-display">
          <h3>Selected Model</h3>
          <div class="selected-model-info">
            <div class="selected-model-id">{selectedModel.id}</div>
            <div class="selected-model-modalities">
              {selectedModel.inputModalities.map(modality => (
                <span key={`input-${modality}`} class="modality-tag input">
                  {modality}
                </span>
              ))}
              {selectedModel.outputModalities.map(modality => (
                <span key={`output-${modality}`} class="modality-tag output">
                  {modality}
                </span>
              ))}
            </div>
            <div class="selected-model-provider">
              Provider: {selectedModel.metadata?.provider || 'Unknown'}
            </div>
          </div>
        </div>
      )}

      <div class="model-selector-filters">
        <div class="provider-selector">
          {allProviders.map(provider => (
            <button
              key={provider}
              type="button"
              class={`provider-button ${selectedProvider === provider ? 'selected' : ''}`}
              onClick={() => handleProviderClick(provider)}
            >
              {provider}
            </button>
          ))}
          <button
            type="button"
            class={`provider-button ${selectedProvider === 'all' ? 'selected' : ''}`}
            onClick={() => handleProviderClick('all')}
          >
            All Providers
          </button>
        </div>

        <div class="secondary-filters">
          <input
            type="text"
            placeholder="Search models..."
            value={searchTerm}
            onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
            class="model-search"
          />
          <select
            value={selectedModality}
            onChange={(e) => setSelectedModality((e.target as HTMLSelectElement).value)}
            class="modality-filter"
          >
            <option value="all">All Modalities</option>
            {allModalities.map(modality => (
              <option key={modality} value={modality}>
                {modality.charAt(0).toUpperCase() + modality.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div class="model-toggles">
          <div class="model-toggle">
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive((e.target as HTMLInputElement).checked)}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Inactive Models</span>
          </div>
          <div class="model-toggle">
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={showProvisionedOnly}
                onChange={(e) => setShowProvisionedOnly((e.target as HTMLInputElement).checked)}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Provisioned Only</span>
          </div>
          <div class="model-toggle">
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={showEmbeddingOnly}
                onChange={(e) => setShowEmbeddingOnly((e.target as HTMLInputElement).checked)}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Embedding Models</span>
          </div>
          <div class="model-toggle">
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={showImageOnly}
                onChange={(e) => setShowImageOnly((e.target as HTMLInputElement).checked)}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Image Models</span>
          </div>
          <div class="model-toggle">
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={showVideoOnly}
                onChange={(e) => setShowVideoOnly((e.target as HTMLInputElement).checked)}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Video Models</span>
          </div>
          <div class="model-toggle">
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={showSpeechOnly}
                onChange={(e) => setShowSpeechOnly((e.target as HTMLInputElement).checked)}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Speech Models</span>
          </div>
        </div>
      </div>

      <div class="model-table">
        <div class="model-table-header">
          <div class="model-id">Model ID</div>
          <div class="model-modalities">
            Modalities
          </div>
          <div class="model-id">Provider</div>
          <div class="model-streaming">Streaming</div>
          <div class="model-tools">Tools</div>
          <div class="model-status">Status</div>
        </div>
        {filteredModels.map(model => {
          const isProvisionedOnly = model.metadata?.inferenceTypes?.length === 1 &&
            model.metadata.inferenceTypes[0] === 'PROVISIONED';
          const isEmbeddingOnly = model.outputModalities.length === 1 &&
            model.outputModalities[0] === 'embeddings';
          const isImageOnly = model.outputModalities.length === 1 &&
            model.outputModalities[0] === 'image';
          const isVideoOnly = model.outputModalities.length === 1 &&
            model.outputModalities[0] === 'video';
          const isSpeechOnly = model.inputModalities.length === 1 &&
            model.inputModalities[0] === 'speech';
          return (
            <div
              key={model.id}
              class={`model-row ${value === model.id ? 'selected' : ''} ${model.active === false || isProvisionedOnly || isEmbeddingOnly || isImageOnly || isVideoOnly || isSpeechOnly ? 'inactive' : ''}`}
              onClick={() => model.active !== false && !isProvisionedOnly && !isEmbeddingOnly && !isImageOnly && !isVideoOnly && !isSpeechOnly && onChange(model.id)}
            >
              <div class="model-id">
                <h3>{model.id}</h3>
                {model.description && <p class="model-description">{model.description}</p>}
              </div>
              <div class="model-modalities">
                <div class="modality-group">
                  {model.inputModalities.map(modality => (
                    <span key={`input-${modality}`} class="modality-tag input">
                      {modality}
                    </span>
                  ))}
                  {model.outputModalities.map(modality => (
                    <span key={`output-${modality}`} class="modality-tag output">
                      {modality}
                    </span>
                  ))}
                </div>
              </div>
              <div class="model-provider">
                {model.metadata?.provider || 'Unknown'}
              </div>
              <div class="model-streaming">
                {model.supportsStreaming ? (
                  <span class="streaming-tag supported">Yes</span>
                ) : (
                  <span class="streaming-tag unsupported">No</span>
                )}
              </div>
              <div class="model-tools">
                {model.supportsToolCalls ? (
                  <span class="tools-tag supported">Yes</span>
                ) : (
                  <span class="tools-tag unsupported">No</span>
                )}
              </div>
              <div class="model-status">
                {model.active === false ? (
                  <span class="status-tag inactive">Inactive</span>
                ) : isProvisionedOnly ? (
                  <span class="status-tag inactive">Provisioned Only</span>
                ) : (
                  <span class="status-tag active">Active</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 