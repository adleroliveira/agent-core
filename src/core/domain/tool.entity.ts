import { v4 as uuidv4 } from "uuid";
export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
  enum?: any[];
  default?: any;
  properties?: Record<string, ToolParameter>; // For object types
  items?: ToolParameter; // For array types
}

export class Tool {
  public readonly id: string;
  public name: string;
  public description: string;
  public directive: string;
  public parameters: ToolParameter[];
  public handler: (args: Record<string, any>, environment?: Record<string, string>) => Promise<any>;
  public metadata?: Record<string, any>;
  public systemPrompt?: string;
  public createdAt: Date;
  public updatedAt: Date;
  public jsonSchema?: Record<string, any>;
  public serverId?: string;

  constructor(params: {
    id?: string;
    name: string;
    description: string;
    directive: string;
    parameters: ToolParameter[];
    handler: (args: Record<string, any>, environment?: Record<string, string>) => Promise<any>;
    metadata?: Record<string, any>;
    systemPrompt?: string;
    jsonSchema?: Record<string, any>;
    serverId?: string;
  }) {
    this.id = params.id || uuidv4();
    this.name = params.name;
    this.description = params.description;
    this.directive = params.directive;
    this.parameters = params.parameters;
    this.handler = params.handler;
    this.metadata = params.metadata;
    this.systemPrompt = params.systemPrompt;
    this.jsonSchema = params.jsonSchema;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.serverId = params.serverId;
  }

  public async execute(args: Record<string, any>, environment?: Record<string, string>): Promise<any> {
    // Validate parameters before execution
    this.validateParameters(args);

    try {
      return await this.handler(args, environment);
    } catch (error) {
      // Re-throw with additional context
      console.error(error)
      throw new Error(`Error executing tool ${this.name}: ${error.message}`);
    }
  }

  private validateParameters(args: Record<string, any>): void {
    // Check for required parameters
    for (const param of this.parameters) {
      if (
        param.required &&
        (args[param.name] === undefined ||
          args[param.name] === null ||
          args[param.name] === "")
      ) {
        throw new Error(
          `Required parameter '${param.name}' is missing for tool '${this.name}'`
        );
      }

      // If parameter is provided, validate its type
      if (
        args[param.name] !== undefined &&
        args[param.name] !== null &&
        args[param.name] !== ""
      ) {
        // Simple type checking
        switch (param.type) {
          case "string":
            if (typeof args[param.name] !== "string") {
              throw new Error(`Parameter '${param.name}' must be a string`);
            }
            break;
          case "number":
            if (typeof args[param.name] !== "number") {
              // Try to convert string to number if possible
              if (typeof args[param.name] === "string") {
                const num = Number(args[param.name]);
                if (!isNaN(num)) {
                  // Convert to number for later use
                  args[param.name] = num;
                } else {
                  throw new Error(`Parameter '${param.name}' must be a number`);
                }
              } else {
                throw new Error(`Parameter '${param.name}' must be a number`);
              }
            }
            break;
          case "boolean":
            if (typeof args[param.name] !== "boolean") {
              throw new Error(`Parameter '${param.name}' must be a boolean`);
            }
            break;
          case "object":
            if (
              typeof args[param.name] !== "object" ||
              args[param.name] === null ||
              Array.isArray(args[param.name])
            ) {
              throw new Error(`Parameter '${param.name}' must be an object`);
            }
            break;
          case "array":
            if (!Array.isArray(args[param.name])) {
              throw new Error(`Parameter '${param.name}' must be an array`);
            }
            break;
        }

        // Check enum values if specified
        if (param.enum && !param.enum.includes(args[param.name])) {
          throw new Error(
            `Parameter '${param.name}' must be one of: ${param.enum.join(", ")}`
          );
        }
      } else if (param.default !== undefined && args[param.name] === "") {
        // If empty string is provided and there's a default value, use the default
        args[param.name] = param.default;
      }
    }
  }
}
