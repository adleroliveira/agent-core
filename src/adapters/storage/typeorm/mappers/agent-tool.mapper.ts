import { AgentToolEntity } from '../entities/agent-tool.entity';
import { Tool } from '@core/domain/tool.entity';
import { ToolMapper } from './tool.mapper';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentToolMapper {
  constructor(private readonly toolMapper: ToolMapper) {}

  async toDomain(entity: AgentToolEntity): Promise<Tool> {
    return this.toolMapper.toDomain(entity.tool);
  }

  toPersistence(tool: Tool, agentId: string): AgentToolEntity {
    const entity = new AgentToolEntity();
    entity.agentId = agentId;
    entity.toolId = tool.id;
    return entity;
  }
} 