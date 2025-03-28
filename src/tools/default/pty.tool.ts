import { Tool, ToolParameter } from "@core/domain/tool.entity";
import * as os from "os";
import * as pty from "node-pty";
import { WorkspaceConfig } from "@core/config/workspace.config";
import * as path from "path";
import * as fs from "fs";
import { Logger } from "@nestjs/common";

export class PtyTool extends Tool {
  private shell: string;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds timeout
  private readonly logger = new Logger(PtyTool.name);

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
      {
        name: "outputLength",
        type: "number",
        description: "Number of characters to return from command output (0 for no output, defaults to 0)",
        required: false,
        default: 0
      }
    ];

    super({
      id: "pty-execute",
      name: "pty_execute",
      description: `Execute a command in a pseudo-terminal and return its output. All commands are strictly confined to the workspace directory.

PATH HANDLING:
- All paths (both absolute and relative) are treated as relative to the workspace directory
- The workspace acts as a sandbox - you cannot access files outside the workspace
- Example: "/tmp/file.txt" will be created as "workspace/tmp/file.txt"
- Example: "src/file.txt" will be created as "workspace/src/file.txt"

You can control command output visibility using the outputLength parameter:
- Set to 0 (default) to receive no output
- Set to a positive number to receive that many characters from the end of the output
- Useful for commands that generate large outputs or when you only need the final result`,
      parameters,
      handler: async (args: Record<string, any>) => {
        return this.executeCommand(args);
      }
    });

    // Determine the appropriate shell based on the OS
    this.shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    
    // Ensure workspace exists
    this.ensureWorkspaceExists();
  }
  
  private ensureWorkspaceExists(): void {
    try {
      const workspacePath = this.workspaceConfig.getWorkspacePath();
      
      if (!workspacePath) {
        this.logger.error('Workspace path is not configured');
        return;
      }

      this.logger.log(`Using workspace path: ${workspacePath}`);

      if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
        this.logger.log(`Created workspace directory: ${workspacePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to verify workspace: ${error.message}`);
    }
  }

  private async executeCommand(args: Record<string, any>): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      try {
        const workspacePath = this.workspaceConfig.getWorkspacePath();
        
        if (!workspacePath) {
          throw new Error("Workspace path is not configured");
        }
        
        // Ensure workspace directory exists
        if (!fs.existsSync(workspacePath)) {
          try {
            fs.mkdirSync(workspacePath, { recursive: true });
            this.logger.log(`Created workspace directory: ${workspacePath}`);
          } catch (error) {
            throw new Error(`Failed to create workspace directory: ${error.message}`);
          }
        }
        
        // Determine working directory
        let cwd: string;
        
        if (!args.cwd) {
          cwd = workspacePath;
        } else {
          // Normalize the path to handle different OS path formats
          const normalizedCwd = path.normalize(args.cwd);
          
          // Remove leading slash if present to treat absolute paths as relative
          const relativePath = normalizedCwd.startsWith(path.sep) ? normalizedCwd.slice(1) : normalizedCwd;
          
          // Resolve the path relative to workspace
          cwd = path.resolve(workspacePath, relativePath);
          
          // Ensure the path is within workspace
          if (!cwd.startsWith(workspacePath)) {
            throw new Error(`Path "${normalizedCwd}" resolved to "${cwd}" which is outside the workspace "${workspacePath}"`);
          }
        }
        
        // Create the working directory if it doesn't exist
        if (!fs.existsSync(cwd)) {
          try {
            fs.mkdirSync(cwd, { recursive: true });
            this.logger.log(`Created working directory: ${cwd}`);
          } catch (error) {
            throw new Error(`Failed to create working directory: ${error.message}`);
          }
        }
        
        this.logger.debug(`Executing command in directory: ${cwd}`);

        // Set up terminal with minimized control sequences
        const term = pty.spawn(this.shell, [], {
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd,
          env: {
            ...process.env,
            ...args.env,
            TERM: 'dumb',          // Reduces ANSI codes
            PS1: '$ ',             // Simplifies prompt
            PROMPT_COMMAND: '',    // Disables prompt customizations
            FORCE_COLOR: '0',      // Discourage colors in output
            NO_COLOR: '1'          // Many modern CLI tools respect this
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

        // Clean terminal output as it comes in
        const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
        
        term.onData((data) => {
          // Clean ANSI sequences from data
          const cleanData = data.replace(ansiRegex, '');
          output += cleanData;
        });

        // Handle process exit
        term.onExit(({ exitCode: code }) => {
          clearTimeout(timeoutId);
          if (!isResolved) {
            isResolved = true;
            exitCode = code;
            
            // Final cleaning of the entire output
            output = this.cleanOutput(output, args.command);
            
            // Handle output truncation if requested
            if (args.outputLength > 0) {
              output = output.slice(-args.outputLength);
            } else {
              output = '';
            }
            
            resolve({ output, exitCode });
          }
        });

        // Write command and ensure it exits
        const command = args.command.trim();
        term.write(`${command}\r\n`);
        
        // Add a small delay before sending exit command to ensure the main command has started
        setTimeout(() => {
          if (!isResolved) {
            term.write("exit\r\n");
          }
        }, 500);  // Increased delay to give command more time to start

      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Clean terminal output by removing ANSI sequences, prompts, and command echoes
   */
  private cleanOutput(output: string, command: string): string {
    // Remove ANSI escape sequences
    let cleanOutput = output.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    
    // Remove shell prompts (like "user@hostname:/path$")
    cleanOutput = cleanOutput.replace(/^.*?[$#>]\s*/gm, '');
    
    // Remove the command itself if it appears in the output
    const escapedCommand = this.escapeRegExp(command);
    cleanOutput = cleanOutput.replace(new RegExp(`^\\s*${escapedCommand}\\s*$`, 'm'), '');
    
    // Remove exit command
    cleanOutput = cleanOutput.replace(/^\s*exit\s*$/gm, '');
    
    // Remove empty lines at the beginning and end
    cleanOutput = cleanOutput.trim();
    
    // Remove any special terminal control sequences
    cleanOutput = cleanOutput.replace(/\[\?[0-9]+[hl]/g, '');
    
    // Remove shell initialization messages
    const commonMessages = [
      /To run a command as administrator.*\n/i,
      /See "man sudo_root".*\n/i,
      /bash: \/\.cargo\/env:.*\n/i,
    ];
    
    commonMessages.forEach(pattern => {
      cleanOutput = cleanOutput.replace(pattern, '');
    });
    
    return cleanOutput;
  }
  
  /**
   * Escape special characters in a string for use in a regular expression
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}