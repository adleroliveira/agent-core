import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  OnModuleInit,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { Observable, Subject } from "rxjs";

import { Agent } from "@core/domain/agent.entity";
import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { AgentRepositoryPort } from "@ports/storage/agent-repository.port";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import {
  ModelServicePort,
} from "@ports/model/model-service.port";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import {
  AGENT_REPOSITORY,
  STATE_REPOSITORY,
  MODEL_SERVICE,
  VECTOR_DB,
} from "@adapters/adapters.module";
import { TOOL_REGISTRY } from "@core/constants";
import { DEFAULT_SYSTEM_PROMPT } from "@config/prompts.config";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { AgentState } from "@core/domain/agent-state.entity";

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private readonly initializedAgents: Map<string, Agent> = new Map();

  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: AgentRepositoryPort,
    @Inject(STATE_REPOSITORY)
    private readonly stateRepository: StateRepositoryPort,
    @Inject(MODEL_SERVICE)
    private readonly modelService: ModelServicePort,
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryPort,
    @Inject(VECTOR_DB)
    private readonly vectorDB: VectorDBPort,
    private readonly workspaceConfig: WorkspaceConfig
  ) { }

  onModuleInit() {
    // Clear the cache when the service starts
    this.initializedAgents.clear();
  }

  async createAgent(params: {
    name: string;
    description: string;
    modelId?: string;
    systemPromptContent: string;
    tools?: string[];
    conversationId?: string;
  }): Promise<Agent> {
    const { name, description, modelId, systemPromptContent, tools, conversationId } = params;

    // Combine default prompt with user's prompt
    const combinedPromptContent = `${DEFAULT_SYSTEM_PROMPT}\n\n${systemPromptContent}`;

    const systemPrompt = new Prompt({
      content: combinedPromptContent,
      type: "system",
      name: `${name} System Prompt`,
    });

    const agent = new Agent({
      name,
      description,
      modelId: modelId || process.env.BEDROCK_MODEL_ID || "",
      systemPrompt,
      workspaceConfig: this.workspaceConfig,
      conversationId
    });

    // Initialize services
    await agent.setServices(
      this.modelService,
      this.vectorDB,
      this.workspaceConfig
    );

    // Register tools if specified
    if (tools && tools.length > 0) {
      const allTools = await this.toolRegistry.getAllTools();
      const toolMap = new Map(allTools.map((tool) => [tool.name, tool]));

      for (const toolName of tools) {
        const tool = toolMap.get(toolName);
        if (tool) {
          agent.registerTool(tool);
          this.logger.debug(`Registered tool: ${toolName} for agent: ${agent.id}`);
        } else {
          this.logger.warn(`Tool '${toolName}' not found in registry`);
        }
      }
    }

    try {
      // First save the agent to get its ID
      const savedAgent = await this.agentRepository.save(agent);
      this.logger.debug(`Saved new agent with ID: ${savedAgent.id}`);
      
      // Update the state with the agent's ID
      agent.state.agentId = savedAgent.id;
      this.logger.debug(`Setting agentId ${savedAgent.id} on initial state`);
      
      // Then save the state
      await this.stateRepository.save(agent.state);
      this.logger.debug(`Saved initial state for agent ${savedAgent.id}`);
      
      // Cache the initialized agent
      this.initializedAgents.set(savedAgent.id, savedAgent);
      
      return savedAgent;
    } catch (error) {
      this.logger.error(`Failed to create agent: ${error.message}`);
      throw error;
    }
  }

  async findAgentById(id: string): Promise<Agent> {
    // Check if we already have an initialized agent
    const cachedAgent = this.initializedAgents.get(id);
    if (cachedAgent) {
      return cachedAgent;
    }

    // If not in cache, load from database
    const agent = await this.agentRepository.findById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Load the most recent state for this agent
    const state = await this.stateRepository.findByAgentId(id);
    if (state) {
      agent.state = state;
    }

    // Initialize services for new agent
    await agent.setServices(
      this.modelService,
      this.vectorDB,
      this.workspaceConfig
    );

    // Cache the initialized agent
    this.initializedAgents.set(id, agent);

    return agent;
  }

  async findAllAgents(): Promise<Agent[]> {
    return this.agentRepository.findAll();
  }

  async deleteAgent(id: string): Promise<boolean> {
    const exists = await this.agentRepository.exists(id);
    if (!exists) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    await this.stateRepository.deleteByAgentId(id);
    return this.agentRepository.delete(id);
  }

  async processMessage(
    agentId: string,
    messageContent: string,
    conversationId?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      memorySize?: number;
    }
  ): Promise<Message | Observable<Partial<Message>>> {
    // Find the agent
    const agent = await this.findAgentById(agentId);

    // Create conversation ID if not provided
    if (!conversationId) {
      conversationId = uuidv4();
    }

    // Create the message
    const message = new Message({
      content: messageContent,
      role: "user",
      conversationId,
    });

    // Process the message and let the agent handle its state
    const response = await agent.processMessage(message, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stream: options?.stream,
    });

    if (options?.stream) {
      // For streaming responses, we need to wrap the observable to save state when complete
      const observable = response as Observable<Partial<Message>>;
      return new Observable<Partial<Message>>((subscriber) => {
        observable.subscribe({
          next: (value) => {
            subscriber.next(value);
          },
          error: (error) => {
            console.error("Error in AgentService stream:", error);
            subscriber.error(error);
          },
          complete: async () => {
            console.log("Stream complete in AgentService, saving state...");
            try {
              // Save the final state after stream completes
              await this.stateRepository.save(agent.state);
              subscriber.complete();
            } catch (error) {
              console.error("Error saving state:", error);
              subscriber.error(error);
            }
          },
        });
      });
    } else {
      // For non-streaming responses, save state immediately
      await this.stateRepository.save(agent.state);
      return response as Message;
    }
  }

  async addToolToAgent(agentId: string, toolName: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId);
    const tool = await this.toolRegistry.getToolByName(toolName);

    if (!tool) {
      throw new NotFoundException(`Tool with name ${toolName} not found`);
    }

    agent.registerTool(tool);
    return this.agentRepository.save(agent);
  }

  async removeToolFromAgent(agentId: string, toolId: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId);
    agent.deregisterTool(toolId);
    return this.agentRepository.save(agent);
  }

  async updateSystemPrompt(
    agentId: string,
    promptContent: string
  ): Promise<Agent> {
    const agent = await this.findAgentById(agentId);

    // Combine default prompt with user's prompt
    const combinedPromptContent = `${DEFAULT_SYSTEM_PROMPT}\n\n${promptContent}`;

    const updatedPrompt = new Prompt({
      content: combinedPromptContent,
      type: "system",
      name: agent.systemPrompt.name,
    });

    agent.updateSystemPrompt(updatedPrompt);
    return this.agentRepository.save(agent);
  }

  async resetAgentState(agentId: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId);
    agent.resetState();
    return this.agentRepository.save(agent);
  }

  async getConversations(agentId: string): Promise<AgentState[]> {
    return await this.stateRepository.findAllByAgentId(agentId);
  }

  async createNewConversation(agentId: string, conversationId?: string): Promise<Agent> {
    this.logger.debug(`Creating new conversation for agent ${agentId} with conversationId ${conversationId}`);
    const agent = await this.findAgentById(agentId);
    this.logger.debug(`Found agent: ${agent.id}`);
    
    // Get all existing states for this agent
    const existingStates = await this.stateRepository.findAllByAgentId(agentId);
    this.logger.debug(`Found ${existingStates.length} existing states for agent ${agentId}`);
    
    // Create new state with the agent's ID
    const newState = new AgentState({
      agentId: agent.id,
      conversationId: conversationId || uuidv4(),
    });
    
    // Set the new state on the agent
    agent.state = newState;
    this.logger.debug(`Created new state with agentId: ${agent.state.agentId}, conversationId: ${agent.state.conversationId}`);
    
    try {
      // First save the new state
      await this.stateRepository.save(agent.state);
      
      // Then save the agent with all states
      const savedAgent = await this.agentRepository.save(agent);
      this.logger.debug(`Successfully saved agent with new state`);
      return savedAgent;
    } catch (error) {
      this.logger.error(`Failed to save agent with new state: ${error.message}`);
      this.logger.error(`State details - agentId: ${agent.state.agentId}, conversationId: ${agent.state.conversationId}`);
      throw error;
    }
  }

  async getConversationHistory(
    agentId: string,
    conversationId: string,
    options: {
      limit?: number;
      beforeTimestamp?: Date;
    } = {}
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
  }> {
    return this.stateRepository.getConversationMessages(agentId, conversationId, options);
  }
}