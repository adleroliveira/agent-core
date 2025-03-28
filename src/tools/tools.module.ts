import { Module, OnModuleInit, Inject } from "@nestjs/common";
import { AdaptersModule } from "@adapters/adapters.module";
import { CoreModule } from "@core/core.module";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import { TOOL_REGISTRY } from "@core/constants";
import { StockMarketToolBundle } from "./examples/stock-market/StockMarket.toolBundle";
import { GetStockPriceTool } from "./examples/stock-market/GetStockPriceTool.tool";
import { GetStockHistoryTool } from "./examples/stock-market/GetStockHistoryTool.tool";
import { AnalyzeStockTool } from "./examples/stock-market/AnalyzeStockTool.tool";
import { ForecastStockTool } from "./examples/stock-market/ForecastStockTool.tool";
import { RagToolBundle } from "./default/rag.toolBundle";
import { PtyToolBundle } from "./default/pty.toolBundle";
import { ProcessToolBundle } from "./default/process.toolBundle";
import { InternetSearchToolBundle } from "./default/internet-search.toolBundle";

@Module({
  imports: [AdaptersModule, CoreModule],
  providers: [
    StockMarketToolBundle,
    GetStockPriceTool,
    GetStockHistoryTool,
    AnalyzeStockTool,
    ForecastStockTool,
    RagToolBundle,
    PtyToolBundle,
    ProcessToolBundle,
    InternetSearchToolBundle,
  ],
  exports: [StockMarketToolBundle, RagToolBundle, PtyToolBundle, ProcessToolBundle, InternetSearchToolBundle],
})
export class ToolsModule implements OnModuleInit {
  constructor(
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryPort,
    private readonly stockMarketToolBundle: StockMarketToolBundle,
    private readonly ragToolBundle: RagToolBundle,
    private readonly ptyToolBundle: PtyToolBundle,
    private readonly processToolBundle: ProcessToolBundle,
    private readonly internetSearchToolBundle: InternetSearchToolBundle,
  ) {}

  async onModuleInit() {
    // Register stock market tools
    const { tools: stockMarketTools } = this.stockMarketToolBundle.getBundle();
    for (const tool of stockMarketTools) {
      await this.toolRegistry.registerTool(tool);
    }

    // Register RAG tools
    const { tools: ragTools } = this.ragToolBundle.getBundle();
    for (const tool of ragTools) {
      await this.toolRegistry.registerTool(tool);
    }

    // Register PTY tools
    const { tools: ptyTools } = this.ptyToolBundle.getBundle();
    for (const tool of ptyTools) {
      await this.toolRegistry.registerTool(tool);
    }

    // Register Process tools
    const { tools: processTools } = this.processToolBundle.getBundle();
    for (const tool of processTools) {
      await this.toolRegistry.registerTool(tool);
    }

    // Register Internet Search tools
    const { tools: internetSearchTools } = this.internetSearchToolBundle.getBundle();
    for (const tool of internetSearchTools) {
      await this.toolRegistry.registerTool(tool);
    }
  }
}
