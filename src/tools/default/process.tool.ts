import { Tool, ToolParameter } from '@core/domain/tool.entity';
import { ProcessManagerService } from '@core/application/process-manager.service';
import { v4 as uuidv4 } from 'uuid';
import { Inject } from '@nestjs/common';

export class ProcessTool extends Tool {
  constructor(
    @Inject(ProcessManagerService)
    private readonly processManager: ProcessManagerService
  ) {
    const parameters: ToolParameter[] = [
      {
        name: 'action',
        type: 'string',
        description: 'The action to perform (start, status, cancel)',
        required: true,
        enum: ['start', 'status', 'cancel']
      },
      {
        name: 'name',
        type: 'string',
        description: 'Name of the process (will be auto-generated if not provided)',
        required: false
      },
      {
        name: 'command',
        type: 'string',
        description: 'The command to execute (required for start action)',
        required: false
      },
      {
        name: 'id',
        type: 'string',
        description: 'ID of the process to check or cancel (required for status and cancel actions)',
        required: false
      },
      {
        name: 'env',
        type: 'object',
        description: 'Environment variables to set for the process',
        required: false
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Timeout in milliseconds for the process (optional, if not set, process runs until cancelled)',
        required: false
      }
    ];

    super({
      id: 'process-manager',
      name: 'process_manager',
      description: `Manages long-running processes in the background.`,
      directive: `Manages long-running processes in the background. Use this tool when you need to:
- Start and monitor background services (e.g., development servers, databases)
- Run time-consuming operations that shouldn't block the conversation (e.g., npm install, build processes)
- Execute commands that need to maintain state or run continuously
- Manage multiple concurrent processes with proper lifecycle control

The tool provides process lifecycle management (start/status/cancel) and environment configuration capabilities.
For long-running processes like servers, omit the timeout parameter to let them run indefinitely until cancelled.`,
      parameters,
      handler: async (args: Record<string, any>) => {
        return this.handleProcessCommand(args);
      }
    });
  }

  private async handleProcessCommand(args: Record<string, any>): Promise<any> {
    if (!args.action) {
      throw new Error('Action parameter is required. Must be one of: start, status, cancel');
    }

    if (!['start', 'status', 'cancel'].includes(args.action)) {
      throw new Error(`Invalid action: "${args.action}". Must be one of: start, status, cancel`);
    }

    switch (args.action) {
      case 'start':
        if (!args.command) {
          throw new Error('Command is required for starting a process');
        }
        const processName = args.name || `process-${uuidv4().slice(0, 8)}`;
        return this.processManager.startProcess(
          processName,
          args.command,
          { env: args.env }, // Pass env as metadata
          args.env,
          args.timeout // Pass optional timeout
        );

      case 'status':
        if (!args.id) {
          throw new Error('Process ID is required for checking status');
        }
        return this.processManager.getProcessStatus(args.id);

      case 'cancel':
        if (!args.id) {
          throw new Error('Process ID is required for cancelling a process');
        }
        return this.processManager.cancelProcess(args.id);

      default:
        throw new Error(`Unknown action: ${args.action}`);
    }
  }
}