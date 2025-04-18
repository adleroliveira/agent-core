import { useState } from 'preact/hooks';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface ToolCallProps {
  toolId: string;
  toolName: string;
  arguments: Record<string, any>;
  content?: string;
}

const CommandDisplay = ({ command }: { command: string }) => {
  // Split the command by newlines and render each line with a prompt
  const lines = command.split('\n');
  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      padding: '1rem',
      borderRadius: '4px',
      fontFamily: 'Consolas, Monaco, Courier New, monospace',
      whiteSpace: 'pre-wrap'
    }}>
      {lines.map((line, index) => (
        <div key={index} style={{ display: 'flex', marginBottom: '0.5rem' }}>
          <span style={{ color: '#569cd6', marginRight: '0.5rem', userSelect: 'none' }}>$</span>
          <span style={{ color: '#d4d4d4' }}>{line}</span>
        </div>
      ))}
    </div>
  );
};

export const ToolCall = ({ toolId, toolName, arguments: args, content }: ToolCallProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderArgumentValue = (key: string, value: any) => {
    if (key === 'command' && typeof value === 'string') {
      return <CommandDisplay command={value} />;
    }
    return JSON.stringify(value);
  };

  return (
    <div class="tool-call">
      <div class="tool-call-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div class="tool-call-title">
          <span class="tool-icon">🔧</span>
          <span class="tool-name">{toolName}</span>
          <span class="tool-id">({toolId})</span>
        </div>
        <div class="tool-call-toggle">
          {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </div>
      </div>
      {isExpanded && (
        <div class="tool-call-content">
          <table class="tool-arguments-table">
            <thead>
              <tr>
                <th>Argument</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(args).map(([key, value]) => (
                <tr key={key}>
                  <td class="argument-name">{key}</td>
                  <td class="argument-value">{renderArgumentValue(key, value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {content && (
            <div class="tool-result">
              <div class="tool-result-header">Result</div>
              <div class="tool-result-content">
                <pre>{typeof content === 'object' ? JSON.stringify(content, null, 2) : content}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 