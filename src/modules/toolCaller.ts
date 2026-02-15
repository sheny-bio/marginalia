import { ZoteroAPI } from "./zoteroAPI";

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export const AVAILABLE_TOOLS: Tool[] = [
  {
    name: "get_paper_info",
    description: "获取指定论文的基本信息（标题、作者、摘要等）",
    parameters: {
      itemID: "number",
    },
  },
  {
    name: "get_paper_content",
    description: "获取指定论文的全文内容",
    parameters: {
      itemID: "number",
    },
  },
  {
    name: "search_papers",
    description: "在当前库中搜索相关论文",
    parameters: {
      query: "string",
      limit: "number",
    },
  },
];

export class ToolCaller {
  static async executeTool(toolCall: ToolCall): Promise<string> {
    switch (toolCall.name) {
      case "get_paper_info":
        return this.getPaperInfo(toolCall.arguments.itemID);
      case "get_paper_content":
        return await this.getPaperContent(toolCall.arguments.itemID);
      case "search_papers":
        return this.searchPapers(toolCall.arguments.query, toolCall.arguments.limit || 10);
      default:
        return `Unknown tool: ${toolCall.name}`;
    }
  }

  private static getPaperInfo(itemID: number): string {
    const info = ZoteroAPI.getPaperInfo(itemID);
    if (!info) return "Paper not found";
    return JSON.stringify(info, null, 2);
  }

  private static async getPaperContent(itemID: number): Promise<string> {
    return await ZoteroAPI.getPaperContent(itemID);
  }

  private static searchPapers(query: string, limit: number): string {
    const results = ZoteroAPI.searchPapers(query, limit);
    return JSON.stringify(results, null, 2);
  }

  static parseToolCalls(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const toolCallPattern = /<tool_call>[\s\S]*?<\/tool_call>/g;
    const matches = content.match(toolCallPattern);

    if (!matches) return toolCalls;

    for (const match of matches) {
      try {
        const nameMatch = match.match(/<name>(.*?)<\/name>/);
        const argsMatch = match.match(/<arguments>([\s\S]*?)<\/arguments>/);

        if (nameMatch && argsMatch) {
          const name = nameMatch[1];
          const args = JSON.parse(argsMatch[1]);
          toolCalls.push({ name, arguments: args });
        }
      } catch (error) {
        ztoolkit.log("Error parsing tool call:", error);
      }
    }

    return toolCalls;
  }
}
