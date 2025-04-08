import { v4 as uuidv4 } from "uuid";
import { Message } from "./message.entity";

export class AgentState {
  public readonly id: string;
  public conversationHistory: Message[];
  public conversationId: string;
  public agentId: string;
  public memory: Record<string, any>;
  public ttl?: number;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(
    params: {
      id?: string;
      agentId?: string;
      conversationId?: string;
      conversationHistory?: Message[];
      memory?: Record<string, any>;
      ttl?: number;
    } = {}
  ) {
    this.id = params.id || uuidv4();
    this.agentId = params.agentId || "";
    this.conversationId = params.conversationId || "new-conversation";
    this.conversationHistory = params.conversationHistory || [];
    this.memory = params.memory || {};
    this.ttl = params.ttl;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public addToConversation(message: Message): void {
    // Ensure the message has a timestamp
    if (!message.createdAt) {
      message.createdAt = new Date();
    }

    // Find the correct position to insert the message
    const insertIndex = this.conversationHistory.findIndex(
      existingMsg => existingMsg.createdAt > message.createdAt
    );

    if (insertIndex === -1) {
      // If no message is newer, append to the end
      this.conversationHistory.push(message);
    } else {
      // Insert at the correct position to maintain chronological order
      this.conversationHistory.splice(insertIndex, 0, message);
    }

    if (message.conversationId && !this.conversationId) {
      this.conversationId = message.conversationId;
    }
    this.updatedAt = new Date();
  }

  public getLastNMessages(n: number): Message[] {
    // Return the last N messages in chronological order
    return this.conversationHistory.slice(-n);
  }

  public getLastNInteractions(n: number): Message[] {
    // Create a copy to avoid modifying the original array
    const history = [...this.conversationHistory];
    const result: Message[] = [];
    let interactionCount = 0;

    // Work backward from the end of the history
    for (let i = history.length - 1; i >= 0; i--) {
      result.unshift(history[i]);

      // If we've collected a full user-assistant pair, count it as one interaction
      if (
        i > 0 &&
        history[i].role === "assistant" &&
        (history[i - 1].role === "user" || history[i - 1].role === "tool")
      ) {
        interactionCount++;
        if (interactionCount >= n) break;
      }
    }

    // Ensure the first message is from a user
    if (result.length > 0 && (result[0].role !== "user" && result[0].role !== "tool")) {
      // Find the first user message
      const firstUserIndex = result.findIndex((msg) => msg.role === "user" || msg.role === "tool");
      if (firstUserIndex > 0) {
        // Remove any assistant messages that came before the first user message
        result.splice(0, firstUserIndex);
      } else {
        // If there are no user messages, we need at least one to start the conversation
        return [];
      }
    }

    return result;
  }

  public storeInMemory(key: string, value: any): void {
    this.memory[key] = value;
    this.updatedAt = new Date();
  }

  public retrieveFromMemory(key: string): any {
    return this.memory[key];
  }

  public deleteFromMemory(key: string): void {
    delete this.memory[key];
    this.updatedAt = new Date();
  }

  public clearMemory(): void {
    this.memory = {};
    this.updatedAt = new Date();
  }

  public clearConversation(): void {
    this.conversationHistory = [];
    this.updatedAt = new Date();
  }

  public isExpired(): boolean {
    if (!this.ttl) return false;

    const expirationTime = new Date(this.updatedAt.getTime() + this.ttl * 1000);
    return new Date() > expirationTime;
  }
}
