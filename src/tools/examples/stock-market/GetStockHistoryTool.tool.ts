import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class GetStockHistoryTool {
  private stockDataCache = new Map<string, any>(); // Shared cache

  getTool(): Tool {
    const parameters: ToolParameter[] = [
      {
        name: "symbol",
        type: "string",
        description: "The stock symbol (e.g., AAPL, MSFT, GOOGL).",
        required: true,
      },
      {
        name: "days",
        type: "number",
        description: "Number of days of historical data to retrieve.",
        required: false,
        default: 30,
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: "getStockHistory",
      description:
        "Retrieve historical price data for a stock symbol over a specified number of days.",
      parameters,
      handler: this.getStockHistoryHandler.bind(this),
    });
  }

  private async getStockHistoryHandler(args: {
    symbol: string;
    days?: number;
  }): Promise<any> {
    const { symbol, days = 30 } = args;
    const normalizedSymbol = symbol.toUpperCase();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate API delay
    return this.getHistoricalData(normalizedSymbol, days);
  }

  private async getHistoricalData(symbol: string, days: number): Promise<any> {
    const cacheKey = `${symbol}_history_${days}`;
    if (this.stockDataCache.has(cacheKey)) {
      return this.stockDataCache.get(cacheKey);
    }

    const basePrice = this.getBasePrice(symbol);
    const today = new Date();
    const data = [];
    let currentPrice = basePrice;
    const volatility = this.getVolatility(symbol);

    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const changePercent = Math.random() * volatility * 2 - volatility;
      currentPrice = currentPrice * (1 + changePercent / 100);
      const open = currentPrice;
      const high = open * (1 + Math.random() * 0.015);
      const low = open * (1 - Math.random() * 0.015);
      const close =
        (open + high + low) / 3 + (Math.random() * 0.01 - 0.005) * open;

      data.push({
        date: date.toISOString().split("T")[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.floor(Math.random() * 10000000) + 1000000,
      });
    }

    const result = { symbol, period: `${days} days`, data };
    this.stockDataCache.set(cacheKey, result);
    return result;
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

  private getVolatility(symbol: string): number {
    // Mock volatility for common stocks (percent)
    const volatility: Record<string, number> = {
      AAPL: 1.2,
      MSFT: 1.1,
      GOOGL: 1.3,
      AMZN: 1.6,
      META: 1.8,
      TSLA: 2.5,
      NVDA: 2.2,
      JPM: 1.0,
      V: 0.9,
      JNJ: 0.8,
    };

    // Return volatility for known symbol or generate a random one
    return symbol in volatility ? volatility[symbol] : 0.8 + Math.random() * 2;
  }
}
