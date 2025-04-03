import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { Agent } from "@core/domain/agent.entity";

export class KnowledgeSearchTool extends Tool {
  constructor(private toolName?: string) {
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
      id: "knowledge_search",
      name: toolName || "knowledge_search",
      directive: `Use this tool to search the agent's knowledge base for relevant information. 
      The query should be a string and the topK parameter is optional and specifies the maximum number of results to return.`,
      description: "Search the agent's knowledge base for relevant information",
      parameters,
      handler: async (args: Record<string, any>, agent: Agent) => {
        const results = await agent.knowledgeBase.searchKnowledge(args.query, args.topK || 5);
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