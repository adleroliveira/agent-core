import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './application/agent.service';
import { AdaptersModule } from '@adapters/adapters.module';
import { ToolRegistryService } from './services/tool-registry.service';
import { TOOL_REGISTRY } from './constants';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { MODEL_SERVICE, VECTOR_DB } from '@adapters/adapters.module';

@Module({
  imports: [forwardRef(() => AdaptersModule)],
  providers: [
    AgentService,
    {
      provide: KnowledgeBaseService,
      useFactory: (modelService, vectorDB) => {
        return new KnowledgeBaseService({
          modelService,
          vectorDB,
        });
      },
      inject: [MODEL_SERVICE, VECTOR_DB],
    },
    {
      provide: TOOL_REGISTRY,
      useClass: ToolRegistryService,
    },
  ],
  exports: [AgentService, TOOL_REGISTRY, KnowledgeBaseService],
})
export class CoreModule {}