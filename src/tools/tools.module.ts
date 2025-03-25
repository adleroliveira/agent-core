import { Module, OnModuleInit, Inject } from "@nestjs/common";
import { AdaptersModule } from "@adapters/adapters.module";
import { CoreModule } from "@core/core.module";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import { TOOL_REGISTRY } from '@core/constants';

// Default tools
import { StockMarketTool } from "./default/stock-market.tool";

@Module({
  imports: [AdaptersModule, CoreModule],
  providers: [StockMarketTool],
  exports: [StockMarketTool],
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
