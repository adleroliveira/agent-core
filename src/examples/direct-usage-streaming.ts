import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DirectAgentAdapter } from "../adapters/api/direct/direct-agent.adapter";
import { Agent } from "@core/domain/agent.entity";

async function runStreamingExample() {
  const app = await NestFactory.createApplicationContext(AppModule);
  let agent: Agent | null = null;

  try {
    const agentAdapter = app.get(DirectAgentAdapter);

    agent = await agentAdapter.createAgent({
      name: "Streaming Agent",
      description: "An agent for testing streaming responses",
      systemPromptContent:
        "You are a helpful AI assistant that provides detailed, thoughtful responses. When asked a complex question, break down your answer into clear sections.",
      // No tools specified
    });

    const firstMessage = "Explain how neural networks work in detail.";
    console.log("\nSending first streaming message:");
    console.log(`User: ${firstMessage}`);

    let fullContent = "";

    const streamingObservablePromise = agentAdapter.sendMessageStream(
      agent.id,
      firstMessage
    );

    const streamingObservable = await streamingObservablePromise;

    // Create a promise that will resolve when all streams are complete
    return new Promise((resolve, reject) => {
      // Subscribe to the streaming response
      const subscription = streamingObservable.subscribe({
        next: (chunk) => {
          // Print each chunk as it arrives
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
              console.log(`- Tool: ${call.name}, Arguments: ${call.arguments}`);
            });
          }
        },
        error: (error) => {
          console.error("\nStreaming error:", error);
          subscription.unsubscribe();
          reject(error);
        },
        complete: async () => {
          console.log("\n\nStreaming completed.");
          console.log("Total response length:", fullContent.length);

          try {
            // Second streaming interaction in the same conversation
            const secondMessage =
              "Follow up: How do convolutional neural networks differ from recurrent neural networks?";
            console.log("\nSending second streaming message:");
            console.log(`User: ${secondMessage}`);

            // Use the conversation ID from the previous interaction
            const conversationId = agent!.state.conversationId;

            let secondFullContent = "";
            const secondStreamingObservablePromise =
              agentAdapter.sendMessageStream(
                agent!.id,
                secondMessage,
                conversationId
              );

            // Await the promise to get the observable
            const secondStreamingObservable =
              await secondStreamingObservablePromise;

            const secondSubscription = secondStreamingObservable.subscribe({
              next: (chunk) => {
                if (chunk.content) {
                  const contentStr =
                    typeof chunk.content === "string"
                      ? chunk.content
                      : JSON.stringify(chunk.content);
                  process.stdout.write(contentStr);
                  secondFullContent += contentStr;
                }
              },
              error: (error) => {
                console.error("\nStreaming error:", error);
                subscription.unsubscribe();
                secondSubscription.unsubscribe();
                reject(error);
              },
              complete: async () => {
                console.log("\n\nSecond streaming completed.");
                console.log(
                  "Second response length:",
                  secondFullContent.length
                );

                // Clean up all subscriptions
                subscription.unsubscribe();
                secondSubscription.unsubscribe();

                // All operations completed successfully
                resolve(null);
              },
            });
          } catch (error) {
            subscription.unsubscribe();
            reject(error);
          }
        },
      });
    });
  } catch (error) {
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

// Run the example
runStreamingExample()
  .then(async () => {
    console.log("All streaming operations completed successfully");

    // Now we need to clean up resources in a separate context
    const cleanupApp = await NestFactory.createApplicationContext(AppModule);
    try {
      const cleanupAgentAdapter = cleanupApp.get(DirectAgentAdapter);

      // Get all agents to find our streaming agent
      const allAgents = await cleanupAgentAdapter.getAllAgents();
      const streamingAgent = allAgents.find(
        (a) => a.name === "Streaming Agent"
      );

      if (streamingAgent) {
        console.log("\nDeleting agent...");
        // Delete the agent in this new, clean context
        await cleanupAgentAdapter.deleteAgent(streamingAgent.id);
        console.log("Agent deleted successfully");
      } else {
        console.log("Streaming agent not found for cleanup");
      }
    } catch (error) {
      console.error("Error during cleanup:", error.message);
    } finally {
      // Close the cleanup application context
      await cleanupApp.close();
      console.log("Application closed successfully");
    }
  })
  .catch((error) => {
    console.error("Unhandled error in runStreamingExample:", error);
  });
