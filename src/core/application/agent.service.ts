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
import { MessageService } from "@core/services/message.service";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";
import { KnowledgeBaseRepositoryPort } from "@ports/storage/knowledge-base-repository.port";
import {
  KNOWLEDGE_BASE_REPOSITORY,
} from "@adapters/adapters.module";

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);

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
    private readonly workspaceConfig: WorkspaceConfig,
    private readonly messageService: MessageService,
    @Inject(KNOWLEDGE_BASE_REPOSITORY)
    private readonly knowledgeBaseRepository: KnowledgeBaseRepositoryPort
  ) {}

  onModuleInit() {
    // No initialization needed
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
      workspaceConfig: this.workspaceConfig
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

      const agentState = new AgentState({
        agentId: agent.id,
        conversationId: conversationId || uuidv4(),
      });

      agent.states.push(agentState);
      
      // Then save the state
      await this.stateRepository.save(agentState);
      this.logger.debug(`Saved initial state for agent ${savedAgent.id}`);

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
    const agent = await this.agentRepository.findById(id, true);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Initialize services for the agent only if they haven't been set
    if (!agent.areServicesInitialized()) {
      await agent.setServices(
        this.modelService,
        this.vectorDB,
        this.workspaceConfig
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
    conversationId?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      memorySize?: number;
    }
  ): Promise<Message | Observable<Partial<Message>>> {
    // Find the agent with all relations loaded
    const agent = await this.findAgentById(agentId, true);
    const stateToUse = conversationId? agent.getStateByConversationId(conversationId) : agent.getMostRecentState();
    console.log("STATE TO USE:", stateToUse);
    if (!stateToUse) {
      throw new NotFoundException(`No conversation found for agent ${agentId}`);
    }

    const conversationIdToUse = stateToUse.conversationId;

    // Create the message
    const message = new Message({
      content: messageContent,
      role: "user",
      conversationId: conversationIdToUse,
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
            // console.log("Stream complete in AgentService, saving state...", stateToUse);
            try {
              // Save the final state after stream completes
              await this.stateRepository.save(stateToUse);
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
      await this.stateRepository.save(stateToUse);
      return response as Message;
    }
  }

  async addToolToAgent(agentId: string, toolName: string): Promise<Agent> {
    const agent = await this.findAgentById(agentId, true);
    const tool = await this.toolRegistry.getToolByName(toolName);

    if (!tool) {
      throw new NotFoundException(`Tool with name ${toolName} not found`);
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
    return await this.stateRepository.findAllByAgentId(agentId, false);
  }

  async createNewConversation(agentId: string, conversationId?: string): Promise<Agent> {
    this.logger.debug(`Creating new conversation for agent ${agentId} with conversationId ${conversationId}`);
    
    // Get the agent entity directly to avoid creating a new Agent instance
    const agentEntity = await this.agentRepository.findById(agentId, true);
    if (!agentEntity) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }
    
    // Create new state with the agent's ID
    const newState = new AgentState({
      agentId: agentEntity.id,
      conversationId: conversationId || uuidv4(),
    });
    
    // Save the new state first
    await this.stateRepository.save(newState);
    agentEntity.states.push(newState);

    // Save the agent with the new state
    const savedAgent = await this.agentRepository.save(agentEntity);
    this.logger.debug(`Successfully saved agent with new state`);
    
    return savedAgent;
  }

  async getConversationHistory(
    agentId: string,
    conversationId?: string,
    options: {
      limit?: number;
      beforeTimestamp?: Date;
    } = {}
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
  }> {

    let conversationIdToUse = conversationId;
    if (!conversationIdToUse) {
      const state = await this.stateRepository.findByAgentId(agentId, false);
      if (!state?.conversationId) {
        throw new NotFoundException(`No conversation found for agent ${agentId}`);
      }
      return this.messageService.getMessages(state.id, options);
    }

    // Find the state for this agent and conversation
    const state = await this.stateRepository.findByAgentIdAndConversationId(agentId, conversationIdToUse, false);
    if (!state) {
      throw new NotFoundException(`No conversation found for agent ${agentId} and conversation ${conversationIdToUse}`);
    }

    // Get messages using the message service with the provided options
    return this.messageService.getMessages(state.id, options);
  }
}