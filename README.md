# GenAI Agent System

A flexible Agent abstraction for GenAI-powered agents using Amazon Bedrock, built with Hexagonal Architecture.

## Project Overview

This project provides a robust framework for building intelligent agents powered by Large Language Models (LLMs) through Amazon Bedrock. The system is designed with the following principles:

- **Interface Flexibility**: Use the agent through REST API, direct calls, or other interfaces
- **Amazon Bedrock Integration**: Seamless integration with Bedrock's features (Claude, Titan, etc.)
- **State Management**: Flexible conversation and memory management with pluggable storage options
- **Tool Integration**: Extend agent capabilities with custom tools and functions
- **Prompt Handling**: Process both user and system prompts to control agent behavior
- **Clean Architecture**: Hexagonal/Ports & Adapters design for maximum flexibility

## Getting Started

### Prerequisites

- Node.js (v16+)
- pnpm (recommended) or npm
- AWS Account with Bedrock access
- AWS credentials configured locally

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bedrock-agent-system.git
   cd bedrock-agent-system
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create .env file:
   ```bash
   cp .env.example .env
   ```

4. Update the .env file with your AWS credentials and Bedrock settings.

### Running the Application

Start the development server:
```bash
pnpm start:dev
```

The server will start on port 3000 (or the port specified in your .env file).

## Usage

### REST API

The system exposes a RESTful API for creating and interacting with agents:

```bash
# Create a new agent
curl -X POST http://localhost:3000/api/agents -H "Content-Type: application/json" -d '{
  "name": "My Assistant",
  "systemPrompt": "You are a helpful AI assistant.",
  "tools": ["get_weather", "search"]
}'

# Send a message to the agent
curl -X POST http://localhost:3000/api/agents/{agent-id}/message -H "Content-Type: application/json" -d '{
  "content": "What's the weather like in New York?"
}'
```

### Direct Integration

You can also use the agent directly in your code:

```typescript
import { DirectAgentAdapter } from 'bedrock-agent-system';

async function example() {
  // Create agent
  const agent = await agentAdapter.createAgent({
    name: 'My Assistant',
    systemPromptContent: 'You are a helpful AI assistant.',
    tools: ['get_weather', 'search'],
  });
  
  // Send message
  const response = await agentAdapter.sendMessage(
    agent.id,
    "What's the weather like in New York?"
  );
  
  console.log(response.content);
}
```

See the `examples` directory for more detailed usage examples.

## Architecture

This project follows Hexagonal (Ports & Adapters) Architecture:

- **Core Domain**: Contains the business entities and logic (Agent, Tool, Message, etc.)
- **Ports**: Define interfaces for external interactions
- **Adapters**: Implement interfaces for different technologies (REST, TypeORM, Bedrock, etc.)
- **Tools**: Provide additional functionality to the agent

## Extending

### Adding Custom Tools

Create a new tool by implementing the Tool interface:

```typescript
// src/tools/extensions/my-custom.tool.ts
import { Injectable } from '@nestjs/common';
import { Tool, ToolParameter } from '@core/domain/tool.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MyCustomTool {
  getTool(): Tool {
    const parameters: ToolParameter[] = [
      {
        name: 'param1',
        type: 'string',
        description: 'Description of parameter',
        required: true,
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: 'my_custom_tool',
      description: 'Description of what the tool does',
      parameters,
      handler: this.myToolHandler.bind(this),
    });
  }

  private async myToolHandler(args: { param1: string }): Promise<any> {
    // Implement your tool logic here
    return { result: `Processed: ${args.param1}` };
  }
}
```

Then register your tool in the `ToolsModule`.

### Adding Storage Adapters

Implement the repository interfaces for your preferred database:

```typescript
// src/adapters/storage/my-db/my-db-agent.repository.ts
import { Injectable } from '@nestjs/common';
import { Agent } from '@core/domain/agent.entity';
import { AgentRepositoryPort } from '@ports/storage/agent-repository.port';

@Injectable()
export class MyDbAgentRepository implements AgentRepositoryPort {
  // Implement the methods required by the port
}
```

Then update the provider configuration in the `AdaptersModule`.

## License

MIT