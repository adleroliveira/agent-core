export type ToolInput = {
  type: "string" | "number" | "boolean" | "object" | "array";
  items?: {
    type: "string" | "number" | "boolean" | "object";
  };
  description: string;
  required?: boolean;
};

export class ToolBuilder {
  private name: string;
  private description: string;
  private inputs: Record<string, ToolInput> = {};

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
    items?: ToolInput["items"]
  ) {
    this.inputs[name] = { type, description, required };
    if (type === "array" && items) {
      this.inputs[name].items = items;
    }
    return this;
  }

  handle(handler: (input: any) => Promise<any>) {
    if (this.description === undefined) {
      throw new Error("Tool description is required");
    }
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
                    ...(input.type === "array" && input.items
                      ? { items: input.items }
                      : {}),
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