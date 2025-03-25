import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class ForecastStockTool {
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
        name: "forecastDays",
        type: "number",
        description: "Number of days to forecast.",
        required: false,
        default: 7,
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: "forecastStock",
      description:
        "Generate a price forecast for a stock based on historical trends.",
      parameters,
      handler: this.forecastStockHandler.bind(this),
    });
  }

  private async forecastStockHandler(args: {
    symbol: string;
    forecastDays?: number;
  }): Promise<any> {
    const { symbol, forecastDays = 7 } = args;
    const normalizedSymbol = symbol.toUpperCase();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate API delay
    return this.generateForecast(normalizedSymbol, forecastDays);
  }

  private async generateForecast(symbol: string, days: number): Promise<any> {
    const historyResult = await this.getHistoricalData(symbol, 30);
    const historicalPrices = historyResult.data.map((d: any) => d.close);
    const firstPrice = historicalPrices[0];
    const lastPrice = historicalPrices[historicalPrices.length - 1];
    const avgDailyChange = (lastPrice - firstPrice) / historicalPrices.length;

    const volatility = this.getVolatility(symbol);
    const forecast = [];
    let currentPrice = lastPrice;
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const randomFactor = Math.random() * volatility * 2 - volatility;
      currentPrice =
        currentPrice + avgDailyChange + (currentPrice * randomFactor) / 100;

      forecast.push({
        date: date.toISOString().split("T")[0],
        price: parseFloat(currentPrice.toFixed(2)),
        confidence: parseFloat((95 - i * 5).toFixed(1)),
      });
    }

    return {
      symbol,
      forecastDays: days,
      lastActualPrice: lastPrice,
      avgDailyChange: parseFloat(avgDailyChange.toFixed(2)),
      forecastedChange: parseFloat(
        (forecast[forecast.length - 1].price - lastPrice).toFixed(2)
      ),
      forecastedChangePercent: parseFloat(
        (
          ((forecast[forecast.length - 1].price - lastPrice) / lastPrice) *
          100
        ).toFixed(2)
      ),
      disclaimer: "This is a simplified forecast based on historical trends.",
      forecast,
    };
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

  private async getHistoricalData(symbol: string, days: number): Promise<any> {
    // Check cache first
    const cacheKey = `${symbol}_history_${days}`;
    if (this.stockDataCache.has(cacheKey)) {
      return this.stockDataCache.get(cacheKey);
    }

    // Generate realistic historical data
    const basePrice = this.getBasePrice(symbol);
    const today = new Date();
    const data = [];

    let currentPrice = basePrice;
    const volatility = this.getVolatility(symbol);

    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) {
        continue;
      }

      // Generate daily price movement
      const changePercent = Math.random() * volatility * 2 - volatility;
      currentPrice = currentPrice * (1 + changePercent / 100);

      // Generate OHLC data
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

    const result = {
      symbol,
      period: `${days} days`,
      data,
    };

    // Cache the result
    this.stockDataCache.set(cacheKey, result);
    return result;
  }
}
