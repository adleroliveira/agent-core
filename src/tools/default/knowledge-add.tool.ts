import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { Agent } from "@core/domain/agent.entity";

export class KnowledgeAddTool extends Tool {
  constructor(private toolName?: string) {
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
      id: "knowledge_add",
      name: toolName || "knowledge_add",
      description: "Add content to the agent's knowledge base",
      parameters,
      handler: async (args: Record<string, any>, agent: Agent) => {
        const entry = await agent.knowledgeBase.addKnowledge(args.content, args.metadata);
        return { id: entry.id };
      }
    });
  }
} 