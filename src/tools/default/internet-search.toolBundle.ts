import { Injectable } from "@nestjs/common";
import { Tool } from "@core/domain/tool.entity";
import { InternetSearchTool } from "./internet-search.tool";

@Injectable()
export class InternetSearchToolBundle {
  constructor(private readonly internetSearchTool: InternetSearchTool) {}

  getBundle(): { tools: Tool[] } {
    return {
      tools: [this.internetSearchTool.getTool()]
    };
  }
} 