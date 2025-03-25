import { AgentSDK } from "../sdk";
import { Agent } from "../sdk/agent";

async function runStockMarketAgentStreamingExample(): Promise<void> {
  // Initialize the SDK
  const sdk = new AgentSDK();
  let agent: Agent | null = null;

  try {
    // Create a new agent with stock market tool
    console.log("Creating stock market-enabled agent...");
    agent = await sdk.createAgent({
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

    // First message - get current price
    const firstMessage = "What's the current price of AAPL stock?";
    console.log("\nSending first query:");
    console.log(`User: ${firstMessage}`);

    const firstResponse = await processStreamingMessage(agent, firstMessage);
    console.log("\nFirst response completed. Length:", firstResponse.length);

    // Second message - get historical data
    const secondMessage =
      "Can you show me the historical data for AAPL for the last 10 days?";
    console.log("\nSending second query:");
    console.log(`User: ${secondMessage}`);

    const secondResponse = await processStreamingMessage(agent, secondMessage);
    console.log("\nSecond response completed. Length:", secondResponse.length);

    // Third message - perform technical analysis
    const thirdMessage = "Can you analyze AAPL with RSI indicator?";
    console.log("\nSending third query:");
    console.log(`User: ${thirdMessage}`);

    const thirdResponse = await processStreamingMessage(agent, thirdMessage);
    console.log("\nThird response completed. Length:", thirdResponse.length);

    // Fourth message - generate forecast
    const fourthMessage =
      "Based on this analysis, can you give me a 5-day forecast for AAPL?";
    console.log("\nSending fourth query:");
    console.log(`User: ${fourthMessage}`);

    const fourthResponse = await processStreamingMessage(agent, fourthMessage);
    console.log("\nFourth response completed. Length:", fourthResponse.length);

    // Fifth message - compare with another stock
    const fifthMessage =
      "How does AAPL compare to MSFT? Can you analyze both stocks using MACD?";
    console.log("\nSending fifth query:");
    console.log(`User: ${fifthMessage}`);

    const fifthResponse = await processStreamingMessage(agent, fifthMessage);
    console.log("\nFifth response completed. Length:", fifthResponse.length);
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  } finally {
    // Clean up resources
    if (agent) {
      console.log("\nDeleting agent...");
      await sdk.deleteAgent(agent.id);
      console.log("Agent deleted successfully");
    }

    // Close the SDK
    await sdk.close();
    console.log("SDK closed successfully");
  }
}

// Helper function to process streaming messages and return a Promise
function processStreamingMessage(
  agent: Agent,
  message: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    let fullContent = "";

    agent.askStream(message, {
      onChunk: (chunk: string) => {
        process.stdout.write(chunk);
        fullContent += chunk;
      },
      onToolCall: (toolCall: {
        name: string;
        arguments: Record<string, any>;
      }) => {
        console.log("\n\nTool call detected:");
        console.log(
          `- Tool: ${toolCall.name}, Arguments: ${JSON.stringify(
            toolCall.arguments
          )}`
        );
      },
      onComplete: () => {
        resolve(fullContent);
      },
      onError: (error: Error) => {
        console.error("\nStreaming error:", error);
        reject(error);
      },
    });
  });
}

// Run the example
runStockMarketAgentStreamingExample().catch((error: unknown) => {
  console.error(
    "Unhandled error in runStockMarketAgentStreamingExample:",
    error
  );
});
