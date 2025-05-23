import { Injectable } from "@nestjs/common";
import { Tool, ToolParameter } from "@core/domain/tool.entity";
import { v4 as uuidv4 } from "uuid";
import { search } from "duck-duck-scrape";

interface SearchResponse {
  title: string;
  description: string;
  url: string;
  type: string;
}

@Injectable()
export class InternetSearchTool {
  getTool(): Tool {
    const parameters: ToolParameter[] = [
      {
        name: "query",
        type: "string",
        description: "The search query to find information on the internet",
        required: true,
      },
      {
        name: "maxResults",
        type: "number",
        description: "Maximum number of results to return",
        required: false,
        default: 5,
      },
    ];

    return new Tool({
      id: uuidv4(),
      name: "internet_search",
      directive: `Search the internet for information using DuckDuckGo. This tool can help find current information, facts, and general knowledge that may not be in the agent's knowledge base.`,
      description: "Search the internet for information using DuckDuckGo.",
      parameters,
      handler: this.searchHandler.bind(this),
      systemPrompt: `Use this tool when you need to find information that is:
- Not in your knowledge base
- Time-sensitive or current (e.g., news, recent events)
- Requires verification from multiple sources
- About topics that change frequently (e.g., software versions, current events)
- General knowledge that might be too broad for your knowledge base

Do NOT use this tool for:
- Information you already have in your knowledge base
- Simple calculations or conversions
- Tasks that can be done with other tools
- When you already have the information from previous interactions`
    });
  }

  private async searchHandler(args: Record<string, any>): Promise<SearchResponse[]> {
    try {
      const searchResults = await search(args.query);

      // Transform the results into our expected format
      return searchResults.results
        .slice(0, args.maxResults || 5)
        .map((result) => ({
          title: result.title || "Search Result",
          description: result.description || "",
          url: result.url || "",
          type: "result"
        }));
    } catch (error) {
      throw new Error(`Failed to perform internet search: ${error.message}`);
    }
  }
} 