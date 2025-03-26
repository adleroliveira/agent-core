import { AgentSDK } from "../sdk";

async function runSimpleExample() {
  // Initialize the SDK
  const sdk = new AgentSDK();

  try {
    // First interaction
    const text = "The answer is 42";
    console.log("\nCreating embedding:");
    console.log(`Text: ${text}`);

    const embedding = await sdk.generateEmbedding(text);

    console.log("\nEmbedding:");
    console.log(`${embedding}`);
  } catch (error) {
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  } finally {
    // Shutdown the SDK
    await sdk.close();
  }
}

// Run the example
runSimpleExample().catch((error) => {
  console.error("Unhandled error in runSimpleExample:", error);
});
