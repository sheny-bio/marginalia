/**
 * KaTeX 扩展：为 Marked 添加数学公式支持
 * @file src/utils/katex-extension.ts
 */
import katex from "katex";
import type { MarkedExtension, Tokens } from "marked";

export interface MathToken extends Tokens.Generic {
  type: "math";
  raw: string;
  text: string;
  displayMode: boolean;
}

/**
 * 创建 KaTeX Marked 扩展
 */
export function createKaTeXExtension(): MarkedExtension {
  return {
    extensions: [
      // 块级公式：$$...$$
      {
        name: "math",
        level: "block" as const,
        start(src: string) {
          return src.indexOf("$$");
        },
        tokenizer(src: string): MathToken | undefined {
          const match = /^\$\$\n?([\s\S]+?)\n?\$\$/.exec(src);
          if (match) {
            return {
              type: "math",
              raw: match[0],
              text: match[1].trim(),
              displayMode: true,
            };
          }
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          return renderMath(token as MathToken);
        },
      },
      // 行内公式：$...$
      {
        name: "inlineMath",
        level: "inline" as const,
        start(src: string) {
          return src.indexOf("$");
        },
        tokenizer(src: string): MathToken | undefined {
          // 避免匹配 $$，优先由块级处理
          // eslint-disable-next-line no-useless-escape
          const match = /^\$(?!\$)([^\$\n]+?)\$/.exec(src);
          if (match) {
            return {
              type: "math",
              raw: match[0],
              text: match[1],
              displayMode: false,
            };
          }
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          return renderMath(token as MathToken);
        },
      },
    ],
  };
}

/**
 * 渲染数学公式
 */
function renderMath(token: MathToken): string {
  try {
    const html = katex.renderToString(token.text, {
      displayMode: token.displayMode,
      throwOnError: false, // 错误时显示为文本而非抛出异常
      output: "html", // 仅 HTML，避免 MathML 兼容性问题
      trust: false, // 安全性：禁用 \includegraphics 等命令
      strict: "warn", // 对非标准 LaTeX 给出警告
    });
    return makeXHTMLCompliant(html);
  } catch (e) {
    ztoolkit.log("KaTeX render error:", e);
    return `<span class="katex-error">${escapeHtml(token.text)}</span>`;
  }
}

/**
 * 修复 KaTeX 生成的 HTML 以符合 XHTML 规范
 * 主要处理 SVG 元素的自闭合标签
 */
function makeXHTMLCompliant(html: string): string {
  return html
    .replace(/<use([^>]*[^/])>/g, "<use$1 />")
    .replace(/<path([^>]*[^/])>/g, "<path$1 />")
    .replace(/<line([^>]*[^/])>/g, "<line$1 />")
    .replace(/<circle([^>]*[^/])>/g, "<circle$1 />")
    .replace(/<rect([^>]*[^/])>/g, "<rect$1 />")
    .replace(/<polygon([^>]*[^/])>/g, "<polygon$1 />");
}

/**
 * HTML 转义（用于错误显示）
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
