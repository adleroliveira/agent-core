import { v4 as uuidv4 } from "uuid";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface MessageContent {
  text: string;
  images?: string[]; // URLs or base64 encoded images
  audio?: string; // URL or base64 encoded audio
  [key: string]: any; // For extensibility
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export class Message {
  public readonly id: string;
  public role: MessageRole;
  public content: string | MessageContent;
  public stateId: string;
  public metadata?: Record<string, any>;
  public toolCalls?: ToolCall[];
  public toolCallId?: string;
  public toolName?: string;
  public isToolError?: boolean;

  public createdAt: Date;
  public isStreaming?: boolean;

  constructor(params: {
    id?: string;
    role: MessageRole;
    content: string | MessageContent;
    stateId: string;
    metadata?: Record<string, any>;
    toolCalls?: ToolCall[];
    toolCallId?: string;
    toolName?: string;
    isToolError?: boolean;
    isStreaming?: boolean;
  }, public isNew: boolean = true) {
    this.id = params.id || uuidv4();
    this.role = params.role;
    this.content = params.content;
    this.stateId = params.stateId;
    this.metadata = params.metadata;
    this.toolCalls = params.toolCalls;
    this.toolCallId = params.toolCallId;
    this.toolName = params.toolName;
    this.isToolError = params.isToolError || false;
    this.isStreaming = params.isStreaming || false;
    this.createdAt = new Date();
  }

  public isToolCall(): boolean {
    return (
      this.role === "assistant" &&
      (!!this.toolCallId || (this.toolCalls?.length ?? 0) > 0)
    );
  }

  public isToolErrorResponse(): boolean {
    return this.role === "tool" && this.isToolError === true;
  }

  public isToolResponse(): boolean {
    return this.role === "tool";
  }

  public isUserMessage(): boolean {
    return this.role === "user";
  }

  public isAssistantMessage(): boolean {
    return this.role === "assistant" && !this.isToolCall();
  }

  public isSystemMessage(): boolean {
    return this.role === "system";
  }

  public getTextContent(): string {
    if (typeof this.content === "string") {
      return this.content;
    }
    return this.content.text || "";
  }

  public appendContent(content: string): void {
    if (typeof this.content === "string") {
      this.content += content;
    } else {
      this.content.text = (this.content.text || "") + content;
    }
  }

  public completeStreaming(): void {
    this.isStreaming = false;
  }
}
