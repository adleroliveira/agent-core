import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";
import { Agent } from "@core/domain/agent.entity";

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
        description: "The data to store at the specified path",
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

  private async memoryHandler(args: Record<string, any>, agent: Agent): Promise<string> {
    try {
      const stateId = agent.getMostRecentState().id;
      let currentMemory = agent.getStateMemory(stateId) || {};

      // Initialize with default structure if empty
      if (Object.keys(currentMemory).length === 0) {
        currentMemory = this.defaultMemoryStructure;
        agent.updateMemory(stateId, currentMemory);
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
          const storedMemory = this.setValueAtPath(currentMemory, args.path, args.data);
          agent.updateMemory(stateId, storedMemory);
          return `✅ Stored "${args.data}" at '${args.path}'. This will be available in your system prompt in future interactions.`;

        case "update":
          const existingValue = this.getValueAtPath(currentMemory, args.path);
          let newValue;

          // Since data is now a string, handle differently
          if (Array.isArray(existingValue)) {
            // For arrays, add the string as a new element
            newValue = [...existingValue, args.data];
          } else if (typeof existingValue === 'object' && existingValue !== null) {
            // For objects, we can't easily merge with a string
            // So we'll set a default property or overwrite
            newValue = {
              ...existingValue,
              value: args.data
            };
          } else {
            // For primitives or non-existent values, just set
            newValue = args.data;
          }

          const mergedMemory = this.setValueAtPath(currentMemory, args.path, newValue);
          agent.updateMemory(stateId, mergedMemory);
          return `✅ Updated data at '${args.path}'. This will be available in your system prompt in future interactions.`;

        case "clear":
          // Clear specific path by setting it to null
          const clearedMemory = this.setValueAtPath(currentMemory, args.path, null);
          agent.updateMemory(stateId, clearedMemory);
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
        // Create missing path segments as objects
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    return result;
  }
}