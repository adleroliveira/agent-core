import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";
import { Agent } from "@core/domain/agent.entity";

@Injectable()
export class MemoryManagerTool {
  getTool(): Tool {
    const parameters: ToolParameter[] = [
      {
        name: "memory",
        type: "object",
        description: "The memory object to store. This can be any JSON-serializable object containing information you want to remember for future interactions.",
        required: true,
      },
      {
        name: "operation",
        type: "string",
        description: "The operation to perform on the memory. Can be 'set' to replace the entire memory, 'update' to merge with existing memory, or 'get' to retrieve the current memory.",
        required: false,
        default: "update",
        enum: ["set", "update", "get"],
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: "memory_manager",
      directive: `This tool allows you to manage your memory, which is included in every system prompt. Use it to:
- Store important information from multi-step tasks
- Keep track of conversation context that might get clipped
- Maintain state for ongoing tasks
- Remember user preferences or important details
- Store intermediate results or calculations

The memory persists across all your responses and is automatically included in your context. This is particularly useful for:
- Long conversations where context might be lost
- Multi-step tasks where you need to remember intermediate results
- Maintaining state across multiple tool calls
- Remembering user preferences or important details

Use the 'set' operation to completely replace your memory, or 'update' to merge new information with existing memory.`,
      description: "Manage the agent's memory that is included in system prompts.",
      parameters,
      handler: this.memoryHandler.bind(this),
      systemPrompt: `Use this tool when you need to:
- Remember information across multiple interactions
- Track progress in a multi-step task
- Store user preferences or important details for future use
- Maintain context in long conversations
- Save intermediate results that will be needed later

Do NOT use this tool for:
- Information that's only needed for the current response
- Storing information that's already in your knowledge base
- When you can accomplish the task in a single interaction`
    });
  }

  private async memoryHandler(args: Record<string, any>, agent: Agent): Promise<string> {
    try {
      const stateId = agent.getMostRecentState().id;
      
      if (args.operation === "get") {
        const memory = agent.getStateMemory(stateId);
        return JSON.stringify(memory);
      }
      
      if (args.operation === "set") {
        agent.updateMemory(stateId, args.memory);
        return "Memory has been completely replaced with the new data.";
      } else {
        // For update operation, we need to get existing memory first
        const existingMemory = agent.getStateMemory(stateId);
        const updatedMemory = { ...existingMemory, ...args.memory };
        agent.updateMemory(stateId, updatedMemory);
        return "Memory has been updated with the new data while preserving existing information.";
      }
    } catch (error) {
      throw new Error(`Failed to update memory: ${error.message}`);
    }
  }
} 