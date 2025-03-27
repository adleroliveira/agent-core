import { Tool } from "@core/domain/tool.entity";
import { PtyTool } from "./pty.tool";
import { WorkspaceConfig } from "@core/config/workspace.config";

export class PtyToolBundle {
  private readonly tools: Tool[];

  constructor(private readonly workspaceConfig: WorkspaceConfig) {
    this.tools = [];
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools.push(new PtyTool(this.workspaceConfig));
  }

  getBundle(): { tools: Tool[] } {
    return {
      tools: this.tools,
    };
  }
} 