import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DirectAgentAdapter } from "../adapters/api/direct/direct-agent.adapter";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import { TOOL_REGISTRY } from "@core/constants";
import { Agent } from "./agent";
import { AgentOptions, SDKConfig } from "./types";
import { Tool, ToolParameter } from "@core/domain/tool.entity"; // Import your Tool entity
import { ToolBuilder } from "./tool-builder";
import { ModelServicePort } from "@ports/model/model-service.port";
import { MODEL_SERVICE } from "@adapters/adapters.module";
import { NotFoundException } from "@nestjs/common";
import { Message } from '@core/domain/message.entity';

interface PropertySchema {
  type: string;
  description?: string;
  enum?: any[];
  [key: string]: any; // For other possible properties
}

export interface CreateAgentOptions {
  name: string;
  description?: string;
  systemPrompt?: string;
  tools?: string[]; // Array of tool names to register with the agent
}

export class AgentSDK {
  private app: any; // NestJS application context
  private agentAdapter!: DirectAgentAdapter;
  private toolRegistry!: ToolRegistryPort;
  private modelService: ModelServicePort | undefined;
  private initialized = false;

  constructor(private config: SDKConfig = {}) {}

  /**
   * Initialize the SDK - this is done lazily on first use
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Set environment variables based on config
    if (this.config.region) {
      process.env.AWS_REGION = this.config.region;
    }

    if (this.config.credentials) {
      if (this.config.credentials.accessKeyId) {
        process.env.AWS_ACCESS_KEY_ID = this.config.credentials.accessKeyId;
      }
      if (this.config.credentials.secretAccessKey) {
        process.env.AWS_SECRET_ACCESS_KEY =
          this.config.credentials.secretAccessKey;
      }
    }

    // Create NestJS context
    this.app = await NestFactory.createApplicationContext(AppModule);

    // Get required adapters
    this.agentAdapter = this.app.get(DirectAgentAdapter);
    this.toolRegistry = this.app.get(TOOL_REGISTRY);

    try {
      this.modelService = this.app.get(MODEL_SERVICE);
    } catch (error) {
      console.warn("Model service not available:", error);
      this.modelService = undefined;
    }

    this.initialized = true;
  }

  /**
   * Create a Tool from a ToolBuilder definition
   */
  public createToolFromBuilder(
    builderOutput: ReturnType<typeof ToolBuilder.prototype.handle>
  ): Tool {
    const toolSpec = builderOutput.spec();

    // Convert ToolBuilder parameters to Tool parameters
    const parameters: ToolParameter[] = [];

    if (
      toolSpec.toolSpec &&
      toolSpec.toolSpec.inputSchema &&
      toolSpec.toolSpec.inputSchema.json &&
      toolSpec.toolSpec.inputSchema.json.properties
    ) {
      const props = toolSpec.toolSpec.inputSchema.json.properties;
      const required = toolSpec.toolSpec.inputSchema.json.required || [];

      // Convert properties to ToolParameter[]
      for (const [name, prop] of Object.entries(props) as [
        string,
        PropertySchema
      ][]) {
        parameters.push({
          name,
          type: prop.type as
            | "string"
            | "number"
            | "boolean"
            | "object"
            | "array",
          description: prop.description,
          required: required.includes(name),
          enum: prop.enum,
        });
      }
    }

    // Create a new Tool instance
    return new Tool({
      name: builderOutput.name,
      description: toolSpec.toolSpec.description,
      parameters,
      handler: builderOutput.run,
      jsonSchema: toolSpec.toolSpec.inputSchema.json,
    });
  }

  /**
   * Register a tool for use with agents
   */
  public async registerTool(
    tool: Tool | ReturnType<typeof ToolBuilder.prototype.handle>
  ): Promise<void> {
    await this.ensureInitialized();

    // Handle both direct Tool objects and ToolBuilder results
    if ("spec" in tool && "run" in tool) {
      // It's a ToolBuilder result
      const toolSpec = tool.spec();

      // Convert ToolBuilder parameters to Tool parameters
      const parameters: ToolParameter[] = [];

      if (
        toolSpec.toolSpec &&
        toolSpec.toolSpec.inputSchema &&
        toolSpec.toolSpec.inputSchema.json &&
        toolSpec.toolSpec.inputSchema.json.properties
      ) {
        const props = toolSpec.toolSpec.inputSchema.json.properties;
        const required = toolSpec.toolSpec.inputSchema.json.required || [];

        // Convert properties to ToolParameter[]
        for (const [name, prop] of Object.entries(props) as [
          string,
          PropertySchema
        ][]) {
          parameters.push({
            name,
            type: prop.type as
              | "string"
              | "number"
              | "boolean"
              | "object"
              | "array",
            description: prop.description,
            required: required.includes(name),
            enum: prop.enum,
          });
        }
      }

      // Create a new Tool instance
      const newTool = new Tool({
        name: tool.name,
        description: toolSpec.toolSpec.description,
        parameters,
        handler: tool.run,
        jsonSchema: toolSpec.toolSpec.inputSchema.json,
      });

      this.toolRegistry.registerTool(newTool);
    } else if (tool instanceof Tool) {
      // It's already a Tool instance
      this.toolRegistry.registerTool(tool);
    } else {
      throw new Error("Invalid tool format provided to registerTool");
    }
  }

  /**
   * Create a new agent
   */
  public async createAgent(options: CreateAgentOptions): Promise<Agent> {
    await this.ensureInitialized();

    const agentEntity = await this.agentAdapter.createAgent(
      options.name,
      options.description,
      options.systemPrompt,
      options.tools
    );

    return new Agent(agentEntity, this.agentAdapter);
  }

  /**
   * Get an existing agent by ID
   * @throws {NotFoundException} If the agent is not found
   */
  public async getAgent(id: string): Promise<Agent> {
    await this.ensureInitialized();
    const agentEntity = await this.agentAdapter.getAgent(id);
    return new Agent(agentEntity, this.agentAdapter);
  }

  /**
   * Find an agent by ID or create a new one if it doesn't exist
   * @param id The ID of the agent to find
   * @param createOptions Options to use if creating a new agent
   * @returns The existing or newly created agent
   */
  public async findOrCreateAgent(options: CreateAgentOptions): Promise<Agent> {
    await this.ensureInitialized();
    
    try {
      // Try to get the existing agent
      return await this.getAgent(options.name);
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Agent doesn't exist, create a new one
        return await this.createAgent(options);
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get all agents
   */
  public async getAgents(): Promise<Agent[]> {
    await this.ensureInitialized();
    const agents = await this.agentAdapter.getAllAgents();
    return agents.map((agent) => new Agent(agent, this.agentAdapter));
  }

  /**
   * Delete an agent by ID
   */
  public async deleteAgent(id: string): Promise<boolean> {
    await this.ensureInitialized();
    await this.agentAdapter.deleteAgent(id);
    return true;
  }

  /**
   * Close and clean up resources
   */
  public async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.initialized = false;
    }
  }

  /**
   * Ensure the SDK is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate embeddings for a single text
   * @param text The text to generate embeddings for
   * @param options Additional options for the embedding generation
   * @returns A promise that resolves to the embedding vector
   */
  public async generateEmbedding(
    text: string,
    options?: Record<string, any>
  ): Promise<number[]> {
    await this.ensureInitialized();
    if (!this.modelService) {
      throw new Error("Model service not initialized");
    }
    return this.modelService.generateEmbedding(text, options);
  }

  /**
   * Generate embeddings for multiple texts
   * @param texts Array of texts to generate embeddings for
   * @param options Additional options for the embedding generation
   * @returns A promise that resolves to an array of embedding vectors
   */
  public async generateEmbeddings(
    texts: string[],
    options?: Record<string, any>
  ): Promise<number[][]> {
    await this.ensureInitialized();
    if (!this.modelService) {
      throw new Error("Model service not initialized");
    }
    return this.modelService.generateEmbeddings(texts, options);
  }

  /**
   * Create a new agent with custom memory size
   * @param options Agent creation options plus memory size
   * @param options.memorySize Number of past interactions (message pairs) to include in the context.
   *                          For example, a value of 5 means the last 5 user-assistant message pairs will be included.
   */
  async createAgentWithMemory(
    options: CreateAgentOptions & { memorySize?: number }
  ): Promise<Agent> {
    const agent = await this.createAgent(options);
    // Set the memory size for future messages
    agent.setMemorySize(options.memorySize);
    return agent;
  }

  /**
   * Create a new agent with conversation history
   */
  async createAgentWithHistory(
    options: CreateAgentOptions & { conversationHistory: Message[] }
  ): Promise<Agent> {
    const agent = await this.createAgent(options);
    // Set the conversation history for future messages
    agent.setConversationHistory(options.conversationHistory);
    return agent;
  }
}
