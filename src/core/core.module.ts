import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './application/agent.service';
import { AdaptersModule, AGENT_SERVICE } from '@adapters/adapters.module';
import { ToolRegistryService } from './services/tool-registry.service';
import { TOOL_REGISTRY } from './constants';
import { WorkspaceConfig } from './config/workspace.config';

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
  ],
  exports: [AGENT_SERVICE, TOOL_REGISTRY, WorkspaceConfig],
})
export class CoreModule {}