import { v4 as uuidv4 } from "uuid";
import { Message } from "./message.entity";

export class AgentState {
  public readonly id: string;
  public conversationHistory: Message[];
  public conversationId: string;
  public memory: Record<string, any>;
  public ttl?: number;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(
    params: {
      id?: string;
      conversationHistory?: Message[];
      memory?: Record<string, any>;
      ttl?: number;
    } = {}
  ) {
    this.id = params.id || uuidv4();
    this.conversationHistory = params.conversationHistory || [];
    this.memory = params.memory || {};
    this.ttl = params.ttl;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public addToConversation(message: Message): void {
    this.conversationHistory.push(message);
    if (message.conversationId && !this.conversationId) {
      this.conversationId = message.conversationId;
    }
    this.updatedAt = new Date();
  }

  public getLastNMessages(n: number): Message[] {
    return this.conversationHistory.slice(-n);
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
