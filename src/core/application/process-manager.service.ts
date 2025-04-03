import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { Process } from '@core/domain/process.entity';
import { ProcessRepositoryPort } from '@ports/storage/process-repository.port';
import { WorkspaceConfig } from '@core/config/workspace.config';
import { PROCESS_REPOSITORY } from '@adapters/adapters.module';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds default timeout
  private shellCommand: string;
  private shellArgs: string[];
  private activeProcesses: Map<string, { childProcess: ChildProcess; processObj: Process }> = new Map();

  constructor(
    @Inject(forwardRef(() => PROCESS_REPOSITORY))
    private readonly processRepository: ProcessRepositoryPort,
    private readonly workspaceConfig: WorkspaceConfig
  ) {
    // Improved shell detection from CommandTool
    if (os.platform() === 'win32') {
      this.shellCommand = 'powershell.exe';
      this.shellArgs = ['-Command'];
    } else {
      try {
        require('child_process').execSync('which bash', { stdio: 'ignore' });
        this.shellCommand = 'bash';
        this.shellArgs = ['-c'];
      } catch (e) {
        this.shellCommand = 'sh';
        this.shellArgs = ['-c'];
      }
    }
  }

  async startProcess(
    name: string,
    command: string,
    metadata?: Record<string, any>,
    env?: Record<string, string>,
    timeout?: number // Already optional in the signature
  ): Promise<Process> {
    const process = new Process({
      name,
      command,
      metadata: {
        ...metadata,
        timeout // Will be undefined if not provided
      },
      env
    });

    const savedProcess = await this.processRepository.save(process);

    this.executeProcess(savedProcess).catch(async error => {
      this.logger.error(`Process execution failed: ${error.message}`);
      savedProcess.fail(error.message);
      await this.processRepository.save(savedProcess);
    });

    return savedProcess;
  }

  private async executeProcess(process: Process): Promise<void> {
    const workspacePath = this.workspaceConfig.getWorkspacePath();
    if (!workspacePath) {
      throw new Error('Workspace path is not configured');
    }

    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
      this.logger.log(`Created workspace directory: ${workspacePath}`);
    }

    // Determine working directory with security checks
    let cwd = workspacePath;
    if (process.metadata?.workingDirectory) {
      const normalizedCwd = path.normalize(process.metadata.workingDirectory);
      const relativePath = normalizedCwd.startsWith(path.sep) ? normalizedCwd.slice(1) : normalizedCwd;
      cwd = path.resolve(workspacePath, relativePath);

      if (!cwd.startsWith(workspacePath)) {
        throw new Error(`Working directory "${cwd}" is outside workspace "${workspacePath}"`);
      }

      if (!fs.existsSync(cwd)) {
        fs.mkdirSync(cwd, { recursive: true });
        this.logger.log(`Created working directory: ${cwd}`);
      }
    }

    process.start();
    await this.processRepository.save(process);

    // Prepare command execution
    let cmdArgs;
    if ((this.shellCommand === 'bash' || this.shellCommand === 'sh') && this.shellArgs[0] === '-c') {
      cmdArgs = ['-c', process.command];
    } else if (this.shellCommand === 'powershell.exe' && this.shellArgs[0] === '-Command') {
      cmdArgs = ['-Command', process.command];
    } else {
      cmdArgs = this.shellArgs.concat(process.command);
    }

    const childProcess = spawn(this.shellCommand, cmdArgs, {
      cwd,
      env: {
        ...process.env,
        ...process.env,
        TERM: 'dumb',
        FORCE_COLOR: '0',
        NO_COLOR: '1'
      },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (childProcess.stdin) {
      childProcess.stdin.end();
    }

    if (process.isLongRunning()) {
      this.activeProcesses.set(process.id, { childProcess, processObj: process });
    }

    let outputBuffer = '';
    let errorBuffer = '';
    let lastSaveTime = Date.now();
    const SAVE_INTERVAL = 5000;
    let isResolved = false;

    // Setup timeout
    const timeout = process.metadata?.timeout;
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeout !== undefined && timeout !== null) {
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          childProcess.kill('SIGTERM');
          this.activeProcesses.delete(process.id);
          process.fail(`Process timed out after ${timeout}ms`);
          this.processRepository.save(process);
        }
      }, timeout);
    }

    return new Promise((resolve, reject) => {
      childProcess.stdout?.on('data', (data) => {
        const chunk = this.cleanOutput(data.toString());
        outputBuffer += chunk;

        if (process.isLongRunning() && Date.now() - lastSaveTime > SAVE_INTERVAL) {
          process.updateOutput(outputBuffer);
          this.processRepository.save(process).catch(error => {
            this.logger.error(`Failed to update process output: ${error.message}`);
          });
          lastSaveTime = Date.now();
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const chunk = this.cleanOutput(data.toString());
        errorBuffer += chunk;
      });

      childProcess.on('exit', async (code, signal) => {
        if (!isResolved) {
          if (timeoutId) clearTimeout(timeoutId);
          isResolved = true;
          this.activeProcesses.delete(process.id);

          const finalOutput = this.cleanOutput(outputBuffer + (errorBuffer ? '\n' + errorBuffer : ''));
          const exitCode = code !== null ? code : (signal ? 1 : 0);

          if (exitCode === 0) {
            process.complete(finalOutput, exitCode);
          } else {
            process.fail(finalOutput, exitCode);
          }

          await this.processRepository.save(process);
          resolve();
        }
      });

      childProcess.on('error', async (error) => {
        if (!isResolved) {
          if (timeoutId) clearTimeout(timeoutId);
          isResolved = true;
          this.activeProcesses.delete(process.id);
          process.fail(error.message);
          await this.processRepository.save(process);
          reject(error);
        }
      });
    });
  }

  private cleanOutput(output: string): string {
    return output.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '').trim();
  }

  async getProcessStatus(id: string): Promise<Process | null> {
    return this.processRepository.findById(id);
  }

  async cancelProcess(id: string): Promise<Process | null> {
    const process = await this.processRepository.findById(id);
    if (!process) return null;

    const activeProcess = this.activeProcesses.get(id);
    if (activeProcess) {
      try {
        if (!activeProcess.childProcess.killed) {
          activeProcess.childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!activeProcess.childProcess.killed) {
              activeProcess.childProcess.kill('SIGKILL');
            }
          }, 500);
        }
        this.activeProcesses.delete(id);
      } catch (error) {
        this.logger.error(`Error terminating process ${id}: ${error.message}`);
      }
    }

    process.cancel();
    return this.processRepository.save(process);
  }

  async getActiveProcesses(): Promise<Process[]> {
    return Array.from(this.activeProcesses.values()).map(p => p.processObj);
  }
}