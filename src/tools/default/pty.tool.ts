import { Tool, ToolParameter } from "@core/domain/tool.entity";
import * as os from "os";
import * as pty from "node-pty";
import { WorkspaceConfig } from "@core/config/workspace.config";
import * as path from "path";

export class PtyTool extends Tool {
  private shell: string;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds timeout

  constructor(private readonly workspaceConfig: WorkspaceConfig) {
    const parameters: ToolParameter[] = [
      {
        name: "command",
        type: "string",
        description: "The command to execute in the pseudo-terminal",
        required: true,
      },
      {
        name: "cwd",
        type: "string",
        description: "The working directory to execute the command in (relative to workspace)",
        required: false,
      },
      {
        name: "env",
        type: "object",
        description: "Environment variables to set for the command",
        required: false,
      },
      {
        name: "timeout",
        type: "number",
        description: "Timeout in milliseconds for the command execution",
        required: false,
      },
    ];

    super({
      id: "pty-execute",
      name: "pty_execute",
      description: "Execute a command in a pseudo-terminal and return its output. Commands are confined to the workspace directory.",
      parameters,
      handler: async (args: Record<string, any>) => {
        return this.executeCommand(args);
      }
    });

    // Determine the appropriate shell based on the OS
    this.shell = os.platform() === "win32" ? "powershell.exe" : "bash";
  }

  private async executeCommand(args: Record<string, any>): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      try {
        const workspacePath = this.workspaceConfig.getWorkspacePath();
        const cwd = args.cwd 
          ? path.resolve(workspacePath, args.cwd)
          : workspacePath;

        if (!cwd.startsWith(workspacePath)) {
          throw new Error("Working directory must be within the workspace");
        }

        const term = pty.spawn(this.shell, [], {
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd,
          env: {
            ...process.env,
            ...args.env,
          },
        });

        let output = "";
        let exitCode: number;
        let isResolved = false;

        // Set up timeout
        const timeout = args.timeout || this.DEFAULT_TIMEOUT;
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            term.kill();
            reject(new Error(`Command execution timed out after ${timeout}ms`));
          }
        }, timeout);

        term.onData((data) => {
          output += data;
        });

        // Handle process exit
        term.onExit(({ exitCode: code }) => {
          clearTimeout(timeoutId);
          if (!isResolved) {
            isResolved = true;
            exitCode = code;
            resolve({ output, exitCode });
          }
        });

        // Write command and ensure it exits
        const command = args.command.trim();
        term.write(`${command}\r`);
        
        // Add a small delay before sending exit command to ensure the main command has started
        setTimeout(() => {
          if (!isResolved) {
            term.write("exit\r");
          }
        }, 100);

      } catch (error) {
        reject(error);
      }
    });
  }
} 