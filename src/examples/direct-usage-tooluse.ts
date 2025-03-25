import { AgentSDK } from "../sdk";

async function runStockMarketAgentExample(): Promise<void> {
  // Initialize the SDK
  const sdk = new AgentSDK();

  try {
    // Create a new agent with stock market tool
    console.log("Creating stock market-enabled agent...");
    const agent = await sdk.createAgent({
      name: "Financial Advisor",
      description:
        "An agent that can analyze stock market data and provide insights",
      systemPrompt:
        "You are a helpful financial advisor that can retrieve and analyze stock market data. " +
        "You can perform the following actions using the stockMarket tool:\n" +
        "1. Get current stock prices with 'getPrice'\n" +
        "2. Retrieve historical data with 'getHistory'\n" +
        "3. Perform technical analysis with 'analyze'\n" +
        "4. Generate simple forecasts with 'forecast'\n\n" +
        "When analyzing stocks, consider using multiple indicators to provide a more complete picture. " +
        "Always remind users that forecasts are simplified estimates and should not be used for actual investment decisions. " +
        "Be concise but informative, and explain technical terms when appropriate.",
      tools: [
        "analyzeStock",
        "forecastStock",
        "getStockHistory",
        "getStockPrice",
      ], // Specify the stock market tool
    });

    console.log(`Stock Market Agent created with ID: ${agent.id}`);

    // Process messages sequentially using async/await
    async function processMessage(message: string, conversationId?: string) {
      console.log(`\nUser: ${message}`);
      const response = await agent.ask(message, conversationId);
      console.log("\nAgent response:");
      console.log(`${response.content}`);
      return response;
    }

    // First interaction - get current price
    const firstMessage = "What's the current price of AAPL stock?";
    console.log("\nSending first query:");
    const firstResponse = await processMessage(firstMessage);

    // Get the conversation ID for subsequent messages
    const conversationId = firstResponse.conversationId;

    // Second interaction - get historical data
    const secondMessage =
      "Can you show me the historical data for AAPL for the last 10 days?";
    console.log("\nSending second query:");
    await processMessage(secondMessage, conversationId);

    // Third interaction - perform technical analysis
    const thirdMessage = "Can you analyze AAPL with RSI indicator?";
    console.log("\nSending third query:");
    await processMessage(thirdMessage, conversationId);

    // Fourth interaction - generate forecast
    const fourthMessage =
      "Based on this analysis, can you give me a 5-day forecast for AAPL?";
    console.log("\nSending fourth query:");
    await processMessage(fourthMessage, conversationId);

    // Fifth interaction - compare with another stock
    const fifthMessage =
      "How does AAPL compare to MSFT? Can you analyze both stocks using MACD?";
    console.log("\nSending fifth query:");
    await processMessage(fifthMessage, conversationId);

    // Clean up
    console.log("\nDeleting agent...");
    await sdk.deleteAgent(agent.id);
    console.log("Stock market agent deleted successfully");
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  } finally {
    // Close the SDK
    await sdk.close();
    console.log("SDK closed successfully");
  }
}

// Run the example
runStockMarketAgentExample().catch((error) => {
  console.error("Unhandled error in runStockMarketAgentExample:", error);
});
