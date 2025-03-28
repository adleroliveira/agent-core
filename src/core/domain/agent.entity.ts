import { v4 as uuidv4 } from "uuid";
import { AgentState } from "./agent-state.entity";
import { Prompt } from "./prompt.entity";
import { Tool } from "./tool.entity";
import { Message } from "./message.entity";
import { KnowledgeBase } from "./knowledge-base.entity";
import { RagToolBundle } from "@tools/default/rag.toolBundle";
import { PtyToolBundle } from "@tools/default/pty.toolBundle";
import { ProcessToolBundle } from "@tools/default/process.toolBundle";
import { InternetSearchToolBundle } from "@tools/default/internet-search.toolBundle";
import { InternetSearchTool } from "@tools/default/internet-search.tool";
import {
  ModelServicePort,
  ToolCallResult,
} from "@ports/model/model-service.port";
import { Observable, map } from "rxjs";
import { VectorDBPort } from "@ports/storage/vector-db.port";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { Inject } from "@nestjs/common";

export class Agent {
  public readonly id: string;
  public name: string;
  public description?: string;
  public modelId: string;
  public state: AgentState;
  public systemPrompt: Prompt;
  public tools: Tool[];
  public knowledgeBase: KnowledgeBase;
  public createdAt: Date;
  public updatedAt: Date;
  private modelService?: ModelServicePort;
  private vectorDB?: VectorDBPort;
  private toolRegistry?: ToolRegistryPort;
  private workspaceConfig?: WorkspaceConfig;

  constructor(
    @Inject(InternetSearchTool)
    private readonly internetSearchTool: InternetSearchTool,
    params: {
      id?: string;
      name: string;
      description?: string;
      modelId: string;
      systemPrompt: Prompt;
      tools?: Tool[];
      modelService?: ModelServicePort;
      vectorDB?: VectorDBPort;
      toolRegistry?: ToolRegistryPort;
      knowledgeBase?: KnowledgeBase;
      workspaceConfig?: WorkspaceConfig;
    }
  ) {
    this.id = params.id || uuidv4();
    this.name = params.name;
    this.description = params.description;
    this.modelId = params.modelId;
    this.systemPrompt = params.systemPrompt;
    this.tools = params.tools || [];
    this.modelService = params.modelService;
    this.vectorDB = params.vectorDB;
    this.toolRegistry = params.toolRegistry;
    this.workspaceConfig = params.workspaceConfig;
    this.state = new AgentState();
    this.knowledgeBase = params.knowledgeBase || new KnowledgeBase({
      agentId: this.id,
      name: `${this.name}'s Knowledge Base`,
      description: `Knowledge base for agent ${this.name}`,
      modelService: this.modelService,
      vectorDB: this.vectorDB,
    });
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public async setServices(
    modelService: ModelServicePort, 
    vectorDB: VectorDBPort, 
    toolRegistry: ToolRegistryPort,
    workspaceConfig: WorkspaceConfig
  ): Promise<void> {
    this.modelService = modelService;
    this.vectorDB = vectorDB;
    this.toolRegistry = toolRegistry;
    this.workspaceConfig = workspaceConfig;
    this.knowledgeBase.setServices(modelService, vectorDB);
    
    // Initialize RAG tools if needed
    await this.initializeRagTools();
    
    // Initialize PTY tools
    await this.initializePtyTools();

    // Initialize Process tools
    await this.initializeProcessTools();

    // Initialize Internet Search tools
    await this.initializeInternetSearchTools();
  }

  private async initializePtyTools(): Promise<void> {
    if (!this.workspaceConfig) {
      throw new Error("Workspace config must be initialized");
    }

    const ptyToolBundle = new PtyToolBundle(this.workspaceConfig);
    const { tools: ptyTools } = ptyToolBundle.getBundle();
    
    // Add PTY tools to agent's tools array
    this.tools.push(...ptyTools);
  }

  private async initializeProcessTools(): Promise<void> {
    if (!this.toolRegistry) {
      throw new Error("Tool registry must be initialized");
    }

    // Get the process tool from the registry
    const processTool = await this.toolRegistry.getToolByName('process_manager');
    if (processTool) {
      this.tools.push(processTool);
    }
  }

  private async initializeRagTools(): Promise<void> {
    const ragToolBundle = new RagToolBundle(this.knowledgeBase);
    const { tools: ragTools } = ragToolBundle.getBundle();
    
    // Register RAG tools with the tool registry
    for (const tool of ragTools) {
      await this.toolRegistry?.registerTool(tool);
    }
    
    // Add RAG tools to agent's tools array
    this.tools.push(...ragTools);
  }

  private async initializeInternetSearchTools(): Promise<void> {
    if (!this.toolRegistry) {
      throw new Error("Tool registry must be initialized");
    }

    const internetSearchToolBundle = new InternetSearchToolBundle(this.internetSearchTool);
    const { tools: internetSearchTools } = internetSearchToolBundle.getBundle();
    
    // Add Internet Search tools to agent's tools array
    this.tools.push(...internetSearchTools);
  }

  public async processMessage(
    message: Message,
    options?: {
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<Message | Observable<Partial<Message>>> {
    if (!this.modelService) {
      throw new Error("Model service not initialized");
    }

    // Record the incoming message in conversation history
    this.state.addToConversation(message);

    const requestOptions = {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    };

    if (options?.stream) {
      // Handle streaming response
      return this.processStreamingMessage(message, requestOptions);
    } else {
      // Handle standard response
      return this.processStandardMessage(message, requestOptions);
    }
  }

  private async processStandardMessage(
    message: Message,
    options: any
  ): Promise<Message> {
    const response = await this.modelService!.generateResponse(
      this.state.getLastNMessages(20), // Get a reasonable number of recent messages
      this.systemPrompt,
      this.tools,
      options
    );

    // Create a message from the response
    const responseMessage = new Message({
      role: "assistant",
      content: response.message.content,
      conversationId: message.conversationId,
      toolCalls: response.toolCalls?.map((tc) => ({
        id: tc.toolId,
        name: tc.toolName,
        arguments: tc.arguments,
      })),
    });

    // Handle any tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      await this.executeToolCalls(
        responseMessage,
        response.toolCalls,
        message.conversationId
      );
    }

    // Add the response to the conversation history
    this.state.addToConversation(responseMessage);

    return responseMessage;
  }

  private processStreamingMessage(
    message: Message,
    options: any
  ): Observable<Partial<Message>> {
    // Get the streaming response from the model service
    const streamingObs = this.modelService!.generateStreamingResponse(
      this.state.getLastNMessages(20),
      this.systemPrompt,
      undefined, // Don't pass tools since they are already registered in the registry
      options
    );

    // Transform the ModelResponse chunks to Message chunks
    return streamingObs.pipe(
      map((responseChunk) => {
        // Create a partial message from the response chunk
        const messageChunk: Partial<Message> = {};

        // Handle content updates
        if (responseChunk.message?.content) {
          messageChunk.content = responseChunk.message.content;
        }

        // Transform tool calls if present
        if (responseChunk.toolCalls) {
          messageChunk.toolCalls = responseChunk.toolCalls.map((tc) => ({
            id: tc.toolId,
            name: tc.toolName,
            arguments: tc.arguments,
          }));
        }

        // Include metadata if present
        if (responseChunk.metadata) {
          messageChunk.metadata = responseChunk.metadata;
        }

        return messageChunk;
      })
    );
  }

  private async executeToolCalls(
    assistantMessage: Message,
    toolCalls: ToolCallResult[],
    conversationId: string
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      // Find the tool
      const tool = this.tools.find((t) => t.name === toolCall.toolName);

      if (!tool) {
        const errorMessage = new Message({
          role: "tool",
          content: `Error: Tool '${toolCall.toolName}' not found`,
          conversationId: conversationId,
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
        });
        this.state.addToConversation(errorMessage);
        continue;
      }

      try {
        // Execute the tool
        const result = await tool.execute(toolCall.arguments);

        // Create a tool response message
        const toolResponseMessage = new Message({
          role: "tool",
          content: JSON.stringify(result),
          conversationId: conversationId,
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
        });

        // Add to conversation history
        this.state.addToConversation(toolResponseMessage);
      } catch (error) {
        // Handle tool execution error
        const errorMessage = new Message({
          role: "tool",
          content: `Error executing tool: ${error.message}`,
          conversationId: conversationId,
          toolCallId: toolCall.toolId,
          toolName: toolCall.toolName,
        });
        this.state.addToConversation(errorMessage);
      }
    }
  }

  public registerTool(tool: Tool): void {
    this.tools.push(tool);
    this.updatedAt = new Date();
  }

  public deregisterTool(toolId: string): void {
    this.tools = this.tools.filter((tool) => tool.id !== toolId);
    this.updatedAt = new Date();
  }

  public updateSystemPrompt(prompt: Prompt): void {
    this.systemPrompt = prompt;
    this.updatedAt = new Date();
  }

  public resetState(): void {
    this.state = new AgentState();
    this.updatedAt = new Date();
  }
}
