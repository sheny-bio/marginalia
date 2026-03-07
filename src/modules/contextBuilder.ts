import { ToolDefinition, ContentPart } from "./apiClient";
import { ZoteroAPI } from "./zoteroAPI";
import { getString } from "../utils/locale";

export class ContextBuilder {
  async build(options: {
    itemID: number;
    quotes: string[];
    linkedCollection: { id: number; name: string } | null;
    systemPrompt: string;
    onStatusUpdate?: (status: string) => void;
    enableVision?: boolean;
    pagedContent?: string | null;
  }): Promise<{ systemMessage: string; tools: ToolDefinition[] }> {
    const paperInfo = ZoteroAPI.getPaperInfo(options.itemID);
    const isVisionMode = !!options.enableVision && !!options.pagedContent;

    let contentText: string | null = null;
    if (isVisionMode) {
      contentText = options.pagedContent!;
    } else {
      contentText = await ZoteroAPI.getPaperContent(options.itemID);
    }

    if (!contentText) {
      throw new Error(getString("chat-no-pdf-content"));
    }

    const truncatedContent =
      contentText.length > 50000
        ? contentText.substring(0, 50000) +
          "\n\n[Content truncated due to length...]"
        : contentText;

    let systemMessage = `${options.systemPrompt}

当前论文信息：
- 标题：${paperInfo?.title || "未知"}
- 作者：${paperInfo?.authors?.map((a: any) => `${a.firstName} ${a.lastName}`).join(", ") || "未知"}
- 年份：${paperInfo?.year || "未知"}
- 摘要：${paperInfo?.abstract || "暂无摘要"}

论文全文内容：
${truncatedContent}`;

    if (isVisionMode) {
      systemMessage += `\n\n注意：论文全文按 [Page X] 标记分页。当用户询问图表、图片或公式时，根据上下文判断其所在页码，使用 get_page_image 工具获取该页面图片进行分析。`;
    }

    if (options.quotes.length > 0) {
      systemMessage += `\n\n用户引用了论文中的以下段落：\n`;
      options.quotes.forEach((q, i) => {
        systemMessage += `--- 引用 ${i + 1} ---\n${q}\n`;
      });
      systemMessage += `\n用户正在针对以上引用内容提问，请重点围绕这些段落进行回答。`;
    }

    if (options.linkedCollection) {
      const collectionItems = ZoteroAPI.getCollectionItems(
        options.linkedCollection.id,
      );
      if (collectionItems.length > 0) {
        systemMessage += `\n\n用户已关联文献集合「${options.linkedCollection.name}」，包含以下 ${collectionItems.length} 篇文献，请在回答时参考这些文献信息：\n`;
        collectionItems.forEach((item) => {
          systemMessage += `\n[${item.index}] ${item.title}\n`;
          systemMessage += `   作者：${item.authors}（${item.year}）\n`;
          if (item.abstract) {
            systemMessage += `   摘要：${item.abstract}\n`;
          }
        });
      }
    }

    systemMessage += `\n\n请使用标准 Markdown 格式回复。`;

    return {
      systemMessage,
      tools: this.getTools(options.enableVision),
    };
  }

  getTools(enableVision?: boolean): ToolDefinition[] {
    const tools: ToolDefinition[] = [
      {
        type: "function",
        function: {
          name: "get_paper_content",
          description:
            "根据文献标题在Zotero数据库中搜索文献，并返回其全文内容。" +
            "当用户询问除当前阅读论文之外的其他文献的详细内容、方法、结论等信息时，使用此工具获取相关文献的全文。",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "要查询的文献标题或标题关键词",
              },
            },
            required: ["title"],
          },
        },
      },
    ];

    if (enableVision) {
      tools.push({
        type: "function",
        function: {
          name: "get_page_image",
          description:
            "获取 PDF 指定页面的图片。当用户询问论文中的图表、图片、公式或视觉元素时，" +
            "根据全文中的 [Page X] 标记判断目标所在页码，调用此工具获取该页面的图片进行分析。",
          parameters: {
            type: "object",
            properties: {
              page_number: {
                type: "number",
                description: "要获取的页码（从1开始）",
              },
            },
            required: ["page_number"],
          },
        },
      });
    }

    return tools;
  }

  async executeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    onStatusUpdate?: (status: string) => void,
    onGetPageImage?: (pageNumber: number) => Promise<string | null>,
  ): Promise<string | ContentPart[]> {
    if (toolName === "get_paper_content") {
      const title = toolArgs.title as string | undefined;
      if (!title) {
        return "错误：缺少文献标题参数（title）";
      }

      onStatusUpdate?.(`📄 正在搜索文献: "${title}"...`);
      const results = await ZoteroAPI.searchPapers(title, 5);

      if (!results || results.length === 0) {
        return `未找到标题包含"${title}"的文献，请尝试使用不同的关键词。`;
      }

      const bestMatch = results[0];
      if (!bestMatch) {
        return `未找到标题包含"${title}"的文献。`;
      }

      onStatusUpdate?.(`📖 正在提取文献全文: "${bestMatch.title}"...`);

      const content = await ZoteroAPI.getPaperContent(bestMatch.id);
      if (!content) {
        return (
          `找到文献《${bestMatch.title}》，但无法获取其全文内容。` +
          `（可能原因：未导入PDF附件，或PDF尚未建立全文索引）`
        );
      }

      const truncated =
        content.length > 30000
          ? content.substring(0, 30000) + "\n\n[内容因长度限制被截断...]"
          : content;

      return `文献《${bestMatch.title}》全文内容：\n\n${truncated}`;
    }

    if (toolName === "get_page_image") {
      const pageNumber = toolArgs.page_number as number | undefined;
      if (!pageNumber || pageNumber < 1) {
        return "错误：请提供有效的页码（从1开始）";
      }

      onStatusUpdate?.(`🖼️ 正在渲染第 ${pageNumber} 页图片...`);

      if (!onGetPageImage) {
        return "当前无法获取页面图片，请确保 PDF 阅读器处于打开状态。";
      }

      const dataUrl = await onGetPageImage(pageNumber);
      if (!dataUrl) {
        return `无法渲染第 ${pageNumber} 页，请检查页码是否有效且 PDF 阅读器已打开。`;
      }

      return [
        { type: "text", text: `以下是论文第 ${pageNumber} 页的图片：` },
        {
          type: "image_url",
          image_url: { url: dataUrl, detail: "high" },
        },
      ] as ContentPart[];
    }

    return `未知工具: ${toolName}`;
  }
}
