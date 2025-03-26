import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { KnowledgeBasePort } from "@ports/knowledge-base/knowledge-base.port";

export class RagSearchTool extends Tool {
  private readonly knowledgeBase: KnowledgeBasePort;

  constructor(knowledgeBase: KnowledgeBasePort) {
    const parameters: ToolParameter[] = [
      {
        name: "query",
        type: "string",
        description: "The search query to find relevant information in the knowledge base",
        required: true,
      },
    ];

    super({
      id: "rag-search",
      name: "ragSearch",
      description: `Search the knowledge base for relevant information.
      Input should be a search query string.
      Returns the most relevant entries from the knowledge base with their relevance scores.`,
      parameters,
      handler: async (args: Record<string, any>) => {
        const results = await knowledgeBase.searchKnowledge(args.query);
        return {
          query: args.query,
          results: results.map(({ entry, score }) => ({
            content: entry.content,
            score,
            metadata: entry.metadata,
          })),
        };
      },
    });

    this.knowledgeBase = knowledgeBase;
  }
} 