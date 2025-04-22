import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";
import { AgentService } from "@core/services/agent.service";
import { AGENT_SERVICE } from "@core/injection-tokens";
import { Inject } from "@nestjs/common";

@Injectable()
export class MemoryManagerTool {
  // Define a structured memory schema to guide agents
  private defaultMemoryStructure = {
    // User-related information
    preferences: {},
    // Context about the conversation
    context: {},
    // Task tracking for multi-step processes
    tasks: {},
    // Important facts to remember
    entities: {},
    // Custom data for flexible use cases
    custom: {}
  };

  constructor(
    @Inject(AGENT_SERVICE)
    private readonly agentService: AgentService,
  ) { }

  getTool(): Tool {
    const parameters: ToolParameter[] = [
      {
        name: "action",
        type: "string",
        description: "The action to perform on memory",
        required: true,
        enum: ["store", "update", "clear"],
        default: "store",
      },
      {
        name: "path",
        type: "string",
        description: "The memory path to operate on (e.g., 'preferences.theme', 'tasks.current', 'entities.company')",
        required: true,
      },
      {
        name: "data",
        type: "string",
        description: "The data to store at the specified path. Can be a string or a stringified JSON object.",
        required: true,
      }
    ];

    return new Tool({
      id: uuidv4(),
      name: "memory_manager",
      directive: `MEMORY STORAGE TOOL

Your memory is ALREADY available to you in your system prompt inside the <memory/> section.
This tool is ONLY for STORING NEW INFORMATION that will appear in future system prompts.

DO NOT use this tool to retrieve or check memory - the <memory/> section in your system prompt already contains all memory!

Memory is structured with these sections:
- preferences: Store user preferences (e.g., theme, language)
- context: Store conversation context (e.g., topics, interests)
- tasks: Track progress in multi-step operations
- entities: Store important facts about people, companies, etc.
- custom: Store any other data

ACTIONS:
- store: Save new data (overwrites existing data at path)
- update: Merge new data with existing data at path  
- clear: Remove data at specified path (use null for data parameter)

EXAMPLES:
- Save user preference: 
  memory_manager(action="store", path="preferences.theme", data="dark")
  
- Update current task: 
  memory_manager(action="update", path="tasks.steps.current", data="3")
  
- Add important fact: 
  memory_manager(action="update", path="context.interest", data="Machine Learning")
  
- Clear completed tasks: 
  memory_manager(action="clear", path="tasks.completed", data=null)`,

      description: "Store new information in memory for future interactions",
      parameters,
      handler: this.memoryHandler.bind(this),
      systemPrompt: `
Your memory is ALREADY in your system prompt - you NEVER need to retrieve it!

This tool should be used if you need to:
✓ Save user preferences for future messages
✓ Track progress in multi-step tasks
✓ Remember important facts for later use

DO NOT use this tool:
✗ To retrieve or check memory (it's already in your system prompt)
✗ For information only needed in your current response
✗ When you're unsure if memory exists (assume it does)

MEMORY STRUCTURE:
- preferences: Store user preferences (theme, language)
- context: Store conversation context (topics, interests)
- tasks: Track current task details and progress
- entities: Store important facts about people, companies, etc.
- custom: Store any other data
`
    });
  }

  private async memoryHandler(args: Record<string, any>, environment?: Record<string, string>): Promise<string> {
    try {
      const agentId = environment?.agentId;
      const stateId = environment?.stateId;

      if (!agentId) {
        throw new Error("Agent ID is not set");
      }
      if (!stateId) {
        throw new Error("State ID is not set");
      }

      // Check for missing required parameters
      if (!args.path) {
        return "ERROR: 'path' parameter is required. Specify where to store the data.";
      }

      if (args.data === undefined && args.action !== "clear") {
        return "ERROR: 'data' parameter is required. Specify what data to store.";
      }

      // Process the requested action
      switch (args.action) {
        case "store":
          // For store action, we'll create a new memory object with just the path and data
          const storeMemory = {};
          let storeData = args.data;
          // If data is a string that looks like JSON, try to parse it
          if (typeof storeData === 'string' && (storeData.startsWith('{') || storeData.startsWith('['))) {
            try {
              storeData = JSON.parse(storeData);
            } catch (e) {
              // If parsing fails, keep it as a string
            }
          }
          this.setValueAtPath(storeMemory, args.path, storeData);
          await this.agentService.setAgentMemory(agentId, stateId, storeMemory);
          return `✅ Stored data at '${args.path}'. This will be available in your system prompt in future interactions.`;

        case "update":
          // For update action, we'll first get the current memory
          const currentMemory = await this.agentService.getMemory(agentId, stateId);
          console.log('Current memory before update:', JSON.stringify(currentMemory, null, 2));
          let updateData = args.data;
          // If data is a string that looks like JSON, try to parse it
          if (typeof updateData === 'string' && (updateData.startsWith('{') || updateData.startsWith('['))) {
            try {
              updateData = JSON.parse(updateData);
            } catch (e) {
              // If parsing fails, keep it as a string
            }
          }
          console.log('Updating path:', args.path, 'with data:', updateData);
          const updatedMemory = this.setValueAtPath(currentMemory, args.path, updateData);
          console.log('Memory after update:', JSON.stringify(updatedMemory, null, 2));
          await this.agentService.updateAgentMemory(agentId, stateId, updatedMemory);
          return `✅ Updated data at '${args.path}'. This will be available in your system prompt in future interactions.`;

        case "clear":
          // For clear action, we'll delete the specific memory entry
          await this.agentService.deleteAgentMemoryEntry(agentId, stateId, args.path);
          return `✅ Cleared data at '${args.path}'. This will be reflected in your system prompt in future interactions.`;

        default:
          return `ERROR: Unknown action '${args.action}'. Valid actions are: store, update, clear.`;
      }
    } catch (error) {
      return `ERROR: ${error.message}. Memory was NOT modified.`;
    }
  }

  // Helper functions for path-based operations
  private getValueAtPath(obj: any, path: string): any {
    const keys = path.split('.');
    return keys.reduce((o, key) => (o && o[key] !== undefined) ? o[key] : null, obj);
  }

  private setValueAtPath(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone

    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    return result;
  }
}