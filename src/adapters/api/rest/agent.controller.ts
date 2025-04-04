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
import { AGENT_SERVICE } from "@adapters/adapters.module";
import { ToolRegistryService } from "@core/services/tool-registry.service";
import { TOOL_REGISTRY } from "@core/constants";

@Controller("agents")
export class AgentController {
  constructor(
    @Inject(forwardRef(() => AGENT_SERVICE))
    private readonly agentService: AgentService,
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryService
  ) {}

  @Post()
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
  async getAllAgents() {
    try {
      const agents = await this.agentService.findAllAgents();
      return agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        modelId: agent.modelId,
        createdAt: agent.createdAt,
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve agents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":id")
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
          messageDto.conversationId,
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
        messageDto.conversationId,
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
          conversationId: response.conversationId,
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
}
