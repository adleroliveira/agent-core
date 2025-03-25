import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './application/agent.service';
import { AdaptersModule } from '@adapters/adapters.module';
import { ToolRegistryService } from './services/tool-registry.service';
import { TOOL_REGISTRY } from './constants';

@Module({
  imports: [forwardRef(() => AdaptersModule)],
  providers: [
    AgentService,
    {
      provide: TOOL_REGISTRY,
      useClass: ToolRegistryService,
    },
  ],
  exports: [AgentService, TOOL_REGISTRY],
})
export class CoreModule {}