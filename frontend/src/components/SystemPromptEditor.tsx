import { useState, useEffect } from 'preact/hooks';
import type { ComponentType } from 'preact';
import type { ToolDto } from '../api-client/models/ToolDto';

interface SystemPromptEditorProps {
  agentName: string;
  primaryFunction: string;
  thinkingApproach?: string;
  limitations?: string[];
  selectedTools: ToolDto[];
  onChange: (systemPrompt: string) => void;
}

export const SystemPromptEditor: ComponentType<SystemPromptEditorProps> = ({
  agentName,
  primaryFunction,
  thinkingApproach = '',
  limitations = [],
  selectedTools,
  onChange,
}) => {
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    // Build the tools section
    const toolsSection = selectedTools.length > 0
      ? `## Tools\n${selectedTools.map(tool =>
        `${tool.name}\n${tool.systemPrompt || ''}`
      ).join('\n\n')}`
      : '';

    // Build the limitations section
    const limitationsSection = limitations.length > 0
      ? `## Boundaries\n${limitations.map(limitation => `- ${limitation}`).join('\n')}`
      : '';

    // Build the thinking approach section
    const thinkingApproachSection = thinkingApproach
      ? `## Process\n- ${thinkingApproach}`
      : '';

    // Combine all sections
    const newSystemPrompt = `# ${agentName}

## Purpose
- ${primaryFunction}

${thinkingApproachSection}

${toolsSection}

${limitationsSection}`;

    setSystemPrompt(newSystemPrompt);
    onChange(newSystemPrompt);
  }, [agentName, primaryFunction, thinkingApproach, limitations, selectedTools, onChange]);

  return (
    <div class="system-prompt-editor">
      <textarea
        class="system-prompt-textarea"
        value={systemPrompt}
        readOnly
        rows={20}
      />
    </div>
  );
}; 