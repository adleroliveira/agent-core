import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import { EventEmitter } from "node:events";

interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
}

interface DirectTransportConfig {
  environment: Record<string, any>;
  logging?: LoggingConfig;
}

/**
 * A simple message buffer that helps parse JSON RPC messages
 */
class MessageBuffer {
  private buffer: string = '';
  private logging: LoggingConfig;

  constructor(logging: LoggingConfig = { enabled: true, level: 'info' }) {
    this.logging = logging;
  }

  append(chunk: Buffer | string) {
    this.buffer += chunk.toString();
  }

  clear() {
    this.buffer = '';
  }

  readMessage(): JSONRPCMessage | null {
    try {
      // Look for the message boundary (newline)
      const newlineIndex = this.buffer.indexOf('\n');
      if (newlineIndex === -1) {
        return null;
      }

      // Extract the message
      const messageStr = this.buffer.substring(0, newlineIndex);
      this.buffer = this.buffer.substring(newlineIndex + 1);

      // Parse and validate JSON-RPC message
      const message = JSON.parse(messageStr);

      // Basic JSON-RPC 2.0 validation
      if (typeof message !== 'object' || message === null) {
        throw new Error('Invalid JSON-RPC message: not an object');
      }

      if (message.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version');
      }

      return message;
    } catch (error) {
      if (this.logging.enabled && this.logging.level === 'error') {
        console.error('[MessageBuffer] Error parsing message:', error);
      }
      // Clear buffer on parse error to prevent further issues
      this.buffer = '';
      throw new Error(`Failed to parse message: ${error}`);
    }
  }
}

/**
 * Direct transport implementation that allows communication between client and server
 * within the same process using an EventEmitter as the communication channel.
 */
export class DirectTransport implements Transport {
  private messageBuffer: MessageBuffer;
  private started = false;
  private emitter: EventEmitter;
  private role: 'client' | 'server';
  private sendChannel: string;
  private receiveChannel: string;
  private environment: Record<string, any>;
  private logging: LoggingConfig;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(emitter: EventEmitter, role: 'client' | 'server', config: DirectTransportConfig = { environment: {} }) {
    this.emitter = emitter;
    this.role = role;
    this.environment = config.environment;
    this.logging = config.logging || { enabled: true, level: 'info' };
    this.messageBuffer = new MessageBuffer(this.logging);
    // Define separate channels for client-to-server and server-to-client communication
    this.sendChannel = role === 'client' ? 'clientToServer' : 'serverToClient';
    this.receiveChannel = role === 'client' ? 'serverToClient' : 'clientToServer';
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) {
    if (!this.logging.enabled) return;
    if (this.logging.level === 'error' && level !== 'error') return;
    if (this.logging.level === 'warn' && level === 'debug') return;
    if (this.logging.level === 'info' && level === 'debug') return;

    const prefix = `[DirectTransport:${this.role}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, ...args);
        break;
      case 'info':
        console.log(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'error':
        console.error(prefix, message, ...args);
        break;
    }
  }

  getEnvironment(): Record<string, any> {
    return this.environment;
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error("DirectTransport already started!");
    }

    this.log('info', 'Starting transport');
    this.started = true;
    this.emitter.on(this.receiveChannel, this.handleMessage);
    this.emitter.on('error', this.handleError);
  }

  private handleMessage = (chunk: Buffer | string) => {
    try {
      this.messageBuffer.append(chunk);
      this.processMessageBuffer();
    } catch (error) {
      this.log('error', 'Error handling message:', error);
      this.onerror?.(error as Error);
    }
  };

  private handleError = (error: Error) => {
    this.log('error', 'Error:', error);
    this.onerror?.(error);
  };

  private processMessageBuffer() {
    while (true) {
      try {
        const message = this.messageBuffer.readMessage();
        if (message === null) {
          break;
        }

        this.log('debug', 'Processing message:', {
          type: 'method' in message ? 'request' : 'response',
          id: 'id' in message ? message.id : undefined,
          method: 'method' in message ? message.method : undefined,
          params: 'params' in message ? message.params : undefined,
          result: 'result' in message ? message.result : undefined,
          error: 'error' in message ? message.error : undefined
        });
        this.onmessage?.(message);
      } catch (error) {
        this.log('error', 'Error processing message buffer:', error);
        this.onerror?.(error as Error);
        break; // Stop processing on error to prevent infinite loop
      }
    }
  }

  async close(): Promise<void> {
    this.log('info', 'Closing transport');
    this.emitter.off(this.receiveChannel, this.handleMessage);
    this.emitter.off('error', this.handleError);
    this.messageBuffer.clear();
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.started) {
      throw new Error("Transport not started");
    }

    try {
      // Ensure message is properly formatted
      const jsonMessage = {
        ...message,
        jsonrpc: '2.0'  // Override any existing jsonrpc property
      };

      this.log('debug', 'Sending message:', {
        type: 'method' in jsonMessage ? 'request' : 'response',
        id: 'id' in jsonMessage ? jsonMessage.id : undefined,
        method: 'method' in jsonMessage ? jsonMessage.method : undefined,
        params: 'params' in jsonMessage ? jsonMessage.params : undefined,
        result: 'result' in jsonMessage ? jsonMessage.result : undefined,
        error: 'error' in jsonMessage ? jsonMessage.error : undefined
      });

      const json = JSON.stringify(jsonMessage) + '\n';
      this.emitter.emit(this.sendChannel, json);
    } catch (error) {
      this.log('error', 'Error sending message:', error);
      this.onerror?.(error as Error);
      throw error;
    }
  }
}

/**
 * Creates a pair of connected transports that can communicate directly with each other
 * within the same process.
 */
export function createDirectTransportPair(config?: DirectTransportConfig): { clientTransport: DirectTransport; serverTransport: DirectTransport } {
  const emitter = new EventEmitter();
  return {
    clientTransport: new DirectTransport(emitter, 'client', config),
    serverTransport: new DirectTransport(emitter, 'server', config)
  };
}

