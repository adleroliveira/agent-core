import { useState, useEffect } from 'preact/hooks';
import type { ComponentType } from 'preact';

interface SystemPromptEditorProps {
  agentName: string;
  primaryFunction: string;
  thinkingApproach?: string;
  limitations?: string[];
  onChange: (systemPrompt: string) => void;
}

export const SystemPromptEditor: ComponentType<SystemPromptEditorProps> = ({
  agentName,
  primaryFunction,
  thinkingApproach = '',
  limitations = [],
  onChange,
}) => {
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
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

${limitationsSection}`;

    setSystemPrompt(newSystemPrompt);
    onChange(newSystemPrompt);
  }, [agentName, primaryFunction, thinkingApproach, limitations, onChange]);

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