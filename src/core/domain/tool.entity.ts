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
  public parameters: ToolParameter[];
  public handler: (args: Record<string, any>) => Promise<any>;
  public metadata?: Record<string, any>;
  public createdAt: Date;
  public updatedAt: Date;
  public jsonSchema?: Record<string, any>;

  constructor(params: {
    id?: string;
    name: string;
    description: string;
    parameters: ToolParameter[];
    handler: (args: Record<string, any>) => Promise<any>;
    metadata?: Record<string, any>;
    jsonSchema?: Record<string, any>;
  }) {
    this.id = params.id || uuidv4();
    this.name = params.name;
    this.description = params.description;
    this.parameters = params.parameters;
    this.handler = params.handler;
    this.metadata = params.metadata;
    this.jsonSchema = params.jsonSchema;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public async execute(args: Record<string, any>): Promise<any> {
    // Validate parameters before execution
    this.validateParameters(args);

    try {
      return await this.handler(args);
    } catch (error) {
      // Re-throw with additional context
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

  public toJsonSchema(): Record<string, any> {
    if (this.jsonSchema) {
      return {
        json: this.jsonSchema,
      };
    }

    // Generate schema based on parameters
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of this.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description || "",
      };

      if (param.enum) {
        properties[param.name].enum = param.enum;
      }

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
}
