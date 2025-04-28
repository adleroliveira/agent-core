import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TypeOrmMCPServerRepository } from '../../storage/typeorm/typeorm-mcp-server.repository';
import { CreateMCPServerDto, MCPServerDto } from './dto/mcp-server.dto';
import { MCPServer } from '../../../core/domain/mcp-server.entity';
import { MCPTool } from '../../../core/domain/mcp-tool.entity';
import { v4 as uuidv4 } from 'uuid';
import { MCP_SERVER_REPOSITORY } from '@core/injection-tokens';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsResult } from '@modelcontextprotocol/sdk/types';

@ApiTags('MCP Servers')
@Controller('mcp-servers')
export class MCPServerController {
  constructor(
    @Inject(MCP_SERVER_REPOSITORY)
    private readonly mcpServerRepository: TypeOrmMCPServerRepository
  ) { }

  private async getToolsFromServer(command: string, args: string[], serverId: string, env: Record<string, string> = {}): Promise<MCPTool[]> {
    try {
      const transport = new StdioClientTransport({
        command,
        args,
        env: { ...process.env, ...env } as Record<string, string>
      });
      const client = new Client({
        name: "ToolCheckerClient",
        version: "1.0.0",
      }, {
        capabilities: {}
      });
      await client.connect(transport);
      const toolsResult = await client.listTools() as ListToolsResult;
      return toolsResult.tools.map(tool => MCPTool.create(
        uuidv4(),
        tool.name,
        tool.description ?? '',
        tool.inputSchema,
        serverId
      ));
    } catch (error) {
      console.error('Error getting tools from server', error);
      throw error;
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new MCP server',
    description: 'Creates a new MCP server with the specified configuration'
  })
  @ApiResponse({
    status: 201,
    description: 'MCP server created successfully',
    type: MCPServerDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or failed to connect to MCP server'
  })
  async createMCPServer(@Body() createDto: CreateMCPServerDto): Promise<MCPServerDto> {
    try {
      const serverId = uuidv4();
      const tools = await this.getToolsFromServer(createDto.command, createDto.args, serverId, createDto.env);

      const mcpServer = new MCPServer(
        serverId,
        createDto.provider,
        createDto.repository,
        createDto.name,
        createDto.command,
        createDto.args,
        createDto.env,
        createDto.description ?? '',
        tools
      );

      const created = await this.mcpServerRepository.create(mcpServer);
      return {
        id: created.id,
        provider: created.provider,
        repository: created.repository,
        name: created.name,
        description: created.description,
        command: created.command,
        args: created.args,
        env: created.env,
        tools: created.tools?.map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.getInputSchema(),
          serverId: tool.serverId
        })) ?? []
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create MCP server: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all MCP servers',
    description: 'Retrieves a list of all available MCP servers'
  })
  @ApiResponse({
    status: 200,
    description: 'List of MCP servers retrieved successfully',
    type: [MCPServerDto]
  })
  async getAllMCPServers(): Promise<MCPServerDto[]> {
    try {
      const servers = await this.mcpServerRepository.findAll();
      return servers.map(server => ({
        id: server.id,
        provider: server.provider,
        repository: server.repository,
        name: server.name,
        description: server.description,
        command: server.command,
        args: server.args,
        env: server.env,
        tools: server.tools?.map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.getInputSchema(),
          serverId: server.id
        })) ?? []
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve MCP servers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get MCP server by ID',
    description: 'Retrieves a specific MCP server by its ID'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the MCP server to retrieve',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'MCP server retrieved successfully',
    type: MCPServerDto
  })
  @ApiResponse({
    status: 404,
    description: 'MCP server not found'
  })
  async getMCPServer(@Param('id') id: string): Promise<MCPServerDto> {
    try {
      const server = await this.mcpServerRepository.findById(id);
      if (!server) {
        throw new HttpException('MCP server not found', HttpStatus.NOT_FOUND);
      }
      return {
        id: server.id,
        provider: server.provider,
        repository: server.repository,
        name: server.name,
        description: server.description,
        command: server.command,
        args: server.args,
        env: server.env,
        tools: server.tools?.map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.getInputSchema(),
          serverId: tool.serverId
        })) ?? []
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to retrieve MCP server: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update MCP server',
    description: 'Updates an existing MCP server with new configuration'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the MCP server to update',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'MCP server updated successfully',
    type: MCPServerDto
  })
  @ApiResponse({
    status: 404,
    description: 'MCP server not found'
  })
  async updateMCPServer(
    @Param('id') id: string,
    @Body() updateDto: CreateMCPServerDto
  ): Promise<MCPServerDto> {
    try {
      const tools = await this.getToolsFromServer(updateDto.command, updateDto.args, id);

      const mcpServer = new MCPServer(
        id,
        updateDto.provider,
        updateDto.repository,
        updateDto.name,
        updateDto.command,
        updateDto.args,
        updateDto.env,
        updateDto.description ?? '',
        tools
      );

      const updated = await this.mcpServerRepository.update(id, mcpServer);
      if (!updated) {
        throw new HttpException('MCP server not found', HttpStatus.NOT_FOUND);
      }
      return {
        id: updated.id,
        provider: updated.provider,
        repository: updated.repository,
        name: updated.name,
        description: updated.description,
        command: updated.command,
        args: updated.args,
        env: updated.env,
        tools: updated.tools?.map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.getInputSchema(),
          serverId: tool.serverId
        })) ?? []
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update MCP server: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete MCP server',
    description: 'Deletes a specific MCP server by its ID'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the MCP server to delete',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'MCP server deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'MCP server not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete MCP server because its tools are being used by agents'
  })
  async deleteMCPServer(@Param('id') id: string): Promise<{ success: boolean }> {
    try {
      const deleted = await this.mcpServerRepository.delete(id);
      if (!deleted) {
        throw new HttpException('MCP server not found', HttpStatus.NOT_FOUND);
      }
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.message.includes('Cannot delete MCP server because tool')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        `Failed to delete MCP server: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
