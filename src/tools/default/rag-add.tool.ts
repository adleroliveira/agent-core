import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";

export class RagAddTool extends Tool {
  constructor(private readonly knowledgeBase: KnowledgeBase) {
    const parameters: ToolParameter[] = [
      {
        name: "content",
        type: "string",
        description: "The content to add to the knowledge base",
        required: true,
      },
      {
        name: "metadata",
        type: "object",
        description: "Optional metadata to associate with the content",
        required: false,
      },
    ];

    super({
      id: "rag-add",
      name: "rag_add",
      description: "Add content to the agent's knowledge base",
      parameters,
      handler: async (args: Record<string, any>) => {
        const entry = await this.knowledgeBase.addKnowledge(args.content, args.metadata);
        return { id: entry.id };
      }
    });
  }
} 