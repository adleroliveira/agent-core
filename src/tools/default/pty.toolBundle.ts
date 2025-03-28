import { Tool } from "@core/domain/tool.entity";
import { PtyTool } from "./pty.tool";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { Logger, Injectable } from "@nestjs/common";

@Injectable()
export class PtyToolBundle {
  private readonly tools: Tool[];
  private readonly logger = new Logger(PtyToolBundle.name);

  constructor(private readonly workspaceConfig: WorkspaceConfig) {
    if (!workspaceConfig) {
      throw new Error('WorkspaceConfig is required for PtyToolBundle');
    }
    this.tools = [];
    this.initializeTools();
  }

  private initializeTools(): void {
    try {
      const ptyTool = new PtyTool();
      ptyTool.setWorkspaceConfig(this.workspaceConfig);
      this.tools.push(ptyTool);
      this.logger.log('PTY tool initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize PTY tool: ${error.message}`);
      throw error;
    }
  }

  getBundle(): { tools: Tool[] } {
    return {
      tools: this.tools,
    };
  }
} 