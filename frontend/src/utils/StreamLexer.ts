// @ts-nocheck
export enum TokenType {
  BLOCK_START = 'BLOCK_START',
  BLOCK_END = 'BLOCK_END',
  TEXT = 'TEXT',
  TOOL_CALL = 'TOOL_CALL',
  TOOL_RESULT = 'TOOL_RESULT',
  DONE = 'DONE',
  UNPARSEABLE = 'UNPARSEABLE'
}

export interface Token {
  type: TokenType;
  value: string;
  blockName?: string; // For BLOCK_START and BLOCK_END tokens
  toolInfo?: {
    id?: string;
    name?: string;
    arguments?: Record<string, any>;
  }; // For TOOL_CALL tokens
}

/**
 * Lexer for GenAI stream content that processes standardized chunks
 * and emits appropriate tokens.
 */
export class GenAIStreamLexer {
  private tagBuffer: string = '';

  /**
   * Process a chunk of data from the GenAI stream.
   * @param chunk The raw chunk from the stream
   * @returns A generator that yields tokens as they are identified
   */
  public *processChunk(chunk: string): Generator<Token> {
    try {
      // If the chunk is a JSON string, parse it
      let parsedContent: any;
      if (typeof chunk === 'string') {
        try {
          parsedContent = JSON.parse(chunk);
        } catch {
          // If not JSON, treat as plain text
          yield* this.processContentChunk(chunk);
          return;
        }
      } else {
        parsedContent = chunk;
      }

      // Handle tool calls
      if (parsedContent.type === 'TOOL_CALL' && parsedContent.toolInfo) {
        yield {
          type: TokenType.TOOL_CALL,
          toolInfo: parsedContent.toolInfo
        };
        return;
      }

      // Handle tool results
      if (parsedContent.type === 'TOOL_RESULT' && parsedContent.toolInfo) {
        yield {
          type: TokenType.TOOL_RESULT,
          toolInfo: parsedContent.toolInfo
        };
        return;
      }

      // Handle regular content
      if (typeof parsedContent === 'string') {
        yield* this.processContentChunk(parsedContent);
      } else {
        console.warn('Unparseable content:', parsedContent);
        yield { 
          type: TokenType.UNPARSEABLE, 
          value: JSON.stringify(parsedContent) 
        };
      }
    } catch (error) {
      console.error('Error processing chunk:', error);
      yield { type: TokenType.UNPARSEABLE, value: chunk };
    }
  }

  /**
   * Process a content chunk and emit appropriate tokens.
   * Handles block tags and text content.
   */
  private *processContentChunk(contentChunk: string): Generator<Token> {
    // Add this chunk to our tag buffer for processing
    this.tagBuffer += contentChunk;
    
    // Process any complete tags in the buffer
    while (this.tagBuffer.includes('<') && this.tagBuffer.includes('>')) {
      const openingTagMatch = this.tagBuffer.match(/<([a-zA-Z0-9_]+)>/);
      const closingTagMatch = this.tagBuffer.match(/<\/([a-zA-Z0-9_]+)>/);
      
      if (openingTagMatch) {
        // Found an opening tag
        const tagName = openingTagMatch[1];
        const tagText = openingTagMatch[0];
        const tagEndIndex = this.tagBuffer.indexOf(tagText) + tagText.length;
        
        // Emit any text before the tag
        const textBeforeTag = this.tagBuffer.substring(0, this.tagBuffer.indexOf(tagText));
        if (textBeforeTag.trim()) {
          yield { type: TokenType.TEXT, value: textBeforeTag };
        }
        
        // Emit the block start token
        yield {
          type: TokenType.BLOCK_START,
          value: tagText,
          blockName: tagName
        };
        
        // Update buffer
        this.tagBuffer = this.tagBuffer.substring(tagEndIndex);
      } else if (closingTagMatch) {
        // Found a closing tag
        const tagName = closingTagMatch[1];
        const tagText = closingTagMatch[0];
        const tagEndIndex = this.tagBuffer.indexOf(tagText) + tagText.length;
        
        // Emit any text before the tag
        const textBeforeTag = this.tagBuffer.substring(0, this.tagBuffer.indexOf(tagText));
        if (textBeforeTag.trim()) {
          yield { type: TokenType.TEXT, value: textBeforeTag };
        }
        
        // Emit the block end token
        yield {
          type: TokenType.BLOCK_END,
          value: tagText,
          blockName: tagName
        };
        
        // Update buffer
        this.tagBuffer = this.tagBuffer.substring(tagEndIndex);
      } else {
        // No complete tags found, break the loop
        break;
      }
    }
    
    // If we have text left in the buffer and no incomplete tags, emit it
    if (this.tagBuffer.trim() && !this.tagBuffer.includes('<')) {
      yield { type: TokenType.TEXT, value: this.tagBuffer };
      this.tagBuffer = '';
    }
  }
  
  /**
   * Flush any remaining content in the buffer.
   * @returns A generator that yields any remaining tokens
   */
  public *flush(): Generator<Token> {
    if (this.tagBuffer.trim()) {
      yield { type: TokenType.TEXT, value: this.tagBuffer };
      this.tagBuffer = '';
    }
  }
}