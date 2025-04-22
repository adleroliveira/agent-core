import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { Agent } from "@core/domain/agent.entity";
import { AgentService } from "@core/services/agent.service";
import { AGENT_SERVICE } from "@core/injection-tokens";
import { Inject, Optional } from "@nestjs/common";

export class KnowledgeSearchTool extends Tool {
  constructor(
    @Inject(AGENT_SERVICE)
    private readonly agentService: AgentService,
    @Optional()
    private toolName?: string
  ) {
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
      handler: async (args: Record<string, any>, environment?: Record<string, string>) => {
        const agentId = environment?.agentId;
        if (!agentId) {
          throw new Error("Agent ID is not set");
        }
        const agent = await this.agentService.findAgentById(agentId, true);
        if (!agent) {
          throw new Error("Agent not found");
        }
        // Ensure knowledge base is loaded
        if (!agent.isKnowledgeBaseLoaded()) {
          throw new Error("Knowledge base not loaded. Please ensure the agent is loaded with knowledge base enabled.");
        }
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