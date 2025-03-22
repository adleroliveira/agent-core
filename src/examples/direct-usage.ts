import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DirectAgentAdapter } from "../adapters/api/direct/direct-agent.adapter";

async function runSimpleExample() {
  // Bootstrap the application
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Get the direct agent adapter
    const agentAdapter = app.get(DirectAgentAdapter);

    // Create a new agent
    console.log("Creating agent...");
    const agent = await agentAdapter.createAgent({
      name: "Simple Conversation Agent",
      description: "A basic agent for testing conversation flow",
      systemPromptContent:
        "You are a helpful AI assistant that provides concise answers to user questions. Keep your responses brief and to the point.",
      // No tools specified
    });

    console.log(`Agent created with ID: ${agent.id}`);

    // First interaction
    const firstMessage = "What can you help me with?";
    console.log("\nSending first message:");
    console.log(`User: ${firstMessage}`);

    const firstResponse = await agentAdapter.sendMessageSync(
      agent.id,
      firstMessage
    );

    console.log("\nAgent response:");
    console.log(`${firstResponse.content}`);

    // Second interaction
    const secondMessage = "Tell me about the benefits of AI assistants.";
    console.log("\nSending second message:");
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

    // Third interaction
    const thirdMessage = "What are some limitations I should be aware of?";
    console.log("\nSending third message:");
    console.log(`User: ${thirdMessage}`);

    const thirdResponse = await agentAdapter.sendMessageSync(
      agent.id,
      thirdMessage,
      conversationId
    );

    console.log("\nAgent response:");
    console.log(`${thirdResponse.content}`);

    // Clean up
    console.log("Deleting agent...");
    await agentAdapter.deleteAgent(agent.id);
    console.log("Agent deleted successfully");
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
runSimpleExample().catch((error) => {
  console.error("Unhandled error in runSimpleExample:", error);
});
