import { APIClient, Message } from "./apiClient";
import { SettingsManager } from "./settingsManager";
import { ChatPanel } from "./chatPanel";
import { getString } from "../utils/locale";

export class TranslationPopup {
  private settingsManager: SettingsManager;
  private chatPanel: ChatPanel;
  private handler: any;

  constructor(settingsManager: SettingsManager, chatPanel: ChatPanel) {
    this.settingsManager = settingsManager;
    this.chatPanel = chatPanel;
  }

  register(): void {
    this.handler = (event: any) => this.onTextSelected(event);
    Zotero.Reader.registerEventListener(
      "renderTextSelectionPopup",
      this.handler,
      addon.data.config.addonID,
    );
  }

  unregister(): void {
    if (this.handler) {
      Zotero.Reader.unregisterEventListener(
        "renderTextSelectionPopup",
        this.handler,
      );
    }
  }

  private async onTextSelected(event: {
    reader: any;
    doc: Document;
    params: { annotation: { text: string } };
    append: (...nodes: Array<Node | string>) => void;
  }): Promise<void> {
    const { reader, doc, params, append } = event;
    const selectedText = params.annotation?.text;
    if (!selectedText?.trim()) return;

    const container = doc.createElement("div");
    container.style.cssText = "display: flex; flex-direction: row; gap: 4px;";

    const btnStyle = `
      display: flex; align-items: center; justify-content: center;
      padding: 4px 12px; background: #171717; color: #fff;
      border: none; border-radius: 6px; cursor: pointer;
      font-size: 13px; font-weight: 500; font-family: inherit;
      transition: background 0.15s;
    `;

    // 翻译按钮
    const translateBtn = doc.createElement("button");
    translateBtn.textContent = getString("translate-button");
    translateBtn.style.cssText = btnStyle;
    translateBtn.addEventListener("mouseenter", () => {
      translateBtn.style.background = "#404040";
    });
    translateBtn.addEventListener("mouseleave", () => {
      translateBtn.style.background = "#171717";
    });

    // 引用按钮
    const quoteBtn = doc.createElement("button");
    quoteBtn.textContent = getString("quote-button");
    quoteBtn.style.cssText = btnStyle;
    quoteBtn.addEventListener("mouseenter", () => {
      if (!quoteBtn.disabled) quoteBtn.style.background = "#404040";
    });
    quoteBtn.addEventListener("mouseleave", () => {
      if (!quoteBtn.disabled) quoteBtn.style.background = "#171717";
    });

    container.appendChild(translateBtn);
    container.appendChild(quoteBtn);
    append(container);

    // 翻译结果容器（按钮行下方）
    const resultContainer = doc.createElement("div");
    resultContainer.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    append(resultContainer);

    // 翻译按钮点击
    translateBtn.addEventListener("click", async () => {
      translateBtn.disabled = true;
      translateBtn.textContent = getString("translate-loading");
      translateBtn.style.cursor = "wait";

      try {
        const attachmentItem = reader._item;
        const parentItem = attachmentItem?.parentItem;
        const title = parentItem?.getField("title") || "";
        const authors =
          parentItem
            ?.getCreators()
            ?.map((a: any) => `${a.firstName} ${a.lastName}`)
            .join(", ") || "";

        const result = await this.translate(selectedText, { title, authors });

        const resultDiv = doc.createElement("div");
        resultDiv.style.cssText = `
          padding: 8px 12px; background: #FAFAFA;
          border: 1px solid #e5e5e5; border-radius: 8px;
          font-size: 13px; line-height: 1.6; color: #171717;
          max-height: 200px; overflow-y: auto;
          user-select: text; cursor: text;
        `;
        resultDiv.textContent = result;
        resultContainer.appendChild(resultDiv);

        translateBtn.textContent = getString("translate-button");
        translateBtn.disabled = false;
        translateBtn.style.cursor = "pointer";
      } catch (error) {
        translateBtn.textContent = getString("translate-error");
        translateBtn.style.background = "#DC2626";
        setTimeout(() => {
          translateBtn.textContent = getString("translate-button");
          translateBtn.style.background = "#171717";
          translateBtn.disabled = false;
          translateBtn.style.cursor = "pointer";
        }, 2000);
      }
    });

    // 引用按钮点击
    quoteBtn.addEventListener("click", () => {
      this.chatPanel.addQuote(selectedText);
      quoteBtn.textContent = getString("quote-added");
      quoteBtn.style.background = "#D4AF37";
      quoteBtn.disabled = true;
      quoteBtn.style.cursor = "default";
      setTimeout(() => {
        quoteBtn.textContent = getString("quote-button");
        quoteBtn.style.background = "#171717";
        quoteBtn.disabled = false;
        quoteBtn.style.cursor = "pointer";
      }, 1000);
    });
  }

  private async translate(
    text: string,
    context: { title: string; authors: string },
  ): Promise<string> {
    const config = await this.settingsManager.getAPIConfig();
    const apiClient = new APIClient(config);

    const messages: Message[] = [
      {
        role: "system",
        content: `你是一个学术论文翻译助手。请将以下学术文本翻译成中文，保持学术术语的准确性。
论文标题: ${context.title}
作者: ${context.authors}
请直接输出翻译结果，不要添加任何解释或前缀。`,
      },
      { role: "user", content: text },
    ];

    return await apiClient.chat(messages);
  }
}
