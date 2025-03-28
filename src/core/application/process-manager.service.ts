import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { Process, ProcessStatus } from '@core/domain/process.entity';
import { ProcessRepositoryPort } from '@ports/storage/process-repository.port';
import { WorkspaceConfig } from '@core/config/workspace.config';
import * as pty from 'node-pty';
import * as os from 'os';
import { PROCESS_REPOSITORY } from '@adapters/adapters.module';

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);
  private shell: string;
  private activeProcesses: Map<string, { term: pty.IPty, processObj: Process }> = new Map();

  constructor(
    @Inject(forwardRef(() => PROCESS_REPOSITORY))
    private readonly processRepository: ProcessRepositoryPort,
    private readonly workspaceConfig: WorkspaceConfig
  ) {
    this.shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  }

  async startProcess(
    name: string, 
    command: string, 
    metadata?: Record<string, any>,
    env?: Record<string, string>
  ): Promise<Process> {
    const process = new Process({
      name,
      command,
      metadata,
      env
    });

    const savedProcess = await this.processRepository.save(process);
    
    // Start the process in the background without waiting for completion
    this.executeProcess(savedProcess).catch(error => {
      this.logger.error(`Process execution failed: ${error.message}`);
      // Update the process status in the database even if execution fails
      savedProcess.fail(error.message);
      this.processRepository.save(savedProcess).catch(err => {
        this.logger.error(`Failed to update process status in database: ${err.message}`);
      });
    });

    return savedProcess;
  }

  private async executeProcess(process: Process): Promise<void> {
    try {
      // Get the workspace path and validate it exists
      const defaultWorkspacePath = this.workspaceConfig.getWorkspacePath();
      
      // Validate workspace directory exists before continuing
      if (!defaultWorkspacePath) {
        throw new Error('Workspace path is not configured');
      }
      
      // Check if there's a specific working directory in the metadata
      const workingDirectory = process.metadata?.workingDirectory || defaultWorkspacePath;
      
      // Log the directory being used
      this.logger.debug(`Using working directory: ${workingDirectory}`);
      
      process.start();
      await this.processRepository.save(process);

      // Set environment variables to minimize terminal noise
      const env = {
        ...process.env,
        TERM: 'dumb',        // Reduces ANSI color codes
        PS1: '$ ',           // Simplifies prompt
        PROMPT_COMMAND: '',   // Disables prompt customizations
        FORCE_COLOR: '0',     // Discourage colors in output
        NO_COLOR: '1'         // Many modern CLI tools respect this
      };

      const term = pty.spawn(this.shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: workingDirectory,
        env
      });

      // Track if this is a long-running process
      const isLongRunning = process.isLongRunning();
      
      // Store active process if it's long-running
      if (isLongRunning) {
        this.activeProcesses.set(process.id, { term, processObj: process });
      }

      let outputBuffer = '';
      let lastSaveTime = Date.now();
      const SAVE_INTERVAL = 5000; // 5 seconds between saves for long-running processes
      
      // Terminal utility class to help with cleaning output
      const terminalCleaner = new TerminalOutputCleaner();

      return new Promise((resolve, reject) => {
        term.onData((data) => {
          // Clean the data as it comes in
          const cleanChunk = terminalCleaner.cleanChunk(data);
          outputBuffer += cleanChunk;
          
          const now = Date.now();
          
          // For long-running processes, periodically update the output
          if (isLongRunning && now - lastSaveTime > SAVE_INTERVAL) {
            process.updateOutput(outputBuffer);
            this.processRepository.save(process).catch(error => {
              this.logger.error(`Failed to update process output: ${error.message}`);
            });
            lastSaveTime = now;
          }
          
          this.logger.debug(`Process ${process.id} output: ${cleanChunk}`);
        });

        term.onExit(async ({ exitCode }) => {
          try {
            // Remove from active processes
            this.activeProcesses.delete(process.id);
            
            // Final cleaning of the entire output
            const finalOutput = terminalCleaner.getCleanOutput(outputBuffer, process.command);
            
            if (exitCode === 0) {
              process.complete(finalOutput, exitCode);
              await this.processRepository.save(process);
              this.logger.log(`Process ${process.id} completed successfully with exit code ${exitCode}`);
            } else {
              process.fail(finalOutput, exitCode);
              await this.processRepository.save(process);
              this.logger.error(`Process ${process.id} failed with exit code ${exitCode}`);
            }
            resolve();
          } catch (error) {
            this.logger.error(`Failed to update process status in database: ${error.message}`);
            reject(error);
          }
        });

        // Execute the command
        term.write(`${process.command}\r\n`);
        
        // For non-long-running processes, add the exit command to terminate
        if (!isLongRunning) {
          // We wait a bit to let the command output finish before exiting
          setTimeout(() => {
            term.write('exit\r\n');
          }, 500);
        }
      });
    } catch (error) {
      process.fail(error.message);
      await this.processRepository.save(process);
      this.logger.error(`Process ${process.id} failed: ${error.message}`);
      throw error;
    }
  }

  async getProcessStatus(id: string): Promise<Process | null> {
    return this.processRepository.findById(id);
  }

  async cancelProcess(id: string): Promise<Process | null> {
    const process = await this.processRepository.findById(id);
    if (!process) {
      return null;
    }

    // If this is an active long-running process, terminate the PTY
    const activeProcess = this.activeProcesses.get(id);
    if (activeProcess) {
      try {
        // Try to send SIGTERM first
        activeProcess.term.kill();
        this.activeProcesses.delete(id);
      } catch (error) {
        this.logger.error(`Error terminating process ${id}: ${error.message}`);
      }
    }

    process.cancel();
    return this.processRepository.save(process);
  }
  
  // Helper to get all active long-running processes
  async getActiveProcesses(): Promise<Process[]> {
    return Array.from(this.activeProcesses.values()).map(p => p.processObj);
  }
}

/**
 * Helper class to clean terminal output
 */
class TerminalOutputCleaner {
  private ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
  private promptRegex = /^.*?[$#>]\s*/gm;
  private controlSequenceRegex = /\[\?[0-9]+[hlm]/g;
  
  /**
   * Clean a single chunk of terminal output (streaming)
   */
  cleanChunk(chunk: string): string {
    // Remove ANSI escape sequences
    let clean = chunk.replace(this.ansiRegex, '');
    
    // Remove other control sequences
    clean = clean.replace(this.controlSequenceRegex, '');
    
    return clean;
  }
  
  /**
   * Get fully cleaned output for the complete buffer
   */
  getCleanOutput(buffer: string, command: string): string {
    // First apply the basic chunk cleaning
    let cleanOutput = this.cleanChunk(buffer);
    
    // Remove shell prompts (username@host:/path$)
    cleanOutput = cleanOutput.replace(this.promptRegex, '');
    
    // Remove the command itself
    const commandRegex = new RegExp(`^\\s*${this.escapeRegExp(command)}\\s*$`, 'm');
    cleanOutput = cleanOutput.replace(commandRegex, '');
    
    // Remove "exit" command if present
    cleanOutput = cleanOutput.replace(/^\s*exit\s*$/gm, '');
    
    // Remove empty lines at the beginning and end
    cleanOutput = cleanOutput.trim();
    
    // Remove common shell initialization messages
    cleanOutput = this.removeCommonShellMessages(cleanOutput);
    
    return cleanOutput;
  }
  
  /**
   * Escape special characters in a string for use in a regular expression
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Remove common shell initialization messages
   */
  private removeCommonShellMessages(output: string): string {
    const commonMessages = [
      // Bash/shell initialization messages
      /To run a command as administrator.*\n/i,
      /See "man sudo_root".*\n/i,
      /bash: \/\.cargo\/env:.*\n/i,
      // Add more patterns as needed
    ];
    
    let cleanOutput = output;
    commonMessages.forEach(pattern => {
      cleanOutput = cleanOutput.replace(pattern, '');
    });
    
    return cleanOutput;
  }
}