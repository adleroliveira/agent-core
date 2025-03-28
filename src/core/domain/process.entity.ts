import { v4 as uuidv4 } from 'uuid';

export enum ProcessStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export class Process {
  public readonly id: string;
  public name: string;
  public command: string;
  public status: ProcessStatus;
  public output: string;
  public error?: string;
  public exitCode?: number;
  public startedAt?: Date;
  public completedAt?: Date;
  public metadata: Record<string, any>;
  public env: Record<string, string>;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: {
    id?: string;
    name: string;
    command: string;
    status?: ProcessStatus;
    output?: string;
    error?: string;
    exitCode?: number;
    startedAt?: Date;
    completedAt?: Date;
    metadata?: Record<string, any>;
    env?: Record<string, string>;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id || uuidv4();
    this.name = props.name;
    this.command = props.command;
    this.status = props.status || ProcessStatus.PENDING;
    this.output = props.output || '';
    this.error = props.error;
    this.exitCode = props.exitCode;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.metadata = props.metadata || {};
    this.env = props.env || {};
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  public start(): void {
    this.status = ProcessStatus.RUNNING;
    this.startedAt = new Date();
    this.updatedAt = new Date();
  }

  public complete(output: string, exitCode: number): void {
    this.status = ProcessStatus.COMPLETED;
    this.output = output;
    this.exitCode = exitCode;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  public fail(error: string, exitCode?: number): void {
    this.status = ProcessStatus.FAILED;
    this.error = error;
    this.exitCode = exitCode;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  public cancel(): void {
    this.status = ProcessStatus.CANCELLED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  // New method to update the output without changing the process status
  public updateOutput(output: string): void {
    this.output = output;
    this.updatedAt = new Date();
  }

  // New method to check if this is a long-running process
  public isLongRunning(): boolean {
    // Check if the command contains indicators of long-running processes
    // This is a simple heuristic; you may want to make this more sophisticated
    const longRunningPatterns = [
      'server', 'serve', 'start', 'listen', 'watch', 'dev',
      '--daemon', '-d', 'run', 'nodemon', 'pm2'
    ];
    
    // Check if the process is explicitly marked as long-running in metadata
    if (this.metadata.isLongRunning === true) {
      return true;
    }
    
    // Check if the command matches any long-running patterns
    return longRunningPatterns.some(pattern => 
      this.command.toLowerCase().includes(pattern)
    );
  }
}