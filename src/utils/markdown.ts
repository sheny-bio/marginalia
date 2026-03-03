import { marked } from "marked";
import { createKaTeXExtension } from "./katex-extension";

export class MarkdownRenderer {
  static initialize() {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    // 注册 KaTeX 扩展
    marked.use(createKaTeXExtension());
  }

  static render(content: string): string {
    try {
      let html = marked(content) as string;
      // 确保所有自闭合标签符合 XHTML 规范
      html = html.replace(/<hr>/g, "<hr />");
      html = html.replace(/<br>/g, "<br />");
      html = html.replace(/<img([^>]*)>/g, "<img$1 />");

      return html;
    } catch (error) {
      ztoolkit.log("Markdown rendering error:", error);
      return content;
    }
  }

  static renderToPlainText(content: string): string {
    const html = this.render(content);
    // @ts-expect-error - document is available in browser context
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || "";
  }
}
