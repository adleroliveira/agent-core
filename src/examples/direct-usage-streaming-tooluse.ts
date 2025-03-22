import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DirectAgentAdapter } from "../adapters/api/direct/direct-agent.adapter";
import { Agent } from "@core/domain/agent.entity";
import { Subscription } from "rxjs";

async function runStockMarketAgentStreamingExample() {
  // Bootstrap the application
  const app = await NestFactory.createApplicationContext(AppModule);
  let agent: Agent | null = null;
  let conversationId: string | null = null;
  let agentAdapter: DirectAgentAdapter | null = null;
  // Track all subscriptions to ensure proper cleanup
  const subscriptions: Subscription[] = [];

  try {
    // Get the direct agent adapter
    agentAdapter = app.get(DirectAgentAdapter);

    // Create a new agent with stock market tool
    console.log("Creating stock market-enabled agent...");
    agent = await agentAdapter!.createAgent({
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

    // Helper function to process streaming messages
    async function processStreamingMessage(
      message: string,
      useConversationId?: string
    ) {
      console.log(`\nUser: ${message}`);

      let fullContent = "";

      const streamingObservablePromise = agentAdapter!.sendMessageStream(
        agent!.id,
        message,
        useConversationId
      );

      const streamingObservable = await streamingObservablePromise;

      return new Promise<string>((resolve, reject) => {
        const subscription = streamingObservable.subscribe({
          next: (chunk) => {
            if (chunk.content) {
              const contentStr =
                typeof chunk.content === "string"
                  ? chunk.content
                  : JSON.stringify(chunk.content);
              process.stdout.write(contentStr);
              fullContent += contentStr;
            }

            // Check for tool calls in the chunk
            if (chunk.toolCalls && chunk.toolCalls.length > 0) {
              console.log("\n\nTool calls detected:");
              chunk.toolCalls.forEach((call) => {
                console.log(
                  `- Tool: ${call.name}, Arguments: ${call.arguments}`
                );
              });
            }

            // Store conversation ID if we get it
            if (chunk.conversationId && !conversationId) {
              conversationId = chunk.conversationId;
            }
          },
          error: (error) => {
            console.error("\nStreaming error:", error);
            subscription.unsubscribe();
            subscriptions.splice(subscriptions.indexOf(subscription), 1);
            reject(error);
          },
          complete: () => {
            console.log("\n\nStreaming completed.");
            subscription.unsubscribe();
            subscriptions.splice(subscriptions.indexOf(subscription), 1);
            resolve(fullContent);
          },
        });

        // Add subscription to tracking array
        subscriptions.push(subscription);
      });
    }

    // Process messages sequentially
    await processStreamingMessage("What's the current price of AAPL stock?");
    await processStreamingMessage(
      "Can you show me the historical data for AAPL for the last 10 days?",
      conversationId!
    );
    await processStreamingMessage(
      "Can you analyze AAPL with RSI indicator?",
      conversationId!
    );
    await processStreamingMessage(
      "Based on this analysis, can you give me a 5-day forecast for AAPL?",
      conversationId!
    );
    await processStreamingMessage(
      "How does AAPL compare to MSFT? Can you analyze both stocks using MACD?",
      conversationId!
    );

    console.log("All messages processed successfully");
  } catch (error) {
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  } finally {
    // Clean up all remaining subscriptions
    if (subscriptions.length > 0) {
      console.log(
        `Cleaning up ${subscriptions.length} remaining subscriptions...`
      );
      subscriptions.forEach((sub) => {
        if (!sub.closed) {
          sub.unsubscribe();
        }
      });
    }

    // Delete the agent if it was created
    if (agent && agentAdapter) {
      try {
        console.log("Deleting agent...");
        await agentAdapter.deleteAgent(agent.id);
        console.log("Stock market agent deleted successfully");
      } catch (deleteError) {
        console.error("Error deleting agent:", deleteError.message);
      }
    }

    // Shutdown the application
    try {
      await app.close();
      console.log("Application closed successfully");
    } catch (closeError) {
      console.error("Error closing application:", closeError.message);
    }

    // Force exit after a short delay to ensure all resources are released
    console.log("Forcing process exit in 500ms...");
    setTimeout(() => {
      process.exit(0);
    }, 500);
  }
}

// Run the example
runStockMarketAgentStreamingExample().catch((error) => {
  console.error(
    "Unhandled error in runStockMarketAgentStreamingExample:",
    error
  );
  process.exit(1); // Exit with error code on unhandled errors
});
