import { AgentSDK } from "../sdk";

async function runRagExample(): Promise<void> {
  // Initialize the SDK
  const sdk = new AgentSDK();

  try {
    // Create a new agent with RAG tools
    console.log("Creating RAG-enabled agent...");
    const agent = await sdk.createAgent({
      name: "Knowledge Assistant",
      description: "An agent that can learn and retrieve information from a knowledge base",
      systemPrompt: `You are a helpful knowledge assistant that can learn new information and retrieve it when needed.
      You have access to two main tools:
      1. ragAdd: Use this to add new information to your knowledge base
      2. ragSearch: Use this to search for relevant information in your knowledge base

      When adding information:
      - Be precise and concise
      - Include relevant metadata when appropriate
      - Verify the information before adding it

      When searching:
      - Use specific queries to get the most relevant results
      - Consider the context of the user's question
      - If you don't find relevant information, let the user know

      Always maintain a helpful and informative tone.`,
      tools: ["ragAdd", "ragSearch"],
    });

    console.log(`RAG Agent created with ID: ${agent.id}`);

    // Process messages sequentially using async/await
    async function processMessage(message: string, conversationId?: string) {
      console.log(`\nUser: ${message}`);
      const response = await agent.ask(message, conversationId);
      console.log("\nAgent response:");
      console.log(`${response.content}`);
      return response;
    }

    // First interaction - add some knowledge
    const firstMessage = "Learn this information: The capital of France is Paris, and it's known for the Eiffel Tower.";
    console.log("\nAdding first piece of knowledge:");
    const firstResponse = await processMessage(firstMessage);

    // Get the conversation ID for subsequent messages
    const conversationId = firstResponse.conversationId;

    // Second interaction - add more knowledge
    const secondMessage = "Learn this information: The Louvre Museum in Paris houses the famous Mona Lisa painting.";
    console.log("\nAdding second piece of knowledge:");
    await processMessage(secondMessage, conversationId);

    // Third interaction - search for information
    const thirdMessage = "What do you know about Paris?";
    console.log("\nSearching for information about Paris:");
    await processMessage(thirdMessage, conversationId);

    // Fourth interaction - add more knowledge
    const fourthMessage = "Learn this information: Paris is the capital of France and is located in the northern part of the country.";
    console.log("\nAdding third piece of knowledge:");
    await processMessage(fourthMessage, conversationId);

    // Fifth interaction - search with a specific query
    const fifthMessage = "What famous landmarks are in Paris?";
    console.log("\nSearching for landmarks in Paris:");
    await processMessage(fifthMessage, conversationId);

    // Sixth interaction - search with a different context
    const sixthMessage = "Tell me about the art in Paris.";
    console.log("\nSearching for art-related information:");
    await processMessage(sixthMessage, conversationId);

    // Clean up
    console.log("\nDeleting agent...");
    await sdk.deleteAgent(agent.id);
    console.log("RAG agent deleted successfully");
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
runRagExample().catch((error) => {
  console.error("Unhandled error in runRagExample:", error);
}); 