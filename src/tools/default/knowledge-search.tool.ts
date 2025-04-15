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
      systemPrompt: `Use this tool when you need to:
- Find information that you know is in your knowledge base
- Look up domain-specific knowledge or documentation
- Reference previously stored instructions or procedures
- Access permanent information that was added to your knowledge base
- Find information that doesn't require current/real-time data

Do NOT use this tool for:
- Finding current or time-sensitive information
- When you need to verify information from multiple sources
- For information that might have changed since it was added
- When you should use internet_search instead
- For information that's better stored in memory_manager`
    });
  }
} 