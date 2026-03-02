import { getString } from "../utils/locale";

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
