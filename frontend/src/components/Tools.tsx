import { McpToolDto } from '../api-client/models/McpToolDto';
import '../styles/tools.css';

interface ToolsProps {
  tools: McpToolDto[];
}

export const Tools = ({ tools }: ToolsProps) => {
  return (
    <div className="tools-list">
      {tools.length === 0 ? (
        <div className="no-tools">No tools available</div>
      ) : (
        tools.map((tool, index) => (
          <div key={tool.id}>
            <div className="tool-item">
              <div className="tool-main">
                <h4>{tool.name}</h4>
                <p className="tool-description">{tool.description}</p>
                {tool.inputSchema && (
                  <div className="tool-parameters">
                    <table className="parameters-table">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Type</th>
                          <th>Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(tool.inputSchema.properties || {}).map(([name, prop]: [string, any]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{prop.type}</td>
                            <td>{tool.inputSchema.required?.includes(name) ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            {index < tools.length - 1 && <hr className="tool-separator" />}
          </div>
        ))
      )}
    </div>
  );
}; 