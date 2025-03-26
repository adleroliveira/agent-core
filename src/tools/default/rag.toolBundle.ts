import { Tool } from "@core/domain/tool.entity";
import { KnowledgeBasePort } from "@ports/knowledge-base/knowledge-base.port";
import { RagAddTool } from "./rag-add.tool";
import { RagSearchTool } from "./rag-search.tool";

export class RagToolBundle {
  private readonly tools: Tool[];

  constructor(knowledgeBase: KnowledgeBasePort) {
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