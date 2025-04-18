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
      directive: `This can be used to add new information to the agent's knowledge base. 
      The content should be a string and the metadata should be an object. The metadata is optional and can be used to associate the content with a specific topic or source.`,
      parameters,
      handler: async (args: Record<string, any>, agent: Agent) => {
        // Ensure knowledge base is loaded
        if (!agent.isKnowledgeBaseLoaded()) {
          throw new Error("Knowledge base not loaded. Please ensure the agent is loaded with knowledge base enabled.");
        }

        const entry = await agent.knowledgeBase.addKnowledge(args.content, args.metadata);
        return { id: entry.id };
      },
      systemPrompt: `Use this tool when you need to:
- Add permanent information to your knowledge base
- Store domain-specific knowledge for future reference
- Save important documentation or instructions
- Create a persistent reference for frequently needed information
- Build up your knowledge about a specific topic or project

Do NOT use this tool for:
- Temporary or session-specific information
- Information that's already in your knowledge base
- When you can use memory_manager for short-term storage
- For information that might change frequently
- When the information is better suited for internet search`
    });
  }
} 