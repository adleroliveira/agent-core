import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DirectAgentAdapter } from "../adapters/api/direct/direct-agent.adapter";

async function runStockMarketAgentExample() {
  // Bootstrap the application
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Get the direct agent adapter
    const agentAdapter = app.get(DirectAgentAdapter);

    // Create a new agent with stock market tool
    console.log("Creating stock market-enabled agent...");
    const agent = await agentAdapter.createAgent({
      name: "Financial Advisor",
      description:
        "An agent that can analyze stock market data and provide insights",
      systemPromptContent:
        "You are a helpful financial advisor that can retrieve and analyze stock market data. " +
        "You can perform the following actions using the stockMarket tool:\n" +
        "1. Get current stock prices with 'getPrice'\n" +
        "2. Retrieve historical data with 'getHistory'\n" +
        "3. Perform technical analysis with 'analyze'\n" +
        "4. Generate simple forecasts with 'forecast'\n\n" +
        "When analyzing stocks, consider using multiple indicators to provide a more complete picture. " +
        "Always remind users that forecasts are simplified estimates and should not be used for actual investment decisions. " +
        "Be concise but informative, and explain technical terms when appropriate.",
      tools: ["stockMarket"], // Specify the stock market tool
    });

    console.log(`Stock Market Agent created with ID: ${agent.id}`);

    // First interaction - get current price
    const firstMessage = "What's the current price of AAPL stock?";
    console.log("\nSending first query:");
    console.log(`User: ${firstMessage}`);

    const firstResponse = await agentAdapter.sendMessageSync(
      agent.id,
      firstMessage
    );

    console.log("\nAgent response:");
    console.log(`${firstResponse.content}`);

    // Second interaction - get historical data
    const secondMessage =
      "Can you show me the historical data for AAPL for the last 10 days?";
    console.log("\nSending second query:");
    console.log(`User: ${secondMessage}`);

    // Use the same conversation ID from the first response
    const conversationId = firstResponse.conversationId;
    const secondResponse = await agentAdapter.sendMessageSync(
      agent.id,
      secondMessage,
      conversationId
    );

    console.log("\nAgent response:");
    console.log(`${secondResponse.content}`);

    // Third interaction - perform technical analysis
    const thirdMessage = "Can you analyze AAPL with RSI indicator?";
    console.log("\nSending third query:");
    console.log(`User: ${thirdMessage}`);

    const thirdResponse = await agentAdapter.sendMessageSync(
      agent.id,
      thirdMessage,
      conversationId
    );

    console.log("\nAgent response:");
    console.log(`${thirdResponse.content}`);

    // Fourth interaction - generate forecast
    const fourthMessage =
      "Based on this analysis, can you give me a 5-day forecast for AAPL?";
    console.log("\nSending fourth query:");
    console.log(`User: ${fourthMessage}`);

    const fourthResponse = await agentAdapter.sendMessageSync(
      agent.id,
      fourthMessage,
      conversationId
    );

    console.log("\nAgent response:");
    console.log(`${fourthResponse.content}`);

    // Fifth interaction - compare with another stock
    const fifthMessage =
      "How does AAPL compare to MSFT? Can you analyze both stocks using MACD?";
    console.log("\nSending fifth query:");
    console.log(`User: ${fifthMessage}`);

    const fifthResponse = await agentAdapter.sendMessageSync(
      agent.id,
      fifthMessage,
      conversationId
    );

    console.log("\nAgent response:");
    console.log(`${fifthResponse.content}`);

    // Clean up
    console.log("Deleting agent...");
    await agentAdapter.deleteAgent(agent.id);
    console.log("Stock market agent deleted successfully");
  } catch (error) {
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  } finally {
    // Shutdown the application
    await app.close();
  }
}

// Run the example
runStockMarketAgentExample().catch((error) => {
  console.error("Unhandled error in runStockMarketAgentExample:", error);
});
