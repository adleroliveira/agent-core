import { Injectable } from '@nestjs/common';
import { ProcessTool } from './process.tool';
import { Tool } from '@core/domain/tool.entity';

@Injectable()
export class ProcessToolBundle {
  constructor(private readonly processTool: ProcessTool) {}

  getBundle(): { tools: Tool[] } {
    return {
      tools: [this.processTool]
    };
  }
} 