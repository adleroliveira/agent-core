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
 * Lexer for GenAI stream content that preserves the original text chunks
 * while correctly identifying and emitting block markers.
 */
export class GenAIStreamLexer {
  private currentState: 'normal' | 'tag' | 'tagName' | 'closingTag' | 'closingTagName' = 'normal';
  private currentTagName: string = '';
  private tagBuffer: string = '';

  /**
   * Process a chunk of data from the GenAI stream.
   * @param chunk The raw chunk from the stream (already JSON parsed by ChatService)
   * @returns A generator that yields tokens as they are identified
   */
  public *processChunk(chunk: string): Generator<Token> {
    try {
      // Parse the content if it's a string representation of JSON
      let parsedContent: any;
      
      if (typeof chunk === 'string') {
        try {
          parsedContent = JSON.parse(chunk);
        } catch {
          // If not JSON, treat it as plain text or handle specially
          if (chunk === '[DONE]') {
            yield { type: TokenType.DONE, value: '[DONE]' };
            return;
          }
          
          // If it's not JSON and not [DONE], assume it's plain text
          yield* this.processContentChunk(chunk);
          return;
        }
      } else {
        // Already an object
        parsedContent = chunk;
      }
      
      // Handle tool calls if present
      if (parsedContent.toolCalls && Array.isArray(parsedContent.toolCalls)) {
        for (const toolCall of parsedContent.toolCalls) {
          yield {
            type: TokenType.TOOL_CALL,
            value: JSON.stringify(toolCall),
            toolInfo: {
              id: toolCall.id,
              name: toolCall.name,
              arguments: toolCall.arguments
            }
          };
        }
        return;
      }
      
      // Handle tool results (format may vary by implementation)
      if (parsedContent.content && 
          typeof parsedContent.content === 'string' && 
          parsedContent.content.includes('Tool') && 
          parsedContent.content.includes('result:')) {
        yield {
          type: TokenType.TOOL_RESULT,
          value: parsedContent.content
        };
        return;
      }
      
      // Process content chunk - only if it has content
      if (parsedContent.content && (typeof parsedContent.content === 'string' || typeof parsedContent.content === 'number')) {
        // Check for the '[DONE]' signal in the content
        if (parsedContent.content === '[DONE]') {
          yield { type: TokenType.DONE, value: '[DONE]' };
          return;
        }
        
        // Convert number to string if needed
        const content = typeof parsedContent.content === 'number' ? parsedContent.content.toString() : parsedContent.content;
        yield* this.processContentChunk(content);
      } else if (parsedContent !== null && parsedContent !== undefined && 
                 !(typeof parsedContent === 'object' && Object.keys(parsedContent).length === 0) &&
                 !(typeof parsedContent === 'number')) {  // Don't mark numbers as unparseable
        // Only mark as unparseable if it's not an empty object, not a string content, and not a number
        console.log('UNPARSEABLE CONTENT:', chunk, parsedContent, typeof parsedContent);
        yield { 
          type: TokenType.UNPARSEABLE, 
          value: typeof parsedContent === 'string' ? parsedContent : JSON.stringify(parsedContent) 
        };
      }
    } catch (error) {
      console.error('Error processing chunk:', error);
      yield { type: TokenType.UNPARSEABLE, value: chunk };
    }
  }

  /**
   * Process a content chunk and emit appropriate tokens.
   * This preserves text chunks rather than splitting into individual characters.
   * 
   * @param contentChunk The content string from the parsed JSON
   * @returns A generator that yields tokens for this content chunk
   */
  private *processContentChunk(contentChunk: string): Generator<Token> {
    // Add this chunk to our tag buffer for processing
    this.tagBuffer += contentChunk;
    
    // First, let's check if we have complete tags in the buffer
    if (this.tagBuffer.includes('<') && (this.tagBuffer.includes('>') || this.tagBuffer.includes('</>'))) {
      // Process tag patterns in the combined buffer
      yield* this.processTagPatterns();
      return;
    }
    
    // If we're clearly not in the middle of a tag and just have regular text
    if (this.currentState === 'normal' && !this.tagBuffer.includes('<') && this.tagBuffer.trim()) {
      yield { type: TokenType.TEXT, value: this.tagBuffer };
      this.tagBuffer = ''; // Clear the buffer after emitting
      return;
    }
    
    // Otherwise, we might have a partial tag or are waiting for more content
    // Keep the content in the buffer until we get more chunks
  }
  
  /**
   * Process the tag buffer to identify and emit tag tokens
   */
  private *processTagPatterns(): Generator<Token> {
    // Look for complete tag patterns in the buffer
    const openingTagMatch = this.tagBuffer.match(/<([a-zA-Z0-9_]+)>/);
    const closingTagMatch = this.tagBuffer.match(/<\/([a-zA-Z0-9_]+)>/);
    
    if (openingTagMatch) {
      // We found a complete opening tag
      const tagName = openingTagMatch[1];
      const tagText = openingTagMatch[0];
      const tagEndIndex = this.tagBuffer.indexOf(tagText) + tagText.length;
      
      // Extract any text before the tag
      const textBeforeTag = this.tagBuffer.substring(0, this.tagBuffer.indexOf(tagText));
      if (textBeforeTag.trim() && this.currentState === 'normal') {
        yield { type: TokenType.TEXT, value: textBeforeTag };
      }
      
      // Emit the block start token
      yield {
        type: TokenType.BLOCK_START,
        value: tagText,
        blockName: tagName
      };
      
      // Update the state
      this.currentState = 'normal';
      this.currentTagName = tagName;
      
      // Keep any text after the tag in the buffer
      this.tagBuffer = this.tagBuffer.substring(tagEndIndex);
      
      // Process any remaining tags in the buffer
      if (this.tagBuffer.length > 0) {
        yield* this.processTagPatterns();
      }
      
      return;
    }
    
    if (closingTagMatch) {
      // We found a complete closing tag
      const tagName = closingTagMatch[1];
      const tagText = closingTagMatch[0];
      const tagEndIndex = this.tagBuffer.indexOf(tagText) + tagText.length;
      
      // Extract any text before the tag
      const textBeforeTag = this.tagBuffer.substring(0, this.tagBuffer.indexOf(tagText));
      if (textBeforeTag.trim() && this.currentState === 'normal') {
        yield { type: TokenType.TEXT, value: textBeforeTag };
      }
      
      // Emit the block end token
      yield {
        type: TokenType.BLOCK_END,
        value: tagText,
        blockName: tagName
      };
      
      // Update the state
      this.currentState = 'normal';
      this.currentTagName = '';
      
      // Keep any text after the tag in the buffer
      this.tagBuffer = this.tagBuffer.substring(tagEndIndex);
      
      // Process any remaining tags in the buffer
      if (this.tagBuffer.length > 0) {
        yield* this.processTagPatterns();
      }
      
      return;
    }
    
    // Check for partial tags at the end of the buffer
    if (this.tagBuffer.trimEnd().endsWith('<')) {
      // This is a partial opening tag at the end of the buffer
      // We'll keep the entire buffer and wait for more chunks
      return;
    }
    
    // Check for a potential incomplete open tag (has < but no > yet)
    const partialOpenTag = this.tagBuffer.lastIndexOf('<');
    if (partialOpenTag !== -1 && this.tagBuffer.indexOf('>', partialOpenTag) === -1) {
      // We have a partial tag starting at partialOpenTag
      // Emit any text before the partial tag
      if (partialOpenTag > 0) {
        const textBeforePartialTag = this.tagBuffer.substring(0, partialOpenTag);
        if (textBeforePartialTag.trim()) {
          yield { type: TokenType.TEXT, value: textBeforePartialTag };
        }
        
        // Keep only the partial tag in the buffer
        this.tagBuffer = this.tagBuffer.substring(partialOpenTag);
      }
      return;
    }
    
    // If the buffer starts with '<' but doesn't contain '>' yet
    if (this.tagBuffer.startsWith('<') && !this.tagBuffer.includes('>')) {
      // This is an incomplete tag, keep waiting
      return;
    }
    
    // If the buffer contains text and we're in normal mode, emit it
    if (this.currentState === 'normal') {
      // Find the next tag marker
      const nextTagIndex = this.tagBuffer.indexOf('<');
      
      if (nextTagIndex === -1) {
        // No more tags, emit all as text if it's not empty
        if (this.tagBuffer.trim()) {
          yield { type: TokenType.TEXT, value: this.tagBuffer };
          this.tagBuffer = '';
        }
      } else if (nextTagIndex > 0) {
        // Emit the text before the tag
        const textBeforeTag = this.tagBuffer.substring(0, nextTagIndex);
        if (textBeforeTag.trim()) {
          yield { type: TokenType.TEXT, value: textBeforeTag };
        }
        
        // Keep the rest in the buffer
        this.tagBuffer = this.tagBuffer.substring(nextTagIndex);
      }
    }
  }
  
  /**
   * Flush any remaining content in the buffer.
   * @returns A generator that yields any remaining tokens
   */
  public *flush(): Generator<Token> {
    if (this.tagBuffer.trim()) {
      // If we still have content in the tag buffer, emit it as text
      yield { type: TokenType.TEXT, value: this.tagBuffer };
      this.tagBuffer = '';
    }
  }
}