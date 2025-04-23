import { AgentToolEntity } from '../entities/agent-tool.entity';
import { MCPTool } from '@core/domain/mcp-tool.entity';
import { MCPToolMapper } from './mcp-tool.mapper';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentToolMapper {
  async toDomain(entity: AgentToolEntity): Promise<MCPTool> {
    return MCPToolMapper.toDomain(entity.tool);
  }

  toPersistence(tool: MCPTool, agentId: string): AgentToolEntity {
    const entity = new AgentToolEntity();
    entity.agentId = agentId;
    entity.toolId = tool.id;
    return entity;
  }
} 