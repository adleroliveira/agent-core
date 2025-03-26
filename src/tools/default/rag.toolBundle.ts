import { Tool } from "@core/domain/tool.entity";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";
import { RagAddTool } from "./rag-add.tool";
import { RagSearchTool } from "./rag-search.tool";

export class RagToolBundle {
  private readonly tools: Tool[];

  constructor(knowledgeBase: KnowledgeBase) {
    this.tools = [
      new RagAddTool(knowledgeBase),
      new RagSearchTool(knowledgeBase),
    ];
  }

  getBundle(): { tools: Tool[] } {
    return {
      tools: this.tools,
    };
  }
} 