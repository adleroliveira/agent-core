import { Module, OnModuleInit, Inject } from "@nestjs/common";
import { AdaptersModule } from "@adapters/adapters.module";
import { CoreModule } from "@core/core.module";
import { GetStockPriceTool } from "./examples/stock-market/GetStockPriceTool.tool";
import { GetStockHistoryTool } from "./examples/stock-market/GetStockHistoryTool.tool";
import { AnalyzeStockTool } from "./examples/stock-market/AnalyzeStockTool.tool";
import { ForecastStockTool } from "./examples/stock-market/ForecastStockTool.tool";
import { KnowledgeAddTool } from "./default/knowledge-add.tool";
import { KnowledgeSearchTool } from "./default/knowledge-search.tool";
import { InternetSearchTool } from "./default/internet-search.tool";
import { CommandTool } from "./default/exec.tool";
import { ProcessTool } from "./default/process.tool";
import { MemoryManagerTool } from "./default/memory-manager.tool";
import { TOOL_REGISTRY } from "@core/constants";
import { ToolRegistryPort } from "@ports/tool/tool-registry.port";
import { Tool } from "@core/domain/tool.entity";

@Module({
  imports: [AdaptersModule, CoreModule],
  providers: [
    // Stock market tools
    GetStockPriceTool,
    GetStockHistoryTool,
    AnalyzeStockTool,
    ForecastStockTool,
    // Default tools
    KnowledgeAddTool,
    KnowledgeSearchTool,
    InternetSearchTool,
    CommandTool,
    ProcessTool,
    MemoryManagerTool,
  ],
  exports: [
    // Stock market tools
    GetStockPriceTool,
    GetStockHistoryTool,
    AnalyzeStockTool,
    ForecastStockTool,
    // Default tools
    KnowledgeAddTool,
    KnowledgeSearchTool,
    InternetSearchTool,
    CommandTool,
    ProcessTool,
    MemoryManagerTool,
  ],
})
export class ToolsModule implements OnModuleInit {
  constructor(
    @Inject(TOOL_REGISTRY)
    private readonly toolRegistry: ToolRegistryPort,
    private readonly getStockPriceTool: GetStockPriceTool,
    private readonly getStockHistoryTool: GetStockHistoryTool,
    private readonly analyzeStockTool: AnalyzeStockTool,
    private readonly forecastStockTool: ForecastStockTool,
    private readonly knowledgeAddTool: KnowledgeAddTool,
    private readonly knowledgeSearchTool: KnowledgeSearchTool,
    private readonly internetSearchTool: InternetSearchTool,
    private readonly commandTool: CommandTool,
    private readonly processTool: ProcessTool,
    private readonly memoryManagerTool: MemoryManagerTool,
  ) { }

  async onModuleInit() {
    // Register stock market tools (using getTool())
    // await this.toolRegistry.registerTool(this.getStockPriceTool.getTool());
    // await this.toolRegistry.registerTool(this.getStockHistoryTool.getTool());
    // await this.toolRegistry.registerTool(this.analyzeStockTool.getTool());
    // await this.toolRegistry.registerTool(this.forecastStockTool.getTool());

    // Register tools with getTool() method
    await this.toolRegistry.registerTool(this.internetSearchTool.getTool());
    await this.toolRegistry.registerTool(this.memoryManagerTool.getTool());

    // Register default tools (they extend Tool directly)
    await this.toolRegistry.registerTool(this.knowledgeAddTool as unknown as Tool);
    await this.toolRegistry.registerTool(this.knowledgeSearchTool as unknown as Tool);
    await this.toolRegistry.registerTool(this.commandTool as unknown as Tool);
    await this.toolRegistry.registerTool(this.processTool as unknown as Tool);
  }
}
