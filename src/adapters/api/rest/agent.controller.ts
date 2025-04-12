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
} from "@nestjs/common";
import { Response } from "express";
import { Observable } from "rxjs";
import { AgentService } from "@core/application/agent.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdatePromptDto } from "./dto/update-prompt.dto";
import { AddToolDto } from "./dto/add-tool.dto";
import { Message } from "@core/domain/message.entity";
import { MessageDto } from "./dto/message.dto";
import { AGENT_SERVICE } from "@adapters/adapters.module";
import { ToolRegistryService } from "@core/services/tool-registry.service";
import { TOOL_REGISTRY } from "@core/constants";
import { ApiQuery, ApiOperation, ApiParam, ApiResponse, ApiBody } from "@nestjs/swagger";

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
      const agent = await this.agentService.findAgentById(id);
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
        })),
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
    description: 'The message to send, including stateId to identify the conversation'
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
      if (stream === "true" && res) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const streamResponse = await this.agentService.processMessage(
          id,
          messageDto.content,
          messageDto.stateId,
          {
            temperature: messageDto.temperature,
            maxTokens: messageDto.maxTokens,
            stream: true,
          }
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
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          },
          complete: () => {
            res.write("data: [DONE]\n\n");
            res.end();
          },
          error: (error) => {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
          },
        });

        return;
      }

      // Handle non-streaming response
      const response = await this.agentService.processMessage(
        id,
        messageDto.content,
        messageDto.stateId,
        {
          temperature: messageDto.temperature,
          maxTokens: messageDto.maxTokens,
          stream: false,
        }
      );

      // Ensure we're working with a Message object, not an Observable
      if (response instanceof Observable) {
        throw new Error(
          "Expected non-streaming response but received streaming response"
        );
      }

      // For non-streaming responses
      if (!res) {
        return response;
      } else {
        res.json({
          id: response.id,
          content: response.content,
          role: response.role,
          stateId: response.stateId,
          createdAt: response.createdAt,
          toolCalls: response.toolCalls,
          metadata: response.metadata,
        });
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
    description: 'Conversations retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Agent not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getConversations(@Param("id") id: string) {
    try {
      const conversations = await this.agentService.getConversations(id);
      return conversations.map((conversation) => ({
        id: conversation.id,
        stateId: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve conversations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":id/conversation-history")
  @ApiQuery({ name: 'stateId', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'beforeTimestamp', required: false, type: Date })
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
}
