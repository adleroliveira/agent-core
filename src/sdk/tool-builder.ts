import { Agent } from "@core/domain/agent.entity";
import { ToolParameter } from "@core/domain/tool.entity";

export type ToolInput = {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  enum?: any[];
  default?: any;
  properties?: Record<string, ToolInput>; // For object types
  items?: ToolInput; // For array types
};

export type JSONSchema = {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
  [key: string]: any;
};

export class ToolBuilder {
  private name: string;
  private description: string;
  private inputs: Record<string, ToolInput> = {};
  private jsonSchema?: JSONSchema;

  constructor(name: string) {
    this.name = name;
  }

  describe(description: string) {
    this.description = description;
    return this;
  }

  input(
    name: string,
    type: ToolInput["type"],
    description: string,
    required = true,
    options: Partial<Omit<ToolInput, "type" | "description" | "required">> = {}
  ) {
    this.inputs[name] = { 
      type, 
      description, 
      required,
      ...options
    };
    return this;
  }

  /**
   * Set a complete JSONSchema for the tool
   * @param schema The JSONSchema object
   */
  schema(schema: JSONSchema) {
    this.jsonSchema = schema;
    return this;
  }

  handle(handler: (input: any, agent: Agent) => Promise<any>) {
    if (this.description === undefined) {
      throw new Error("Tool description is required");
    }
    
    // If a JSONSchema is provided, use it directly
    if (this.jsonSchema) {
      return {
        spec: () => ({
          toolSpec: {
            name: this.name,
            description: this.description,
            inputSchema: {
              json: this.jsonSchema
            },
          },
        }),
        run: handler,
        name: this.name,
      };
    }
    
    // Convert ToolInput to ToolParameter format
    const parameters: ToolParameter[] = Object.entries(this.inputs).map(([name, input]) => {
      // Helper function to convert nested ToolInput to ToolParameter
      const convertToToolParameter = (input: ToolInput, paramName: string): ToolParameter => {
        return {
          name: paramName,
          type: input.type,
          description: input.description,
          required: input.required,
          enum: input.enum,
          default: input.default,
          properties: input.properties ? 
            Object.entries(input.properties).reduce((acc, [propName, propValue]) => {
              acc[propName] = convertToToolParameter(propValue, propName);
              return acc;
            }, {} as Record<string, ToolParameter>) : 
            undefined,
          items: input.items ? convertToToolParameter(input.items, `${paramName}_item`) : undefined
        };
      };
      
      return convertToToolParameter(input, name);
    });
    
    return {
      spec: () => ({
        toolSpec: {
          name: this.name,
          description: this.description,
          inputSchema: {
            json: {
              type: "object",
              properties: Object.entries(this.inputs).reduce(
                (acc, [name, input]) => ({
                  ...acc,
                  [name]: {
                    type: input.type,
                    description: input.description,
                    ...(input.enum ? { enum: input.enum } : {}),
                    ...(input.default !== undefined ? { default: input.default } : {}),
                    ...(input.properties ? { properties: input.properties } : {}),
                    ...(input.items ? { items: input.items } : {}),
                  },
                }),
                {}
              ),
              required: Object.entries(this.inputs)
                .filter(([_, input]) => input.required)
                .map(([name]) => name),
            },
          },
        },
      }),
      run: handler,
      name: this.name,
    };
  }
}