import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class StockMarketTool {
  // Stock data cache to simulate persistence
  private stockDataCache = new Map<string, any>();

  getTool(): Tool {
    const parameters: ToolParameter[] = [
      {
        name: "action",
        type: "string",
        description:
          "The action to perform: 'getPrice', 'getHistory', 'analyze', or 'forecast'",
        required: true,
      },
      {
        name: "symbol",
        type: "string",
        description: "The stock symbol (e.g., AAPL, MSFT, GOOGL)",
        required: true,
      },
      {
        name: "days",
        type: "number",
        description:
          "Number of days of historical data to retrieve (for getHistory)",
        required: false,
        default: 30,
      },
      {
        name: "indicator",
        type: "string",
        description:
          "Technical indicator to calculate (for analyze): 'sma', 'ema', 'rsi', 'macd'",
        required: false,
      },
      {
        name: "period",
        type: "number",
        description: "Period for technical indicators (for analyze)",
        required: false,
        default: 14,
      },
      {
        name: "forecastDays",
        type: "number",
        description: "Number of days to forecast (for forecast)",
        required: false,
        default: 7,
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: "stockMarket",
      description:
        "Get stock market data, perform technical analysis, and generate forecasts",
      parameters,
      handler: this.stockMarketHandler.bind(this),
    });
  }

  private async stockMarketHandler(args: {
    action: string;
    symbol: string;
    days?: number;
    indicator?: string;
    period?: number;
    forecastDays?: number;
  }): Promise<any> {
    const {
      action,
      symbol,
      days = 30,
      indicator,
      period = 14,
      forecastDays = 7,
    } = args;

    // Normalize symbol
    const normalizedSymbol = symbol.toUpperCase();

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    switch (action) {
      case "getPrice":
        return this.getCurrentPrice(normalizedSymbol);
      case "getHistory":
        return this.getHistoricalData(normalizedSymbol, days);
      case "analyze":
        if (!indicator) {
          throw new Error("Indicator parameter is required for analyze action");
        }
        return this.analyzeTechnical(normalizedSymbol, indicator, period);
      case "forecast":
        return this.generateForecast(normalizedSymbol, forecastDays);
      default:
        throw new Error(
          `Invalid action: ${action}. Must be one of: getPrice, getHistory, analyze, forecast`
        );
    }
  }

  private async getCurrentPrice(symbol: string): Promise<any> {
    // Generate a realistic but mock price
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
    // For MACD we need more data points
    const historyDays =
      indicator.toLowerCase() === "macd"
        ? Math.max(60, period * 2)
        : period * 2;

    // First, get historical data
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
        throw new Error(
          `Unsupported indicator: ${indicator}. Supported indicators: sma, ema, rsi, macd`
        );
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

  private async generateForecast(symbol: string, days: number): Promise<any> {
    // Get historical data to base our forecast on
    const historyResult = await this.getHistoricalData(symbol, 30);
    const historicalPrices = historyResult.data.map((d: any) => d.close);

    // Calculate simple trend
    const firstPrice = historicalPrices[0];
    const lastPrice = historicalPrices[historicalPrices.length - 1];
    const avgDailyChange = (lastPrice - firstPrice) / historicalPrices.length;

    // Add some randomness
    const volatility = this.getVolatility(symbol);
    const forecast = [];
    let currentPrice = lastPrice;

    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Skip weekends in forecast
      if (date.getDay() === 0 || date.getDay() === 6) {
        continue;
      }

      // Calculate forecasted price with trend and randomness
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
      disclaimer:
        "This is a simplified forecast based on historical trends and should not be used for actual investment decisions.",
      forecast,
    };
  }

  // Helper Functions

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
}
