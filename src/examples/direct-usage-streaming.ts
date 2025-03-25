import { AgentSDK } from "../sdk";
import { Agent } from "../sdk/agent";

async function runStreamingExample(): Promise<void> {
  // Initialize the SDK
  const sdk = new AgentSDK();
  let agent: Agent | null = null;

  try {
    // Create a new agent
    agent = await sdk.createAgent({
      name: "Streaming Agent",
      description: "An agent for testing streaming responses",
      systemPrompt:
        "You are a helpful AI assistant that provides detailed, thoughtful responses. When asked a complex question, break down your answer into clear sections.",
    });

    console.log(`Agent created with ID: ${agent.id}`);

    // First message
    const firstMessage = "Explain how neural networks work in detail.";
    console.log("\nSending first message:");
    console.log(`User: ${firstMessage}`);

    // Process first message using a Promise-based approach
    const firstResponse = await processStreamingMessage(agent, firstMessage);
    console.log("\nFirst response completed. Length:", firstResponse.length);

    // Second message
    const secondMessage =
      "Follow up: How do convolutional neural networks differ from recurrent neural networks?";
    console.log("\nSending second message:");
    console.log(`User: ${secondMessage}`);

    // Process second message
    const secondResponse = await processStreamingMessage(agent, secondMessage);
    console.log("\nSecond response completed. Length:", secondResponse.length);
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
  } finally {
    // Clean up resources only after all operations are complete
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
runStreamingExample().catch((error: unknown) => {
  console.error("Unhandled error in runStreamingExample:", error);
});
