import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './application/agent.service';
import { AdaptersModule, AGENT_SERVICE, PROCESS_REPOSITORY } from '@adapters/adapters.module';
import { ToolRegistryService } from './services/tool-registry.service';
import { TOOL_REGISTRY } from './constants';
import { WorkspaceConfig } from './config/workspace.config';
import { ProcessManagerService } from './application/process-manager.service';

@Module({
  imports: [forwardRef(() => AdaptersModule)],
  providers: [
    {
      provide: AGENT_SERVICE,
      useClass: AgentService,
    },
    {
      provide: TOOL_REGISTRY,
      useClass: ToolRegistryService,
    },
    WorkspaceConfig,
    ProcessManagerService,
  ],
  exports: [AGENT_SERVICE, TOOL_REGISTRY, WorkspaceConfig, ProcessManagerService],
})
export class CoreModule {}