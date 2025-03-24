import { AgentSDK } from '../sdk';

async function runSimpleExample() {
  // Initialize the SDK
  const sdk = new AgentSDK();

  try {
    // Create a new agent
    console.log("Creating agent...");
    const agent = await sdk.createAgent({
      name: "Simple Conversation Agent",
      description: "A basic agent for testing conversation flow",
      systemPrompt: "You are a helpful AI assistant that provides concise answers to user questions. Keep your responses brief and to the point.",
      // No tools specified
    });

    console.log(`Agent created with ID: ${agent.id}`);

    // First interaction
    const firstMessage = "What can you help me with?";
    console.log("\nSending first message:");
    console.log(`User: ${firstMessage}`);

    const firstResponse = await agent.ask(firstMessage);

    console.log("\nAgent response:");
    console.log(`${firstResponse.getTextContent()}`);

    // Second interaction
    const secondMessage = "Tell me about the benefits of AI assistants.";
    console.log("\nSending second message:");
    console.log(`User: ${secondMessage}`);

    // The conversation ID is automatically managed by the agent
    const secondResponse = await agent.ask(secondMessage);

    console.log("\nAgent response:");
    console.log(`${secondResponse.getTextContent()}`);

    // Third interaction
    const thirdMessage = "What are some limitations I should be aware of?";
    console.log("\nSending third message:");
    console.log(`User: ${thirdMessage}`);

    const thirdResponse = await agent.ask(thirdMessage);

    console.log("\nAgent response:");
    console.log(`${thirdResponse.getTextContent()}`);

    // Clean up
    console.log("Deleting agent...");
    await sdk.deleteAgent(agent.id);
    console.log("Agent deleted successfully");
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