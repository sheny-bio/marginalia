import { getString } from "../utils/locale";
import { APIClient, APIConfig, Message } from "./apiClient";
import { SettingsManager } from "./settingsManager";
import { MarkdownRenderer } from "../utils/markdown";

export interface SaveAsNoteContext {
  messages: { role: string; content: string }[];
  currentItem: any;
  currentItemID: number | null;
  apiClient: APIClient | null;
  settingsManager: SettingsManager;
}

export async function exportAsMarkdown(
  options: { messages: { role: string; content: string }[]; currentItem: any },
  onToast: (msg: string) => void,
): Promise<void> {
  const markdown = generateMarkdownContent(options);
  const title = options.currentItem?.getField?.("title") || "conversation";
  const safeTitle = title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")
    .substring(0, 50);
  const filename = `${safeTitle}_chat_${new Date().toISOString().split("T")[0]}.md`;

  try {
    const path = await new ztoolkit.FilePicker(
      "Save Markdown",
      "save",
      [["Markdown Files (*.md)", "*.md"]],
      filename,
    ).open();

    if (path) {
      await Zotero.File.putContentsAsync(path, markdown);
      onToast(getString("chat-toast-exported"));
    }
  } catch (error) {
    ztoolkit.log("Error exporting markdown:", error);
    onToast(getString("chat-toast-export-failed"));
  }
}

function generateMarkdownContent(options: {
  messages: { role: string; content: string }[];
  currentItem: any;
}): string {
  const title = options.currentItem?.getField?.("title") || "Untitled";
  const date = new Date().toLocaleString();
  let markdown = `# Chat History: ${title}\n\n`;
  markdown += `*Exported on ${date}*\n\n---\n\n`;

  for (const msg of options.messages) {
    if (msg.role === "user") {
      markdown += `## 👤 User\n\n${msg.content}\n\n`;
    } else if (msg.role === "assistant") {
      markdown += `## 🤖 Assistant\n\n${msg.content}\n\n`;
    }
    markdown += "---\n\n";
  }

  return markdown;
}

export function showClearConfirmDialog(
  container: HTMLElement,
  onConfirm: () => Promise<void>,
): void {
  const doc = container.ownerDocument;
  if (!doc) return;

  const overlay = doc.createElement("div");
  overlay.className = "marginalia-dialog-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `;

  const dialog = doc.createElement("div");
  dialog.className = "marginalia-dialog";
  dialog.style.cssText = `
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  `;

  const titleDiv = doc.createElement("div");
  titleDiv.style.cssText =
    "font-size: 16px; font-weight: 600; color: #171717; margin-bottom: 8px;";
  titleDiv.textContent = getString("chat-dialog-clear-title");

  const messageDiv = doc.createElement("div");
  messageDiv.style.cssText =
    "font-size: 14px; color: #6B7280; margin-bottom: 20px; line-height: 1.5;";
  messageDiv.textContent = getString("chat-dialog-clear-message");

  const buttonsDiv = doc.createElement("div");
  buttonsDiv.style.cssText =
    "display: flex; gap: 12px; justify-content: flex-end;";

  const cancelBtn = doc.createElement("button");
  cancelBtn.style.cssText =
    "padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; background: #F5F5F5; color: #171717; border: none; font-family: inherit; transition: background 150ms; display: flex; align-items: center; justify-content: center;";
  cancelBtn.textContent = getString("chat-dialog-cancel");

  const confirmBtn = doc.createElement("button");
  confirmBtn.style.cssText =
    "padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; background: #DC2626; color: #fff; border: none; font-family: inherit; transition: background 150ms; display: flex; align-items: center; justify-content: center;";
  confirmBtn.textContent = getString("chat-dialog-confirm");

  cancelBtn.addEventListener("mouseenter", () => {
    cancelBtn.style.background = "#E5E5E5";
  });
  cancelBtn.addEventListener("mouseleave", () => {
    cancelBtn.style.background = "#F5F5F5";
  });
  confirmBtn.addEventListener("mouseenter", () => {
    confirmBtn.style.background = "#B91C1C";
  });
  confirmBtn.addEventListener("mouseleave", () => {
    confirmBtn.style.background = "#DC2626";
  });

  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(confirmBtn);
  dialog.appendChild(titleDiv);
  dialog.appendChild(messageDiv);
  dialog.appendChild(buttonsDiv);
  overlay.appendChild(dialog);
  container.appendChild(overlay);

  cancelBtn.addEventListener("click", () => {
    overlay.remove();
  });

  confirmBtn.addEventListener("click", async () => {
    await onConfirm();
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

export function showSaveAsNoteDialog(
  container: HTMLElement,
  context: SaveAsNoteContext,
  onToast: (msg: string) => void,
): void {
  const doc = container.ownerDocument as Document;

  const visibleMessages = context.messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  if (visibleMessages.length === 0) {
    onToast(getString("chat-save-note-no-messages"));
    return;
  }

  const overlay = doc.createElement("div");
  overlay.className = "marginalia-dialog-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `;

  const dialog = doc.createElement("div");
  dialog.className = "marginalia-dialog";
  dialog.style.cssText = `
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    max-width: 360px;
    width: 90%;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  `;

  const titleDiv = doc.createElement("div");
  titleDiv.style.cssText =
    "font-size: 16px; font-weight: 600; color: #171717; margin-bottom: 4px;";
  titleDiv.textContent = getString("chat-save-note-dialog-title");

  const messageDiv = doc.createElement("div");
  messageDiv.style.cssText =
    "font-size: 13px; color: #6B7280; margin-bottom: 16px;";
  messageDiv.textContent = getString("chat-save-note-dialog-message");

  const cardsDiv = doc.createElement("div");
  cardsDiv.style.cssText =
    "display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;";

  function createCard(
    titleText: string,
    descText: string,
    onClick: () => void,
  ): HTMLElement {
    const card = doc.createElement("div");
    card.style.cssText = `
      padding: 12px 14px;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      background: #FAFAFA;
    `;
    const cardTitle = doc.createElement("div");
    cardTitle.style.cssText =
      "font-size: 14px; font-weight: 500; color: #171717; margin-bottom: 3px;";
    cardTitle.textContent = titleText;
    const cardDesc = doc.createElement("div");
    cardDesc.style.cssText =
      "font-size: 12px; color: #6B7280; line-height: 1.4;";
    cardDesc.textContent = descText;
    card.appendChild(cardTitle);
    card.appendChild(cardDesc);
    card.addEventListener("mouseenter", () => {
      card.style.borderColor = "#BFDBFE";
      card.style.background = "#EFF6FF";
    });
    card.addEventListener("mouseleave", () => {
      card.style.borderColor = "#E5E7EB";
      card.style.background = "#FAFAFA";
    });
    card.addEventListener("click", onClick);
    return card;
  }

  function showLoading(msg: string) {
    dialog.innerHTML = "";
    const loadingDiv = doc.createElement("div");
    loadingDiv.style.cssText =
      "padding: 24px 0; font-size: 14px; color: #6B7280; text-align: center;";
    loadingDiv.textContent = msg;
    dialog.appendChild(loadingDiv);
  }

  function showSuccess(parentTitle: string) {
    const displayTitle =
      parentTitle.length > 20
        ? parentTitle.substring(0, 20) + "..."
        : parentTitle;
    dialog.innerHTML = "";
    dialog.style.textAlign = "center";

    const iconDiv = doc.createElement("div");
    iconDiv.style.cssText =
      "width: 48px; height: 48px; border-radius: 50%; background: #DCFCE7; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;";
    iconDiv.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    const titleEl = doc.createElement("div");
    titleEl.style.cssText =
      "font-size: 16px; font-weight: 600; color: #171717; margin-bottom: 8px;";
    titleEl.textContent = getString("chat-save-note-success-title");

    const locationEl = doc.createElement("div");
    locationEl.style.cssText =
      "font-size: 13px; color: #6B7280; margin-bottom: 20px; line-height: 1.5; word-break: break-all;";
    locationEl.textContent = getString("chat-save-note-success-location", {
      args: { title: displayTitle },
    });

    const okBtn = doc.createElement("button");
    okBtn.style.cssText =
      "padding: 10px 32px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; background: #171717; color: #fff; border: none; font-family: inherit; transition: background 150ms;";
    okBtn.textContent = getString("chat-save-note-ok");
    okBtn.addEventListener("mouseenter", () => {
      okBtn.style.background = "#404040";
    });
    okBtn.addEventListener("mouseleave", () => {
      okBtn.style.background = "#171717";
    });
    okBtn.addEventListener("click", () => overlay.remove());

    dialog.appendChild(iconDiv);
    dialog.appendChild(titleEl);
    dialog.appendChild(locationEl);
    dialog.appendChild(okBtn);
  }

  const directCard = createCard(
    getString("chat-save-note-direct"),
    getString("chat-save-note-direct-desc"),
    async () => {
      showLoading(getString("chat-save-note-saving"));
      try {
        const parentTitle = await saveNoteDirectly(context);
        showSuccess(parentTitle);
      } catch {
        overlay.remove();
        onToast(getString("chat-toast-note-save-failed"));
      }
    },
  );

  const summaryCard = createCard(
    getString("chat-save-note-summary"),
    getString("chat-save-note-summary-desc"),
    async () => {
      showLoading(getString("chat-save-note-summarizing"));
      try {
        const parentTitle = await saveNoteWithSummary(context);
        showSuccess(parentTitle);
      } catch {
        overlay.remove();
        onToast(getString("chat-toast-note-save-failed"));
      }
    },
  );

  const cancelBtn = doc.createElement("button");
  cancelBtn.style.cssText =
    "width: 100%; padding: 10px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; background: #F5F5F5; color: #171717; border: none; font-family: inherit; transition: background 150ms;";
  cancelBtn.textContent = getString("chat-dialog-cancel");
  cancelBtn.addEventListener("mouseenter", () => {
    cancelBtn.style.background = "#E5E5E5";
  });
  cancelBtn.addEventListener("mouseleave", () => {
    cancelBtn.style.background = "#F5F5F5";
  });
  cancelBtn.addEventListener("click", () => overlay.remove());

  cardsDiv.appendChild(directCard);
  cardsDiv.appendChild(summaryCard);
  dialog.appendChild(titleDiv);
  dialog.appendChild(messageDiv);
  dialog.appendChild(cardsDiv);
  dialog.appendChild(cancelBtn);
  overlay.appendChild(dialog);
  container.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

async function saveNoteDirectly(context: SaveAsNoteContext): Promise<string> {
  if (!context.currentItemID) throw new Error("No item selected");
  const title = context.currentItem?.getField?.("title") || "Untitled";
  const html = conversationToHtml(context.messages, title);
  await writeZoteroNote(html, context.currentItemID);
  return title;
}

async function saveNoteWithSummary(
  context: SaveAsNoteContext,
): Promise<string> {
  if (!context.currentItemID) throw new Error("No item selected");
  try {
    const title = context.currentItem?.getField?.("title") || "Untitled";
    let client = context.apiClient;
    if (!client) {
      const config: APIConfig = await context.settingsManager.getAPIConfig();
      client = new APIClient(config);
    }

    const visibleMessages = context.messages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    const conversationText = visibleMessages
      .map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`)
      .join("\n\n");

    const summaryPrompt = `请根据以下对话记录，生成一份结构化的阅读笔记。

## 论文信息
标题：${title}

## 要求
1. 首先梳理用户在对话中关注的核心问题和讨论重点
2. 针对每个问题，结合 AI 的回答，进行详细阐述
3. 最后补充论文中值得记录的其他重要内容（方法、结论、局限性等）

## 输出格式
使用 Markdown 格式，包含：
- 一级标题：笔记主题（根据对话内容提炼）
- 二级标题：各核心问题
- 正文：详细说明
- 最后一节"## 补充要点"

## 对话记录
${conversationText}

请用中文输出，专业术语保留英文原文。`;

    const messages: Message[] = [
      {
        role: "system",
        content:
          "你是一个专业的学术笔记助手，请根据以下对话内容生成结构化阅读笔记。",
      },
      { role: "user", content: summaryPrompt },
    ];

    const summary = await client.chat(messages);
    const html = summaryToHtml(summary, title);
    await writeZoteroNote(html, context.currentItemID);
    return title;
  } catch (error) {
    ztoolkit.log("[SaveNote] Summary save failed:", error);
    throw error;
  }
}

function conversationToHtml(
  messages: { role: string; content: string }[],
  title: string,
): string {
  const date = new Date().toLocaleString();
  const visibleMessages = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  let body = "";
  for (const msg of visibleMessages) {
    if (msg.role === "user") {
      body += `<blockquote><p><strong>用户：</strong>${escapeHtml(msg.content)}</p></blockquote>`;
    } else {
      body += `<div>${MarkdownRenderer.render(msg.content)}</div>`;
    }
    body += "<hr />";
  }
  return `<div class="zotero-note znv1"><h1>对话记录：${escapeHtml(title)}</h1><p>导出时间：${date}</p><hr />${body}</div>`;
}

function summaryToHtml(markdown: string, title: string): string {
  const date = new Date().toLocaleString();
  const content = MarkdownRenderer.render(markdown);
  return `<div class="zotero-note znv1"><h1>阅读笔记：${escapeHtml(title)}</h1><p>由 Marginalia 生成，时间：${date}</p><hr />${content}</div>`;
}

async function writeZoteroNote(
  html: string,
  parentItemID: number,
): Promise<void> {
  const noteItem = new Zotero.Item("note");
  noteItem.parentID = parentItemID;
  noteItem.setNote(html);
  await noteItem.saveTx();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function copyToClipboard(
  text: string,
  doc: Document,
  onToast: (msg: string) => void,
): Promise<void> {
  ztoolkit.log("[Copy] Starting copy, text length:", text.length);
  ztoolkit.log("[Copy] Text preview:", text.substring(0, 100));

  // 方法1: Zotero.Utilities.Internal.copyTextToClipboard
  try {
    ztoolkit.log("[Copy] Trying Zotero.Utilities.Internal.copyTextToClipboard");
    if ((Zotero.Utilities as any).Internal?.copyTextToClipboard) {
      (Zotero.Utilities as any).Internal.copyTextToClipboard(text);
      ztoolkit.log(
        "[Copy] Zotero.Utilities.Internal.copyTextToClipboard succeeded",
      );
      onToast("Copied!");
      return;
    } else {
      ztoolkit.log("[Copy] copyTextToClipboard not available");
    }
  } catch (error) {
    ztoolkit.log(
      "[Copy] Zotero.Utilities.Internal.copyTextToClipboard failed:",
      error,
    );
  }

  // 方法2: nsIClipboardHelper
  try {
    ztoolkit.log("[Copy] Trying nsIClipboardHelper");
    const clipboardService = (Components.classes as any)[
      "@mozilla.org/widget/clipboardhelper;1"
    ]?.getService((Components.interfaces as any).nsIClipboardHelper);
    ztoolkit.log("[Copy] clipboardService:", clipboardService);

    if (clipboardService) {
      clipboardService.copyString(text);
      ztoolkit.log("[Copy] nsIClipboardHelper succeeded");
      onToast("Copied!");
      return;
    } else {
      ztoolkit.log("[Copy] nsIClipboardHelper not available");
    }
  } catch (error) {
    ztoolkit.log("[Copy] nsIClipboardHelper failed:", error);
  }

  // 方法3: document.execCommand (旧方法但可能有效)
  try {
    ztoolkit.log("[Copy] Trying document.execCommand");
    if (doc.body) {
      const textarea = doc.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      doc.body.appendChild(textarea);
      textarea.select();
      const result = doc.execCommand("copy");
      doc.body.removeChild(textarea);
      ztoolkit.log("[Copy] execCommand result:", result);
      if (result) {
        onToast("Copied!");
        return;
      }
    }
  } catch (error) {
    ztoolkit.log("[Copy] execCommand failed:", error);
  }

  ztoolkit.log("[Copy] All methods failed");
  onToast("Copy failed");
}
