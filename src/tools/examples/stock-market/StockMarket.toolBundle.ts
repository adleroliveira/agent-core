import { Injectable } from "@nestjs/common";
import { Tool } from "@core/domain/tool.entity";
import { GetStockPriceTool } from "./GetStockPriceTool.tool";
import { GetStockHistoryTool } from "./GetStockHistoryTool.tool";
import { AnalyzeStockTool } from "./AnalyzeStockTool.tool";
import { ForecastStockTool } from "./ForecastStockTool.tool";

export interface ToolBundle {
  namespace: string;
  tools: Tool[];
}

@Injectable()
export class StockMarketToolBundle {
  constructor(
    private readonly getStockPriceTool: GetStockPriceTool,
    private readonly getStockHistoryTool: GetStockHistoryTool,
    private readonly analyzeStockTool: AnalyzeStockTool,
    private readonly forecastStockTool: ForecastStockTool
  ) {}

  getBundle(): ToolBundle {
    return {
      namespace: "stockMarket",
      tools: [
        this.getStockPriceTool.getTool(),
        this.getStockHistoryTool.getTool(),
        this.analyzeStockTool.getTool(),
        this.forecastStockTool.getTool(),
      ],
    };
  }
}
