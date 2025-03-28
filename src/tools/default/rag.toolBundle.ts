import { Tool } from "@core/domain/tool.entity";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";
import { RagAddTool } from "./rag-add.tool";
import { RagSearchTool } from "./rag-search.tool";

export class RagToolBundle {
  private readonly tools: Tool[];

  constructor(private readonly knowledgeBase: KnowledgeBase) {
    this.tools = [];
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools.push(
      new RagAddTool(this.knowledgeBase),
      new RagSearchTool(this.knowledgeBase)
    );
  }

  getBundle(): { tools: Tool[] } {
    return {
      tools: this.tools,
    };
  }
} 