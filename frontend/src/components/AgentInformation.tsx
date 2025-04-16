import { useEffect, useState } from 'preact/hooks';
import { FrontendAgentService } from '@/services/agent.service';
import { ToolDto } from '@/api-client/models/ToolDto';
import '../styles/agent-information.css';
import { Tools } from './Tools';

interface AgentResponse {
  id: string;
  name: string;
  description: string;
  modelId?: string;
  systemPrompt: string;
  tools?: ToolDto[];
  createdAt?: string;
  updatedAt?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

interface AgentInformationProps {
  agentId: string;
  agentService: FrontendAgentService;
  showToolsOnly?: boolean;
}

export const AgentInformation = ({ agentId, agentService, showToolsOnly = false }: AgentInformationProps) => {
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgentDetails = async () => {
      try {
        const agentDetails = await agentService.getAgentDetails(agentId);
        setAgent(agentDetails);
      } catch (error) {
        console.error('Error fetching agent details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentDetails();
  }, [agentId, agentService]);

  if (isLoading) {
    return (
      <div className="agent-information">
        <div className="loading-state">Loading agent information...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="agent-information">
        <div className="error-state">No agent information available</div>
      </div>
    );
  }

  if (showToolsOnly) {
    return agent.tools && agent.tools.length > 0 ? (
      <Tools tools={agent.tools} />
    ) : (
      <div className="no-tools">No tools available</div>
    );
  }

  return (
    <div className="agent-information">
      <div className="content">
        <div className="info-grid">
          <div className="info-section">
            <label>Name</label>
            <p>{agent.name}</p>
          </div>
          <div className="info-section">
            <label>Description</label>
            <p>{agent.description}</p>
          </div>
          <div className="info-section">
            <label>Model</label>
            <p>{agent.modelId || 'Default'}</p>
          </div>
          <div className="info-section">
            <label>Used Tokens</label>
            <p><b>{agent.totalTokens}</b></p>
          </div>
          <div className="info-section">
            <label>System Prompt</label>
            <p className="system-prompt">{agent.systemPrompt}</p>
          </div>
          {agent.tools && agent.tools.length > 0 && (
            <div className="info-section">
              <label>Available Tools</label>
              <Tools tools={agent.tools} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 