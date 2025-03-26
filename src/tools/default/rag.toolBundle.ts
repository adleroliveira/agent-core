import { Tool } from "@core/domain/tool.entity";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";
import { RagAddTool } from "./rag-add.tool";
import { RagSearchTool } from "./rag-search.tool";

export class RagToolBundle {
  private readonly tools: Tool[];
  private knowledgeBase?: KnowledgeBase;

  constructor(knowledgeBase?: KnowledgeBase) {
    this.knowledgeBase = knowledgeBase;
    this.tools = [];
    this.initializeTools();
  }

  private initializeTools(): void {
    if (!this.knowledgeBase) {
      // Create placeholder tools that will be updated later
      this.tools.push(
        new RagAddTool(null as any),
        new RagSearchTool(null as any)
      );
    } else {
      // Create tools with the knowledge base
      this.tools.push(
        new RagAddTool(this.knowledgeBase),
        new RagSearchTool(this.knowledgeBase)
      );
    }
  }

  getBundle(): { tools: Tool[] } {
    return {
      tools: this.tools,
    };
  }

  // Method to update tools with a knowledge base instance
  updateKnowledgeBase(knowledgeBase: KnowledgeBase): void {
    this.knowledgeBase = knowledgeBase;
    this.tools.length = 0; // Clear existing tools
    this.initializeTools(); // Reinitialize with new knowledge base
  }
} 