import { AgentSDK } from '../sdk';
import { Agent } from '../sdk/agent'; // Import the Agent type from your SDK

async function runStreamingExample(): Promise<void> {
  // Initialize the SDK
  const sdk = new AgentSDK();
  let agent: Agent | null = null;

  try {
    // Create a new agent
    agent = await sdk.createAgent({
      name: "Streaming Agent",
      description: "An agent for testing streaming responses",
      systemPrompt: "You are a helpful AI assistant that provides detailed, thoughtful responses. When asked a complex question, break down your answer into clear sections.",
      // No tools specified
    });

    const firstMessage = "Explain how neural networks work in detail.";
    console.log("\nSending first streaming message:");
    console.log(`User: ${firstMessage}`);

    let fullContent = "";

    // Use the SDK's streaming method with callbacks
    await agent.askStream(firstMessage, {
      onChunk: (chunk: string) => {
        // Print each chunk as it arrives
        process.stdout.write(chunk);
        fullContent += chunk;
      },
      onToolCall: (toolCall: { name: string; arguments: Record<string, any> }) => {
        console.log("\n\nTool calls detected:");
        console.log(`- Tool: ${toolCall.name}, Arguments: ${JSON.stringify(toolCall.arguments)}`);
      },
      onComplete: async () => {
        console.log("\n\nStreaming completed.");
        console.log("Total response length:", fullContent.length);

        // Second streaming interaction in the same conversation
        const secondMessage = "Follow up: How do convolutional neural networks differ from recurrent neural networks?";
        console.log("\nSending second streaming message:");
        console.log(`User: ${secondMessage}`);

        let secondFullContent = "";

        // The conversation ID is automatically managed by the agent
        // We need to explicitly check for null even though we know it's not
        if (agent) {
          await agent.askStream(secondMessage, {
            onChunk: (chunk: string) => {
              process.stdout.write(chunk);
              secondFullContent += chunk;
            },
            onComplete: () => {
              console.log("\n\nSecond streaming completed.");
              console.log("Second response length:", secondFullContent.length);
            },
            onError: (error: Error) => {
              console.error("\nStreaming error:", error);
            }
          });
        }
      },
      onError: (error: Error) => {
        console.error("\nStreaming error:", error);
      }
    });

    // Clean up
    console.log("\nDeleting agent...");
    if (agent) {
      await sdk.deleteAgent(agent.id);
      console.log("Agent deleted successfully");
    }

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
runStreamingExample().catch((error: unknown) => {
  console.error("Unhandled error in runStreamingExample:", error);
});