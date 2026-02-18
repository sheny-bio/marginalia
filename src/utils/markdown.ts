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
      // 预处理 PDF 引用链接,转换为 HTML 标签避免 marked 处理
      // 匹配格式: [文字 (p.X)](#cite:X:引用文字)
      content = content.replace(
        /\[([^\]]+)\]\(#cite:(\d+):([^)]+)\)/g,
        '<a href="#" class="pdf-cite-link" data-page="$2" data-text="$3" style="color: #D4AF37; text-decoration: none; border-bottom: 1px dashed #D4AF37; cursor: pointer;">$1</a>'
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
