import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AnalyzeStockTool {
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
        name: "indicator",
        type: "string",
        description: "Technical indicator to calculate (sma, ema, rsi, macd).",
        required: true,
        enum: ["sma", "ema", "rsi", "macd"],
      },
      {
        name: "period",
        type: "number",
        description: "Period for technical indicators.",
        required: false,
        default: 14,
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: "analyzeStock",
      description:
        "Perform technical analysis on a stock using specified indicators.",
      parameters,
      handler: this.analyzeStockHandler.bind(this),
    });
  }

  private async analyzeStockHandler(args: {
    symbol: string;
    indicator: string;
    period?: number;
  }): Promise<any> {
    const { symbol, indicator, period = 14 } = args;
    const normalizedSymbol = symbol.toUpperCase();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate API delay
    return this.analyzeTechnical(normalizedSymbol, indicator, period);
  }

  private calculateSMA(prices: number[], period: number): any {
    const smaValues = [];

    for (let i = period - 1; i < prices.length; i++) {
      const periodPrices = prices.slice(i - period + 1, i + 1);
      const sma = periodPrices.reduce((sum, price) => sum + price, 0) / period;
      smaValues.push({
        value: parseFloat(sma.toFixed(2)),
        date:
          i === prices.length - 1
            ? "current"
            : "previous" + (prices.length - 1 - i),
      });
    }

    const currentValue = smaValues[smaValues.length - 1].value;
    const previousValue = smaValues[smaValues.length - 2].value;
    const lastPrice = prices[prices.length - 1];

    let interpretation = "";
    if (lastPrice > currentValue) {
      interpretation =
        "Price is above SMA, potentially indicating bullish momentum.";
    } else if (lastPrice < currentValue) {
      interpretation =
        "Price is below SMA, potentially indicating bearish momentum.";
    } else {
      interpretation =
        "Price is at the SMA, indicating potential consolidation.";
    }

    return {
      currentValue,
      previousValue,
      interpretation,
      data: smaValues.slice(-5), // Return last 5 values
    };
  }

  private calculateEMA(prices: number[], period: number): any {
    const k = 2 / (period + 1);
    let emaValues = [];

    // Initialize EMA with SMA
    const sma =
      prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    emaValues.push({
      value: parseFloat(sma.toFixed(2)),
      date: `init_${period}`,
    });

    // Calculate EMA for the rest of the data
    let currentEma = sma;
    for (let i = period; i < prices.length; i++) {
      currentEma = (prices[i] - currentEma) * k + currentEma;
      emaValues.push({
        value: parseFloat(currentEma.toFixed(2)),
        date:
          i === prices.length - 1
            ? "current"
            : "previous" + (prices.length - 1 - i),
      });
    }

    const currentValue = emaValues[emaValues.length - 1].value;
    const previousValue = emaValues[emaValues.length - 2].value;
    const trend = currentValue > previousValue ? "upward" : "downward";

    return {
      currentValue,
      previousValue,
      interpretation: `EMA shows a ${trend} trend. EMA reacts faster to price changes than SMA.`,
      data: emaValues.slice(-5), // Return last 5 values
    };
  }

  private calculateRSI(prices: number[], period: number): any {
    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const rsiValues = [];

    // Calculate RSI for each period
    for (let i = period; i <= gains.length; i++) {
      const periodGains = gains.slice(i - period, i);
      const periodLosses = losses.slice(i - period, i);

      const avgGain = periodGains.reduce((sum, gain) => sum + gain, 0) / period;
      const avgLoss =
        periodLosses.reduce((sum, loss) => sum + loss, 0) / period;

      let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      let rsi = 100 - 100 / (1 + rs);

      rsiValues.push({
        value: parseFloat(rsi.toFixed(2)),
        date: i === gains.length ? "current" : "previous" + (gains.length - i),
      });
    }

    const currentValue = rsiValues[rsiValues.length - 1].value;
    const previousValue = rsiValues[rsiValues.length - 2].value;

    let interpretation = "";
    if (currentValue > 70) {
      interpretation = "RSI above 70 suggests the stock is overbought.";
    } else if (currentValue < 30) {
      interpretation = "RSI below 30 suggests the stock is oversold.";
    } else {
      interpretation = "RSI between 30 and 70 suggests neutral momentum.";
    }

    return {
      currentValue,
      previousValue,
      interpretation,
      data: rsiValues.slice(-5), // Return last 5 values
    };
  }

  private calculateMACD(prices: number[]): any {
    // Ensure we have enough data points for calculation
    if (prices.length < 26) {
      // Return a simplified result if not enough data
      return {
        currentValue: 0,
        previousValue: 0,
        interpretation:
          "Insufficient data for MACD calculation. Need at least 26 data points.",
        data: [],
      };
    }

    // MACD uses 12-day and 26-day EMAs, and a 9-day signal line
    const ema12 = this.calculateEMAValues(prices, 12);
    const ema26 = this.calculateEMAValues(prices, 26);

    // Calculate MACD line (12-day EMA - 26-day EMA)
    const macdLine = [];
    for (let i = 0; i < ema26.length; i++) {
      // Make sure we don't go out of bounds for ema12
      if (i + 14 < ema12.length) {
        macdLine.push(ema12[i + 14] - ema26[i]);
      }
    }

    // Make sure we have enough data for signal line
    if (macdLine.length < 9) {
      return {
        currentValue: macdLine.length > 0 ? macdLine[macdLine.length - 1] : 0,
        previousValue: macdLine.length > 1 ? macdLine[macdLine.length - 2] : 0,
        interpretation: "Insufficient data points for complete MACD analysis.",
        data: [
          {
            macd:
              macdLine.length > 0
                ? parseFloat(macdLine[macdLine.length - 1].toFixed(2))
                : 0,
            signal: 0,
            histogram: 0,
            date: "current",
          },
        ],
      };
    }

    // Calculate 9-day EMA of the MACD line (signal line)
    const signalLine = this.calculateEMAValues(macdLine, 9);

    // Calculate MACD histogram (MACD line - signal line)
    const histogram = [];
    for (let i = 0; i < signalLine.length; i++) {
      // Make sure we don't go out of bounds for macdLine
      if (i + 8 < macdLine.length) {
        histogram.push(
          parseFloat((macdLine[i + 8] - signalLine[i]).toFixed(2))
        );
      }
    }

    // Prepare the latest values (up to 5)
    const latestValues = [];
    const numValues = Math.min(5, histogram.length);

    for (let i = 0; i < numValues; i++) {
      const index = histogram.length - numValues + i;
      latestValues.push({
        macd: parseFloat(macdLine[index + 8].toFixed(2)),
        signal: parseFloat(signalLine[index].toFixed(2)),
        histogram: histogram[index],
        date:
          i === numValues - 1 ? "current" : "previous" + (numValues - 1 - i),
      });
    }

    // Safety check before accessing values
    if (latestValues.length < 2) {
      return {
        currentValue: latestValues.length > 0 ? latestValues[0].macd : 0,
        previousValue: 0,
        interpretation: "Insufficient data for complete MACD analysis.",
        data: latestValues,
      };
    }

    const currentMacd = latestValues[latestValues.length - 1].macd;
    const currentSignal = latestValues[latestValues.length - 1].signal;
    const previousMacd = latestValues[latestValues.length - 2].macd;
    const previousSignal = latestValues[latestValues.length - 2].signal;

    let interpretation = "";
    if (currentMacd > currentSignal && previousMacd <= previousSignal) {
      interpretation =
        "Bullish crossover detected. MACD line crossed above the signal line.";
    } else if (currentMacd < currentSignal && previousMacd >= previousSignal) {
      interpretation =
        "Bearish crossover detected. MACD line crossed below the signal line.";
    } else if (currentMacd > currentSignal) {
      interpretation =
        "MACD line is above the signal line, indicating bullish momentum.";
    } else {
      interpretation =
        "MACD line is below the signal line, indicating bearish momentum.";
    }

    return {
      currentValue: currentMacd,
      previousValue: previousMacd,
      interpretation,
      data: latestValues,
    };
  }

  private calculateEMAValues(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaValues = [];

    // Initialize EMA with SMA
    const sma =
      prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    emaValues.push(sma);

    // Calculate EMA for the rest of the data
    let currentEma = sma;
    for (let i = period; i < prices.length; i++) {
      currentEma = (prices[i] - currentEma) * k + currentEma;
      emaValues.push(currentEma);
    }

    return emaValues;
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

  private async analyzeTechnical(
    symbol: string,
    indicator: string,
    period: number
  ): Promise<any> {
    const historyDays =
      indicator.toLowerCase() === "macd"
        ? Math.max(60, period * 2)
        : period * 2;
    const historyResult = await this.getHistoricalData(symbol, historyDays);
    const prices = historyResult.data.map((d: any) => d.close);

    let result;
    switch (indicator.toLowerCase()) {
      case "sma":
        result = this.calculateSMA(prices, period);
        break;
      case "ema":
        result = this.calculateEMA(prices, period);
        break;
      case "rsi":
        result = this.calculateRSI(prices, period);
        break;
      case "macd":
        result = this.calculateMACD(prices);
        break;
      default:
        throw new Error(`Unsupported indicator: ${indicator}`);
    }

    return {
      symbol,
      indicator: indicator.toUpperCase(),
      period,
      currentValue: result.currentValue,
      previousValue: result.previousValue,
      interpretation: result.interpretation,
      data: result.data,
    };
  }

  // Include getHistoricalData, getBasePrice, getVolatility, calculateSMA, calculateEMA, calculateRSI, calculateMACD
  // (These can be moved to a shared service or utility class)
}
