import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './application/agent.service';
import { AdaptersModule } from '@adapters/adapters.module';

@Module({
  imports: [forwardRef(() => AdaptersModule)],
  providers: [AgentService],
  exports: [AgentService],
})
export class CoreModule {}