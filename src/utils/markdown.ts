import { marked } from "marked";

export class MarkdownRenderer {
  static initialize() {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  static render(content: string): string {
    try {
      return marked(content) as string;
    } catch (error) {
      ztoolkit.log("Markdown rendering error:", error);
      return content;
    }
  }

  static renderToPlainText(content: string): string {
    const html = this.render(content);
    // @ts-ignore - document is available in browser context
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || "";
  }
}
