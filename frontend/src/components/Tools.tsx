import { ToolDto } from '../api-client/models/ToolDto';
import '../styles/tools.css';

interface ToolsProps {
  tools: ToolDto[];
}

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: string;
  enum?: string[];
}

export const Tools = ({ tools }: ToolsProps) => {
  return (
    <div className="tools-list">
      {tools.length === 0 ? (
        <div className="no-tools">No tools available</div>
      ) : (
        tools.map((tool, index) => (
          <div key={tool.name}>
            <div className="tool-item">
              <div className="tool-main">
                <h4>{tool.name}</h4>
                <p className="tool-description">{tool.description}</p>
                {tool.parameters && (
                  <div className="tool-parameters">
                    <table className="parameters-table">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tool.parameters.map((param: ToolParameter) => (
                          <tr key={param.name}>
                            <td>{param.name}</td>
                            <td>{param.type}</td>
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