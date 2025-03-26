import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { KnowledgeBasePort } from "@ports/knowledge-base/knowledge-base.port";

export class RagAddTool extends Tool {
  private readonly knowledgeBase: KnowledgeBasePort;

  constructor(knowledgeBase: KnowledgeBasePort) {
    const parameters: ToolParameter[] = [
      {
        name: "content",
        type: "string",
        description: "The text content to add to the knowledge base",
        required: true,
      },
      {
        name: "metadata",
        type: "object",
        description: "Optional metadata to associate with the knowledge entry",
        required: false,
      },
    ];

    super({
      id: "rag-add",
      name: "ragAdd",
      description: `Add new knowledge to the knowledge base.
      Input should be a text content and optional metadata.
      Returns the created knowledge base entry.`,
      parameters,
      handler: async (args: Record<string, any>) => {
        const entry = await knowledgeBase.addKnowledge(
          args.content,
          args.metadata
        );
        return {
          id: entry.id,
          content: entry.content,
          metadata: entry.metadata,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        };
      },
    });

    this.knowledgeBase = knowledgeBase;
  }
} 