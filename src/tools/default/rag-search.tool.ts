import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { KnowledgeBase } from "@core/domain/knowledge-base.entity";

export class RagSearchTool extends Tool {
  constructor(private readonly knowledgeBase: KnowledgeBase) {
    const parameters: ToolParameter[] = [
      {
        name: "query",
        type: "string",
        description: "The search query to find relevant knowledge",
        required: true,
      },
      {
        name: "topK",
        type: "number",
        description: "Maximum number of results to return",
        required: false,
      },
    ];

    super({
      id: "rag-search",
      name: "rag_search",
      description: "Search the agent's knowledge base for relevant information",
      parameters,
      handler: async (args: Record<string, any>) => {
        const results = await this.knowledgeBase.searchKnowledge(args.query, args.topK || 5);
        return results.map(({ entry, score }) => ({
          id: entry.id,
          content: entry.content,
          metadata: entry.metadata,
          score,
        }));
      },
    });
  }
} 