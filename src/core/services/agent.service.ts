import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { Observable } from "rxjs";

import { Agent } from "@core/domain/agent.entity";
import { Message } from "@core/domain/message.entity";
import { Prompt } from "@core/domain/prompt.entity";
import { AgentRepositoryPort } from "@ports/storage/agent-repository.port";
import { StateRepositoryPort } from "@ports/storage/state-repository.port";
import {
  ModelServicePort,
} from "@ports/model/model-service.port";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { DEFAULT_SYSTEM_PROMPT } from "@config/prompts.config";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { AgentState } from "@core/domain/agent-state.entity";
import { MessageService } from "@core/services/message.service";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";
import { KnowledgeBaseRepositoryPort } from "@ports/storage/knowledge-base-repository.port";
import { FileInfo } from "@ports/file-upload.port";
import {
  KNOWLEDGE_BASE_REPOSITORY,
  AGENT_REPOSITORY,
  STATE_REPOSITORY,
  MODEL_SERVICE,
  VECTOR_DB,
  MCP_CLIENT
} from "@core/injection-tokens";
import { McpClientServicePort } from "@ports/mcp/mcp-client-service.port";
import { MCPToolRepository } from "@adapters/storage/typeorm/typeorm-mcp-tool.repository";

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: AgentRepositoryPort,
    @Inject(STATE_REPOSITORY)
    private readonly stateRepository: StateRepositoryPort,
    @Inject(MODEL_SERVICE)
    private readonly modelService: ModelServicePort,
    @Inject(VECTOR_DB)
    private readonly vectorDB: VectorDBPort,
    private readonly workspaceConfig: WorkspaceConfig,
    private readonly messageService: MessageService,
    @Inject(KNOWLEDGE_BASE_REPOSITORY)
    private readonly knowledgeBaseRepository: KnowledgeBaseRepositoryPort,
    @Inject(MCP_CLIENT)
    private readonly mcpClientService: McpClientServicePort,
    private readonly mcpToolRepository: MCPToolRepository
  ) { }

  async createAgent(params: {
    name: string;
    description: string;
    modelId?: string;
    systemPromptContent: string;
    tools?: string[];
  }): Promise<Agent> {
    const { name, description, modelId, systemPromptContent, tools } = params;

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
    });

    // Initialize services
    await agent.setServices(
      this.modelService,
      this.vectorDB,
      this.workspaceConfig,
      this.mcpClientService,
      this.stateRepository
    );

    // Register tools if specified
    if (tools && tools.length > 0) {
      for (const toolId of tools) {
        const mcpTool = await this.mcpToolRepository.findById(toolId);
        if (mcpTool) {
          agent.registerTool(mcpTool);
          this.logger.debug(`Registered MCP tool: ${toolId} for agent: ${agent.id}`);
        } else {
          this.logger.warn(`MCP tool with ID '${toolId}' not found`);
        }
      }
    }

    try {
      // Save the agent (which will also save its state)
      const savedAgent = await this.agentRepository.save(agent);
      this.logger.debug(`Saved new agent with ID: ${savedAgent.id}`);

      // Create and save the knowledge base with the agent's ID
      const knowledgeBase = new KnowledgeBase({
        agentId: savedAgent.id,
        name: `${name}'s Knowledge Base`,
        description: `Knowledge base for agent ${name}`,
        modelService: this.modelService,
        vectorDB: this.vectorDB,
      });

      agent.knowledgeBase = knowledgeBase;
      await this.knowledgeBaseRepository.save(knowledgeBase);
      this.logger.debug(`Saved knowledge base for agent ${savedAgent.id}`);

      return savedAgent;
    } catch (error) {
      this.logger.error(`Failed to create agent: ${error.message}`);
      throw error;
    }
  }

  async findAgentById(id: string, loadRelations: boolean = false): Promise<Agent> {
    // Load agent with tools
    const agent = await this.agentRepository.findById(id, loadRelations);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Initialize services for the agent only if they haven't been set
    if (!agent.areServicesInitialized()) {
      await agent.setServices(
        this.modelService,
        this.vectorDB,
        this.workspaceConfig,
        this.mcpClientService,
        this.stateRepository
      );
    }

    return agent;
  }

  async findAllAgents(loadRelations: boolean = false): Promise<Agent[]> {
    return this.agentRepository.findAll(loadRelations);
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
    stateId?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      memorySize?: number;
    },
    files?: FileInfo[]
  ): Promise<Observable<Partial<Message>>> {
    // Find the agent with all relations loaded
    const agent = await this.findAgentById(agentId, true);

    const stateIdToUse = stateId || agent.getMostRecentState().id;
    if (!stateIdToUse) {
      throw new NotFoundException(`No conversation found for agent ${agentId}`);
    }

    const state = agent.getStateById(stateIdToUse);
    if (!state) {
      throw new NotFoundException(`No state found with ID ${stateIdToUse}`);
    }

    // Load messages into the state
    const messages = await this.messageService.getMessages(stateIdToUse);
    state.conversationHistory = messages.messages;

    // Create the message
    const message = new Message({
      content: messageContent,
      role: "user",
      stateId: stateIdToUse,
      files: files as FileInfo[]
    });

    // Process the message and let the agent handle its state
    const response = await agent.processMessage(message, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens
    }, options?.stream);

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
          try {
            await this.agentRepository.save(agent);
            await this.messageService.appendMessages(agent.getStateById(stateIdToUse)?.conversationHistory || []);
            subscriber.complete();
          } catch (error) {
            console.error("Error saving state:", error);
            subscriber.error(error);
          }
        },
      });
    });
  }

  async addToolToAgent(agentId: string, toolId: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId, true);
    const tool = await this.mcpToolRepository.findById(toolId);

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    agent.registerTool(tool);
    return this.agentRepository.save(agent);
  }

  async removeToolFromAgent(agentId: string, toolId: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId, true);
    agent.deregisterTool(toolId);
    return this.agentRepository.save(agent);
  }

  async updateSystemPrompt(
    agentId: string,
    promptContent: string
  ): Promise<Agent> {
    const agent = await this.findAgentById(agentId, false);

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
    throw new Error("Not implemented");
  }

  async getConversations(agentId: string): Promise<AgentState[]> {
    return this.stateRepository.findByAgentId(agentId, false);
  }

  async createNewConversation(agentId: string): Promise<Agent> {
    this.logger.debug(`Creating new conversation for agent ${agentId}`);

    // Get the agent entity directly to avoid creating a new Agent instance
    const agentEntity = await this.agentRepository.findById(agentId, true);
    if (!agentEntity) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    agentEntity.createNewConversation();

    // Save the agent with the new state
    const savedAgent = await this.agentRepository.save(agentEntity);
    this.logger.debug(`Successfully saved agent with new state: ${savedAgent.getMostRecentState().id}`);

    return savedAgent;
  }

  async getMemory(agentId: string, stateId: string): Promise<Record<string, any>> {
    const state = await this.stateRepository.findById(stateId, true);
    if (!state) {
      throw new NotFoundException(`No state found with ID ${stateId}`);
    }
    if (state.agentId !== agentId) {
      throw new NotFoundException(`No state found with ID ${stateId} for agent ${agentId}`);
    }
    return state.memory;
  }

  async deleteConversation(agentId: string, stateId: string): Promise<Agent> {
    this.logger.debug(`Deleting conversation ${stateId} for agent ${agentId}`);
    const agent = await this.findAgentById(agentId, true);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }
    agent.deleteConversation(stateId);
    await this.stateRepository.delete(stateId);

    if (agent.states.length === 0) {
      agent.createNewConversation();
    }

    return this.agentRepository.save(agent);
  }

  async getConversationHistory(
    agentId: string,
    stateId?: string,
    options: {
      limit?: number;
      beforeTimestamp?: Date;
    } = {}
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
  }> {

    if (stateId) {
      const state = await this.stateRepository.findById(stateId, true);
      if (!state) {
        throw new NotFoundException(`No state found with ID ${stateId}`);
      }
      return this.messageService.getMessages(state.id, options);
    } else {
      const agent = await this.agentRepository.findById(agentId, true);
      if (!agent) {
        throw new NotFoundException(`No agent found with ID ${agentId}`);
      }
      return this.messageService.getMessages(agent.getMostRecentState().id, options);
    }
  }

  async setAgentMemory(agentId: string, stateId: string, memory: Record<string, any>): Promise<void> {
    const state = await this.stateRepository.findById(stateId, true);
    if (!state) {
      throw new NotFoundException(`No state found with ID ${stateId}`);
    }
    if (state.agentId !== agentId) {
      throw new NotFoundException(`No state found with ID ${stateId} for agent ${agentId}`);
    }
    state.memory = memory;
    await this.stateRepository.save(state);
    this.logger.debug(`Updated memory for agent ${agentId} and state ${stateId}`);
    this.logger.debug(`Updated memory: ${JSON.stringify(memory)}`);
  }

  async updateAgentMemory(agentId: string, stateId: string, memory: Record<string, any>): Promise<void> {
    this.logger.debug(`Updating memory for agent ${agentId} and state ${stateId}`);
    this.logger.debug(`Current memory: ${JSON.stringify(memory)}`);
    const state = await this.stateRepository.findById(stateId, true);
    if (!state) {
      throw new NotFoundException(`No state found with ID ${stateId}`);
    }
    if (state.agentId !== agentId) {
      throw new NotFoundException(`No state found with ID ${stateId} for agent ${agentId}`);
    }

    // Assign the updated memory back to the state
    state.memory = memory;
    await this.stateRepository.save(state);
    this.logger.debug(`Updated memory for agent ${agentId} and state ${stateId}`);
    this.logger.debug(`Final memory: ${JSON.stringify(state.memory)}`);
  }

  async deleteAgentMemory(agentId: string, stateId: string): Promise<void> {
    const state = await this.stateRepository.findById(stateId, true);
    if (!state) {
      throw new NotFoundException(`No state found with ID ${stateId}`);
    }
    if (state.agentId !== agentId) {
      throw new NotFoundException(`No state found with ID ${stateId} for agent ${agentId}`);
    }
    state.memory = {};
    await this.stateRepository.save(state);
  }

  async deleteAgentMemoryEntry(agentId: string, stateId: string, key: string): Promise<void> {
    const state = await this.stateRepository.findById(stateId, true);
    if (!state) {
      throw new NotFoundException(`No state found with ID ${stateId}`);
    }
    if (state.agentId !== agentId) {
      throw new NotFoundException(`No state found with ID ${stateId} for agent ${agentId}`);
    }
    delete state.memory[key];
    await this.stateRepository.save(state);
  }
}