import { APIClient, Message } from "./apiClient";
import { StorageManager } from "./storageManager";
import { SettingsManager } from "./settingsManager";
import { ZoteroAPI } from "./zoteroAPI";
import { MarkdownRenderer } from "../utils/markdown";
import { ToolCaller, AVAILABLE_TOOLS } from "./toolCaller";

export class ChatPanel {
  private container: HTMLElement | null = null;
  private currentItemID: number | null = null;
  private apiClient: APIClient | null = null;
  private storageManager: StorageManager;
  private settingsManager: SettingsManager;
  private messages: Message[] = [];

  constructor(storageManager: StorageManager, settingsManager: SettingsManager) {
    this.storageManager = storageManager;
    this.settingsManager = settingsManager;
  }

  async register() {
    // @ts-ignore - ItemPaneManager is available in Zotero runtime
    Zotero.ItemPaneManager.registerSection({
      paneID: "marginalia-chat",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: "marginalia-chat-header",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
      },
      onRender: ({ body, item }) => {
        if (!body.querySelector("#marginalia-container")) {
          const container = this.onInit();
          body.appendChild(container);
        }
        this.onItemChange(item);
      },
    });
  }

  private onInit() {
    // @ts-ignore - document is available in browser context
    const container = document.createElement("div");
    container.id = "marginalia-container";
    container.className = "marginalia-container";
    container.innerHTML = `
      <div class="marginalia-messages" id="marginalia-messages"></div>
      <div class="marginalia-input-area">
        <textarea
          id="marginalia-input"
          class="marginalia-input"
          placeholder="Ask about this paper..."
          rows="2"
        ></textarea>
        <button id="marginalia-send" class="marginalia-button">Send</button>
        <button id="marginalia-options" class="marginalia-button" style="width: auto; padding: 8px 12px;">+</button>
      </div>
    `;
    this.container = container;
    this.attachEventListeners();
    return container;
  }

  private onItemChange(item: any) {
    if (item) {
      this.currentItemID = item.id;
      this.loadMessages();
    }
  }

  private onDestroy() {
    this.container = null;
    this.currentItemID = null;
  }

  private attachEventListeners() {
    const sendBtn = this.container?.querySelector("#marginalia-send");
    const input = this.container?.querySelector("#marginalia-input") as HTMLTextAreaElement;

    sendBtn?.addEventListener("click", () => this.sendMessage());
    input?.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.ctrlKey) {
        this.sendMessage();
      }
    });
  }

  private async sendMessage() {
    const input = this.container?.querySelector("#marginalia-input") as HTMLTextAreaElement;
    const message = input?.value.trim();

    if (!message || !this.currentItemID) return;

    input.value = "";
    this.addMessage("user", message);
    this.showLoading();

    try {
      const response = await this.callAPI(message);
      this.removeLoading();
      this.addMessage("assistant", response);
      await this.saveMessage("user", message);
      await this.saveMessage("assistant", response);
    } catch (error) {
      this.removeLoading();
      this.addMessage("assistant", `Error: ${error}`);
    }
  }

  private addMessage(role: string, content: string) {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    // @ts-ignore - document is available in browser context
    const messageEl = document.createElement("div");
    messageEl.className = `marginalia-message ${role}`;

    let renderedContent = content;
    if (role === "assistant") {
      renderedContent = MarkdownRenderer.render(content);
    } else if (role === "system") {
      // 系统消息显示为工具调用结果
      messageEl.className = "marginalia-tool-call";
      renderedContent = this.escapeHtml(content);
    } else {
      renderedContent = this.escapeHtml(content);
    }

    messageEl.innerHTML = `<div class="marginalia-message-content">${renderedContent}</div>`;
    messagesDiv?.appendChild(messageEl);
    (messagesDiv as any)?.scrollTo(0, (messagesDiv as any).scrollHeight);
  }

  private showLoading() {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    // @ts-ignore - document is available in browser context
    const loadingEl = document.createElement("div");
    loadingEl.className = "marginalia-loading";
    loadingEl.id = "marginalia-loading";
    loadingEl.innerHTML = `<div class="marginalia-spinner"></div><span>Thinking...</span>`;
    messagesDiv?.appendChild(loadingEl);
  }

  private removeLoading() {
    const loading = this.container?.querySelector("#marginalia-loading");
    loading?.remove();
  }

  private async callAPI(userMessage: string): Promise<string> {
    if (!this.apiClient) {
      const config = await this.settingsManager.getAPIConfig();
      this.apiClient = new APIClient(config);
    }

    const paperInfo = ZoteroAPI.getPaperInfo(this.currentItemID!);
    const systemPrompt = await this.settingsManager.getSystemPrompt();
    const enableToolCalling = await this.settingsManager.isToolCallingEnabled();

    let systemMessage = `${systemPrompt}\n\nCurrent paper: ${paperInfo?.title || "Unknown"}`;

    if (enableToolCalling) {
      systemMessage += `\n\nYou have access to the following tools:\n${AVAILABLE_TOOLS.map(
        (t) => `- ${t.name}: ${t.description}`
      ).join("\n")}`;
    }

    const messages: Message[] = [
      {
        role: "system",
        content: systemMessage,
      },
      ...this.messages,
      { role: "user", content: userMessage },
    ];

    let fullResponse = "";
    await this.apiClient.chat(messages, (chunk) => {
      fullResponse += chunk;
      this.updateLastMessage(fullResponse);
    });

    // 处理工具调用
    if (enableToolCalling) {
      const toolCalls = ToolCaller.parseToolCalls(fullResponse);
      for (const toolCall of toolCalls) {
        try {
          const result = await ToolCaller.executeTool(toolCall);
          this.addMessage("system", `Tool result for ${toolCall.name}:\n${result}`);
        } catch (error) {
          this.addMessage("system", `Tool error: ${error}`);
        }
      }
    }

    return fullResponse;
  }

  private updateLastMessage(content: string) {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    const messages = messagesDiv?.querySelectorAll(".marginalia-message");
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const contentDiv = lastMessage.querySelector(".marginalia-message-content");
      if (contentDiv) {
        contentDiv.textContent = content;
      }
    }
  }

  private async loadMessages() {
    if (!this.currentItemID) return;

    const loadedMessages = await this.storageManager.getMessages(this.currentItemID);
    this.messages = loadedMessages.map(msg => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    if (messagesDiv) {
      messagesDiv.innerHTML = "";
      for (const msg of this.messages) {
        this.addMessage(msg.role, msg.content);
      }
    }
  }

  private async saveMessage(role: string, content: string) {
    if (!this.currentItemID) return;

    await this.storageManager.saveMessage(this.currentItemID, role, content);
    this.messages.push({ role: role as "user" | "assistant" | "system", content });
  }

  private escapeHtml(text: string): string {
    // @ts-ignore - document is available in browser context
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
