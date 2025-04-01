import { Module } from "@nestjs/common";
import { AdaptersModule } from "@adapters/adapters.module";
import { CoreModule } from "@core/core.module";
import { GetStockPriceTool } from "./examples/stock-market/GetStockPriceTool.tool";
import { GetStockHistoryTool } from "./examples/stock-market/GetStockHistoryTool.tool";
import { AnalyzeStockTool } from "./examples/stock-market/AnalyzeStockTool.tool";
import { ForecastStockTool } from "./examples/stock-market/ForecastStockTool.tool";
import { KnowledgeAddTool } from "./default/knowledge-add.tool";
import { KnowledgeSearchTool } from "./default/knowledge-search.tool";
import { InternetSearchTool } from "./default/internet-search.tool";
import { PtyTool } from "./default/pty.tool";
import { ProcessTool } from "./default/process.tool";

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
    PtyTool,
    ProcessTool,
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
    PtyTool,
    ProcessTool,
  ],
})
export class ToolsModule {}
