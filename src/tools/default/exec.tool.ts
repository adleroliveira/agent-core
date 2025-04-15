import { Tool, ToolParameter } from "@core/domain/tool.entity";
import * as path from "path";
import * as fs from "fs";
import { Logger } from "@nestjs/common";
import { WorkspaceConfig } from "@core/config/workspace.config";
import { Agent } from "@core/domain/agent.entity";
import { spawn } from "child_process";
import * as os from "os";

export class CommandTool extends Tool {
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds timeout
  private readonly logger = new Logger(CommandTool.name);
  private shellCommand: string;
  private shellArgs: string[];

  constructor() {
    const parameters: ToolParameter[] = [
      {
        name: "command",
        type: "string",
        description: "The command to execute",
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
        description: "Number of characters to return from command output (0 for no output, defaults to 1000)",
        required: false,
        default: 1000
      }
    ];

    super({
      id: "cmd-execute",
      name: "cmd_execute",
      directive: `Execute a command and return its output. All commands are strictly confined to the workspace directory.
      You may be running on an environment that has access to the internet, in which case you can use commands that require internet access.

      You can control command output visibility using the outputLength parameter:
      - Set to 0 to receive no output
      - Set to a positive number to receive that many characters from the end of the output
      - Useful for commands that generate large outputs or when you only need the final result`,
      description: `Execute a command and return its output to the LLM. All commands are strictly confined to the workspace directory.`,
      parameters,
      handler: async (args: Record<string, any>, agent: Agent) => {
        this.ensureWorkspaceExists(agent.workspaceConfig);
        return this.executeCommand(args, agent.workspaceConfig!);
      },
      systemPrompt: `Use this tool when you need to:
- Execute quick, one-time commands
- Run file operations or system commands
- Execute scripts or simple programs
- Run commands that complete quickly and don't need background execution

Do NOT use this tool for:
- Long-running processes or services
- Operations that need to maintain state
- When you need to monitor process status
- For background services or servers
- When process_manager would be more appropriate`
    });

    // Set up shell command based on platform
    if (os.platform() === "win32") {
      this.shellCommand = "powershell.exe";
      this.shellArgs = ["-Command"];
    } else {
      // Try to find available shell in a more platform-agnostic way
      // Check for bash first, then fall back to sh which should be available on all POSIX systems
      try {
        // Simple synchronous check if bash exists
        require('child_process').execSync('which bash', { stdio: 'ignore' });
        this.shellCommand = "bash";
        this.shellArgs = ["-c"];
      } catch (e) {
        // Fallback to sh which should be available on all POSIX systems
        this.shellCommand = "sh";
        this.shellArgs = ["-c"];
      }
    }
  }

  private ensureWorkspaceExists(workspaceConfig?: WorkspaceConfig): void {
    try {
      if (!workspaceConfig) {
        throw new Error("Workspace config is not set");
      }

      const workspacePath = workspaceConfig.getWorkspacePath();

      if (!workspacePath) {
        throw new Error("Workspace path is not configured");
      }

      this.logger.log(`Using workspace path: ${workspacePath}`);

      if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
        this.logger.log(`Created workspace directory: ${workspacePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to verify workspace: ${error.message}`);
      throw error;
    }
  }

  private async executeCommand(args: Record<string, any>, workspaceConfig: WorkspaceConfig): Promise<{ output: string; exitCode: number }> {
    if (!workspaceConfig) {
      throw new Error("Workspace config is not set. Please ensure the tool is properly initialized.");
    }

    return new Promise((resolve, reject) => {
      this.logger.log(`Executing command: ${args.command}`);

      try {
        const workspacePath = workspaceConfig.getWorkspacePath();

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

        // No special handling for specific commands - we'll use proper process handling instead

        // Start the child process
        // For shells that use -c (bash, sh), we need to pass the entire command as a single argument
        // For PowerShell, similar treatment is needed
        // In executeCommand method
        let cmd;
        if ((this.shellCommand === 'bash' || this.shellCommand === 'sh') && this.shellArgs[0] === '-c') {
          // Pass the command as-is without additional quoting here
          // The shell will handle the internal quotes and redirection
          cmd = ['-c', args.command];
        } else if (this.shellCommand === 'powershell.exe' && this.shellArgs[0] === '-Command') {
          cmd = ['-Command', args.command];
        } else {
          cmd = this.shellArgs.concat(args.command);
        }

        this.logger.debug(`Full command: ${this.shellCommand} ${cmd.map(arg => `'${arg}'`).join(' ')}`);

        const child = spawn(this.shellCommand, cmd, {
          cwd,
          env: {
            ...process.env,
            ...args.env,
            // Environment variables to minimize terminal output formatting
            TERM: 'dumb',
            FORCE_COLOR: '0',
            NO_COLOR: '1'
          },
          shell: false,
          // Use stdio configuration to handle stdin properly
          stdio: ['pipe', 'pipe', 'pipe']
        });

        if (child.stdin) {
          child.stdin.end();
        }

        let stdoutData = "";
        let stderrData = "";
        let isResolved = false;

        // Set up timeout handler
        const timeout = args.timeout || this.DEFAULT_TIMEOUT;
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;

            // Log the timeout for debugging
            this.logger.error(`Command execution timed out after ${timeout}ms: ${args.command}`);

            // Only attempt to close stdin if it exists
            if (child.stdin && !child.stdin.destroyed) {
              child.stdin.end();
            }

            // Try to kill the process if it's still running
            try {
              child.kill('SIGTERM');

              // Force kill after a brief delay if SIGTERM doesn't work
              setTimeout(() => {
                try {
                  if (!child.killed) {
                    child.kill('SIGKILL');
                  }
                } catch (e) {
                  // Ignore errors when force killing
                }
              }, 500);
            } catch (e) {
              // Ignore errors when killing
            }

            // Resolve with timeout information instead of rejecting
            resolve({
              output: `Command execution timed out after ${timeout}ms. Command: ${args.command}`,
              exitCode: 124  // Standard timeout exit code
            });
          }
        }, timeout);

        // Collect stdout data
        child.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdoutData += chunk;
          this.logger.debug(`Received stdout chunk: ${chunk.length} characters`);
        });

        // Collect stderr data
        child.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderrData += chunk;
          this.logger.debug(`Received stderr chunk: ${chunk.length} characters`);
        });

        // Handle process exit - add this event handler
        child.on('exit', (code, signal) => {
          this.logger.debug(`Process exited with code ${code} and signal ${signal}`);

          if (!isResolved) {
            clearTimeout(timeoutId);
            isResolved = true;

            // Combine stdout and stderr
            let output = stdoutData;
            if (stderrData) {
              output += (output ? '\n' : '') + stderrData;
            }

            // Handle output truncation if requested
            const outputLength = args.outputLength !== undefined ? args.outputLength : 1000;
            if (outputLength > 0 && output.length > outputLength) {
              output = output.slice(-outputLength);
            } else if (outputLength === 0) {
              output = '';
            }

            const exitCode = code !== null ? code : (signal ? 1 : 0);
            resolve({ output, exitCode });
          }
        });

        // Handle process completion
        child.on('close', (code) => {
          this.logger.debug(`Process closed with code ${code}`);

          if (!isResolved) {
            clearTimeout(timeoutId);
            isResolved = true;

            // Combine stdout and stderr
            let output = stdoutData;
            if (stderrData) {
              output += (output ? '\n' : '') + stderrData;
            }

            // Handle output truncation if requested
            const outputLength = args.outputLength !== undefined ? args.outputLength : 1000;
            if (outputLength > 0 && output.length > outputLength) {
              output = output.slice(-outputLength);
            } else if (outputLength === 0) {
              output = '';
            }

            // If there's stderr output but exit code is 0, set exit code to 1
            const exitCode = code !== null ? code : (stderrData ? 1 : 0);
            resolve({ output, exitCode });
          }
        });

        // Handle process errors
        child.on('error', (error) => {
          this.logger.error(`Process error: ${error.message}`);

          if (!isResolved) {
            clearTimeout(timeoutId);
            isResolved = true;
            reject(error);
          }
        });

      } catch (error) {
        this.logger.error(`Error executing command: ${error.message}`, error);
        reject(error);
      }
    });
  }
}