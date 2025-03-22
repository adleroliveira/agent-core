import { v4 as uuidv4 } from 'uuid';

export class Prompt {
  public readonly id: string;
  public content: string;
  public type: 'system' | 'user';
  public name?: string;
  public metadata?: Record<string, any>;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(params: {
    id?: string;
    content: string;
    type: 'system' | 'user';
    name?: string;
    metadata?: Record<string, any>;
  }) {
    this.id = params.id || uuidv4();
    this.content = params.content;
    this.type = params.type;
    this.name = params.name;
    this.metadata = params.metadata;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public isSystemPrompt(): boolean {
    return this.type === 'system';
  }

  public isUserPrompt(): boolean {
    return this.type === 'user';
  }

  public update(content: string, metadata?: Record<string, any>): void {
    this.content = content;
    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }
    this.updatedAt = new Date();
  }
}