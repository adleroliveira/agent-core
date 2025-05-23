import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
  forwardRef,
  Res,
  Query,
  Patch,
} from "@nestjs/common";
import { Response } from "express";
import { Observable } from "rxjs";
import { AgentService } from "@core/services/agent.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdatePromptDto } from "./dto/update-prompt.dto";
import { AddToolDto } from "./dto/add-tool.dto";
import { Message } from "@core/domain/message.entity";
import { MessageDto } from "./dto/message.dto";
import { AGENT_SERVICE } from "@core/injection-tokens";
import { ToolRegistryService } from "@core/services/tool-registry.service";
import { TOOL_REGISTRY } from "@core/constants";
import { ApiQuery, ApiOperation, ApiParam, ApiResponse, ApiBody, ApiTags } from "@nestjs/swagger";
import { ConversationDto } from "./dto/conversation.dto";
import { FileInfo } from "@ports/file-upload.port";

@ApiTags('agents')
@Controller("agents")
export class AgentController {
  constructor(
    @Inject(forwardRef(() => AGENT_SERVICE))
    private readonly agentService: AgentService,
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryService
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new agent',
    description: 'Creates a new agent with the specified configuration'
  })
  @ApiBody({ 
    type: CreateAgentDto,
    description: 'The agent configuration including name, description, and system prompt'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Agent created successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters'
  })
  async createAgent(@Body() createAgentDto: CreateAgentDto) {
    try {
      const agent = await this.agentService.createAgent({
        name: createAgentDto.name,
        description: createAgentDto.description,
        modelId: createAgentDto.modelId,
        systemPromptContent: createAgentDto.systemPrompt,
        tools: createAgentDto.tools,
      });

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        modelId: agent.modelId,
        createdAt: agent.createdAt,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create agent: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all agents',
    description: 'Retrieves a list of all available agents'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of agents retrieved successfully'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getAllAgents() {
    try {
      // Load agents with their tools
      const agents = await this.agentService.findAllAgents(true);
      return agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        modelId: agent.modelId,
        createdAt: agent.createdAt,
        inputTokens: agent.inputTokens,
        outputTokens: agent.outputTokens,
        totalTokens: agent.inputTokens + agent.outputTokens,
        tools: agent.areToolsLoaded() ? agent.tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
        })) : [],
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve agents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":id")
  @ApiOperation({ 
    summary: 'Get agent by ID',
    description: 'Retrieves detailed information about a specific agent'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent to retrieve',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Agent retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  async getAgent(@Param("id") id: string) {
    try {
      const agent = await this.agentService.findAgentById(id, true);
      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        modelId: agent.modelId,
        systemPrompt: agent.systemPrompt.content,
        tools: agent.tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          systemPrompt: tool.systemPrompt,
        })),
        inputTokens: agent.inputTokens,
        outputTokens: agent.outputTokens,
        totalTokens: agent.inputTokens + agent.outputTokens,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      };
    } catch (error) {
      throw new HttpException(
        `Agent not found: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Delete(":id")
  @ApiOperation({ 
    summary: 'Delete an agent',
    description: 'Deletes a specific agent by ID'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent to delete',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Agent deleted successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async deleteAgent(@Param("id") id: string) {
    try {
      const deleted = await this.agentService.deleteAgent(id);
      if (!deleted) {
        throw new HttpException("Agent not found", HttpStatus.NOT_FOUND);
      }
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to delete agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(":id/message")
  @ApiOperation({ 
    summary: 'Send a message to an agent',
    description: 'Send a message to an agent. The StateId is required to identify the conversation.'
  })
  @ApiParam({ name: 'id', description: 'The ID of the agent' })
  @ApiQuery({ name: 'stream', required: false, type: Boolean, description: 'Whether to stream the response' })
  @ApiBody({ 
    type: SendMessageDto,
    description: 'The message to send, including stateId to identify the conversation and optional file attachments'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Message processed successfully',
    type: MessageDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  async sendMessage(
    @Param("id") id: string,
    @Body() messageDto: SendMessageDto,
    @Query("stream") stream?: string,
    @Res() res?: Response
  ) {
    try {
      // Handle streaming response if stream=true
      if (res) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const streamResponse = await this.agentService.processMessage(
          id,
          messageDto.content,
          messageDto.stateId,
          {
            temperature: messageDto.temperature,
            maxTokens: messageDto.maxTokens,
            stream: stream === "true",
          },
          messageDto.files?.map((file) => ({
            id: file.id,
            filename: file.filename,
            originalName: file.originalName,
            size: file.size,
            mimetype: file.mimetype,
          } as FileInfo))
        );

        // Ensure we're working with an Observable
        if (!(streamResponse instanceof Observable)) {
          throw new Error(
            "Expected streaming response but received non-streaming response"
          );
        }

        // Now we know it's an Observable
        (streamResponse as Observable<Partial<Message>>).subscribe({
          next: (chunk) => {
            // Send the chunk as a complete JSON object
            res.write(JSON.stringify({
              type: "chunk",
              data: chunk
            }) + "\n");
          },
          complete: () => {
            // Send a completion message
            res.write(JSON.stringify({
              type: "complete",
              data: null
            }) + "\n");
            res.end();
          },
          error: (error) => {
            // Send an error message
            res.write(JSON.stringify({
              type: "error",
              data: {
                message: error.message,
                code: error.code || "INTERNAL_ERROR"
              }
            }) + "\n");
            res.end();
          },
        });

        return;
      }
    } catch (error) {
      throw new HttpException(
        `Failed to process message: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(":id/prompt")
  @ApiOperation({ 
    summary: 'Update system prompt',
    description: 'Updates the system prompt for a specific agent'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiBody({ 
    type: UpdatePromptDto,
    description: 'The new system prompt content'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System prompt updated successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async updateSystemPrompt(
    @Param("id") id: string,
    @Body() promptDto: UpdatePromptDto
  ) {
    try {
      const agent = await this.agentService.updateSystemPrompt(
        id,
        promptDto.content
      );
      return {
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt.content,
        updatedAt: agent.updatedAt,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to update system prompt: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(":id/tools")
  @ApiOperation({ 
    summary: 'Add tool to agent',
    description: 'Adds a new tool to the agent\'s capabilities'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiBody({ 
    type: AddToolDto,
    description: 'The tool to add to the agent'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tool added successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async addTool(@Param("id") id: string, @Body() toolDto: AddToolDto) {
    try {
      const agent = await this.agentService.addToolToAgent(
        id,
        toolDto.toolName
      );
      return {
        id: agent.id,
        name: agent.name,
        tools: agent.tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
        })),
        updatedAt: agent.updatedAt,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to add tool: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(":id/tools/:toolId")
  @ApiOperation({ 
    summary: 'Remove tool from agent',
    description: 'Removes a tool from the agent\'s capabilities'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'toolId', 
    description: 'The ID of the tool to remove',
    example: 'tool_123'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tool removed successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or tool not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async removeTool(@Param("id") id: string, @Param("toolId") toolId: string) {
    try {
      const agent = await this.agentService.removeToolFromAgent(id, toolId);
      return {
        id: agent.id,
        name: agent.name,
        tools: agent.tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
        })),
        updatedAt: agent.updatedAt,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to remove tool: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(":id/reset")
  @ApiOperation({ 
    summary: 'Reset agent state',
    description: 'Resets the state of a specific agent'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent to reset',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Agent state reset successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async resetState(@Param("id") id: string) {
    try {
      await this.agentService.resetAgentState(id);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to reset state: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(":id/new-conversation")
  @ApiOperation({ 
    summary: 'Create new conversation',
    description: 'Creates a new conversation for a specific agent'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiQuery({ 
    name: 'stateId',
    description: 'Optional state ID to specify when creating a new conversation',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'New conversation created successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async createNewConversation(
    @Param("id") id: string,
  ) {
    try {
      const agent = await this.agentService.createNewConversation(id);
      return {
        id: agent.id,
        name: agent.name,
        stateId: agent.getMostRecentState().id,
        createdAt: agent.createdAt,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create new conversation: ${error.message || error.toString()}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":id/conversations")
  @ApiOperation({ 
    summary: 'Get agent conversations',
    description: 'Retrieves all conversations for a specific agent'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Conversations retrieved successfully',
    type: [ConversationDto]
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getConversations(@Param("id") id: string): Promise<ConversationDto[]> {
    try {
      const conversations = await this.agentService.getConversations(id);
      if (!conversations) {
        throw new HttpException("No conversations found", HttpStatus.NOT_FOUND);
      }
      return conversations.map((conversation) => ({
        agentId: conversation.agentId,
        stateId: conversation.id,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve conversations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(":id/conversations/:stateId")
  @ApiOperation({ 
    summary: 'Delete conversation',
    description: 'Deletes a specific conversation for an agent'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'stateId', 
    description: 'The ID of the conversation to delete',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Conversation deleted successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or conversation not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async deleteConversation(
    @Param("id") id: string,
    @Param("stateId") stateId: string
  ) {
    try {
      const agent = await this.agentService.deleteConversation(id, stateId);
      return {
        id: agent.id,
        name: agent.name,
        success: true
      };
    } catch (error) {
      throw new HttpException(
        `Failed to delete conversation: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":id/conversation-history")
  @ApiOperation({ 
    summary: 'Get conversation history',
    description: 'Retrieves the conversation history for a specific agent and state'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiQuery({ 
    name: 'stateId', 
    description: 'The ID of the conversation state',
    required: true,
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiQuery({ 
    name: 'limit', 
    description: 'Maximum number of messages to retrieve',
    required: false,
    type: Number,
    example: 50
  })
  @ApiQuery({ 
    name: 'beforeTimestamp', 
    description: 'Retrieve messages before this timestamp',
    required: false,
    type: Date,
    example: '2024-04-15T08:00:00.000Z'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Conversation history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/MessageDto'
          }
        },
        hasMore: {
          type: 'boolean',
          description: 'Whether there are more messages available',
          example: false
        }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or state not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getConversationHistory(
    @Param("id") id: string,
    @Query("stateId") stateId: string,
    @Query("limit") limit?: number,
    @Query("beforeTimestamp") beforeTimestamp?: Date
  ) {
    try {
      const result = await this.agentService.getConversationHistory(
        id,
        stateId,
        {
          limit,
          beforeTimestamp,
        }
      );
      return {
        messages: result.messages.map(message => ({
          id: message.id,
          content: message.content,
          role: message.role,
          stateId: message.stateId,
          createdAt: message.createdAt,
          toolCalls: message.toolCalls,
          toolResults: message.toolResults,
          metadata: message.metadata,
        })),
        hasMore: result.hasMore,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve conversation history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":id/memory/:stateId")
  @ApiOperation({ 
    summary: 'Get agent memory',
    description: 'Retrieves the memory state for a specific agent and conversation state'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'stateId', 
    description: 'The ID of the conversation state',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Memory retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent',
          example: '123e4567-e89b-12d3-a456-426614174000'
        },
        stateId: {
          type: 'string',
          description: 'The ID of the conversation state',
          example: '123e4567-e89b-12d3-a456-426614174000'
        },
        memory: {
          type: 'object',
          description: 'The memory state of the agent',
          additionalProperties: true
        }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or state not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getMemory(
    @Param("id") id: string,
    @Param("stateId") stateId: string
  ) {
    try {
      const memory = await this.agentService.getMemory(id, stateId);
      return {
        agentId: id,
        stateId: stateId,
        memory: memory
      };
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve memory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(":id/memory/:stateId")
  @ApiOperation({ 
    summary: 'Set agent memory',
    description: 'Sets the complete memory state for a specific agent and conversation state'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'stateId', 
    description: 'The ID of the conversation state',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      additionalProperties: true,
      description: 'The complete memory state to set'
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Memory set successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or state not found'
  })
  async setMemory(
    @Param("id") id: string,
    @Param("stateId") stateId: string,
    @Body() memory: Record<string, any>
  ) {
    try {
      await this.agentService.setAgentMemory(id, stateId, memory);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to set memory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(":id/memory/:stateId")
  @ApiOperation({ 
    summary: 'Update agent memory',
    description: 'Updates the memory state by merging new values with existing ones'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'stateId', 
    description: 'The ID of the conversation state',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      additionalProperties: true,
      description: 'The memory updates to merge with existing memory'
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Memory updated successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or state not found'
  })
  async updateMemory(
    @Param("id") id: string,
    @Param("stateId") stateId: string,
    @Body() memory: Record<string, any>
  ) {
    try {
      await this.agentService.updateAgentMemory(id, stateId, memory);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to update memory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(":id/memory/:stateId")
  @ApiOperation({ 
    summary: 'Delete agent memory',
    description: 'Clears all memory for a specific agent and conversation state'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'stateId', 
    description: 'The ID of the conversation state',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Memory cleared successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or state not found'
  })
  async deleteMemory(
    @Param("id") id: string,
    @Param("stateId") stateId: string
  ) {
    try {
      await this.agentService.deleteAgentMemory(id, stateId);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to delete memory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(":id/memory/:stateId/:key")
  @ApiOperation({ 
    summary: 'Delete memory entry',
    description: 'Removes a specific key from the agent\'s memory'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'The ID of the agent',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'stateId', 
    description: 'The ID of the conversation state',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiParam({ 
    name: 'key', 
    description: 'The key to remove from memory',
    example: 'last_user_query'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Memory entry deleted successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent or state not found'
  })
  async deleteMemoryEntry(
    @Param("id") id: string,
    @Param("stateId") stateId: string,
    @Param("key") key: string
  ) {
    try {
      await this.agentService.deleteAgentMemoryEntry(id, stateId, key);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to delete memory entry: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
