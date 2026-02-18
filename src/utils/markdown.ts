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
      // 预处理 PDF 引用链接,在引用后添加可点击的页码标记
      // 匹配格式: [文字 (p.X)](#cite:X:引用文字)
      content = content.replace(
        /\[([^\]]+?)\s*\(p\.(\d+)\)\]\(#cite:(\d+):([^)]+)\)/g,
        '$1 <span class="pdf-cite-link" data-page="$3" data-text="$4" style="display: inline; color: #E5A700; cursor: pointer; font-size: 0.85em; font-weight: 500;">[p.$2]</span>'
      );

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
