import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class GetStockPriceTool {
  private stockDataCache = new Map<string, any>(); // Shared cache (could be injected)

  getTool(): Tool {
    const parameters: ToolParameter[] = [
      {
        name: "symbol",
        type: "string",
        description: "The stock symbol (e.g., AAPL, MSFT, GOOGL).",
        required: true,
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: "getStockPrice",
      description:
        "Retrieve the current price and basic data for a stock symbol.",
      parameters,
      handler: this.getStockPriceHandler.bind(this),
    });
  }

  private async getStockPriceHandler(args: { symbol: string }): Promise<any> {
    const { symbol } = args;
    const normalizedSymbol = symbol.toUpperCase();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate API delay
    return this.getCurrentPrice(normalizedSymbol);
  }

  private async getCurrentPrice(symbol: string): Promise<any> {
    const basePrice = this.getBasePrice(symbol);
    const price = basePrice * (1 + (Math.random() * 0.02 - 0.01));
    const previousClose = basePrice * (1 + (Math.random() * 0.02 - 0.01));
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000) + 1000000,
      timestamp: new Date().toISOString(),
    };
  }

  private getBasePrice(symbol: string): number {
    // Mock base prices for common stocks
    const prices: Record<string, number> = {
      AAPL: 175.5,
      MSFT: 380.2,
      GOOGL: 142.75,
      AMZN: 178.25,
      META: 470.3,
      TSLA: 190.6,
      NVDA: 820.4,
      JPM: 190.1,
      V: 275.5,
      JNJ: 152.3,
    };

    // Return price for known symbol or generate a random price
    return symbol in prices ? prices[symbol] : 50 + Math.random() * 200;
  }
}
