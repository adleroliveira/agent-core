import { useEffect, useState } from 'preact/hooks';
import { FrontendAgentService } from '@/services/agent.service';
import { CreateAgentDto } from '@/api-client';
import '../styles/agent-information.css';

interface AgentInformationProps {
  agentId: string;
  agentService: FrontendAgentService;
}

export const AgentInformation = ({ agentId, agentService }: AgentInformationProps) => {
  const [agent, setAgent] = useState<CreateAgentDto | null>(null);
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
            <label>System Prompt</label>
            <p className="system-prompt">{agent.systemPrompt}</p>
          </div>
          {agent.tools && agent.tools.length > 0 && (
            <div className="info-section">
              <label>Available Tools</label>
              <ul className="tools-list">
                {agent.tools.map((tool, index) => (
                  <li key={index}>{tool}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 