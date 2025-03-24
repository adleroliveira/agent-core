import { Module, OnModuleInit, Inject } from "@nestjs/common";
import { AdaptersModule, TOOL_REGISTRY } from "@adapters/adapters.module";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import { ToolRegistryService } from '@adapters/tool/tool-registry.service';

// Default tools
import { StockMarketTool } from "./default/stock-market.tool";

@Module({
  imports: [AdaptersModule],
  providers: [ToolRegistryService, StockMarketTool],
  exports: [ToolRegistryService, StockMarketTool],
})
export class ToolsModule implements OnModuleInit {
  constructor(
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryPort,
    private readonly searchTool: StockMarketTool
  ) { }

  async onModuleInit() {
    // Register default tools
    await this.toolRegistry.registerTool(this.searchTool.getTool());
  }
}
