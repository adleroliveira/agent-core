# AgentCore v0.4 - GenAI Agent Framework

A flexible Agent abstraction for GenAI-powered agents using Amazon Bedrock, built with Hexagonal Architecture. This project provides both a NestJS server and an SDK for creating and interacting with AI agents.

## Project Overview

This project provides a robust framework for building intelligent agents powered by Large Language Models (LLMs) through Amazon Bedrock. The system is designed with the following principles:

- **Interface Flexibility**: Use the agent through REST API, direct SDK calls, or other interfaces
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
   git clone https://github.com/adleroliveira/agent-core.git
   cd agent-core
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create .env file:
   ```bash
   cp .env.example .env
   ```

4. Update the .env file with your AWS credentials and Bedrock settings:
   - AWS_REGION
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - BEDROCK_MODEL_ID (e.g., anthropic.claude-3-haiku-20240307-v1:0)
   - BEDROCK_EMBEDDING_MODEL_ID (e.g., amazon.titan-embed-text-v2:0)
   - BEDROCK_KNOWLEDGE_BASE_ID (optional)
   - BEDROCK_AGENT_ID (optional)
   - Other configuration options as needed

### Running the Application

1. Build the project:
   ```bash
   pnpm build
   ```

2. Start the server:
   ```bash
   pnpm start
   ```

The server will start on port 3000 (or the port specified in your .env file).

## Usage

### As a NestJS Server

The project can be used as a standalone NestJS server that exposes:
- REST API endpoints for agent management and interaction
- OpenAPI documentation (available at `/api` endpoint)
- Web interface for agent interaction

### Using the SDK

The SDK provides a convenient way to create and interact with agents programmatically:

```typescript
import { AgentSDK } from '@agent-core/sdk';

async function example() {
  // Initialize the SDK
  const sdk = new AgentSDK({
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key'
    }
  });

  // Create a new agent
  const agent = await sdk.createAgent({
    name: 'My Assistant',
    description: 'A helpful AI assistant',
    systemPrompt: 'You are a helpful AI assistant.',
    tools: ['search', 'calculator'],
    memorySize: 10
  });

  // Send a message and get a response
  const response = await agent.ask('What is the weather like in New York?');
  console.log(response.getTextContent());

  // Use streaming for real-time responses
  await agent.askStream('Tell me a story', {
    onChunk: (chunk) => console.log(chunk),
    onComplete: () => console.log('Done'),
    onError: (error) => console.error(error)
  });

  // Clean up
  await sdk.close();
}
```

### Key SDK Features

- **Agent Management**: Create, retrieve, and delete agents
- **Conversation Handling**: Manage conversations with memory and context
- **Tool Integration**: Register and use custom tools
- **Streaming Support**: Real-time response streaming
- **Embedding Generation**: Generate embeddings for text using Bedrock models
- **Memory Management**: Control conversation memory size and context

### REST API

The system exposes a RESTful API for creating and interacting with agents. The OpenAPI documentation is available at the `/api` endpoint when running the server.

## Architecture

This project follows Hexagonal (Ports & Adapters) Architecture:

- **Core Domain**: Contains the business entities and logic (Agent, Tool, Message, etc.)
- **Ports**: Define interfaces for external interactions
- **Adapters**: Implement interfaces for different technologies (REST, TypeORM, Bedrock, etc.)
- **Tools**: Provide additional functionality to the agent

## Extending

### Adding Custom Tools

Create a new tool using the ToolBuilder:

```typescript
import { ToolBuilder } from '@agent-core/sdk';

const myTool = new ToolBuilder()
  .name('my_custom_tool')
  .description('Description of what the tool does')
  .parameter('param1', 'string', 'Description of parameter', true)
  .handle(async (args) => {
    // Implement your tool logic here
    return { result: `Processed: ${args.param1}` };
  });

// Register the tool
await sdk.registerTool(myTool);
```

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