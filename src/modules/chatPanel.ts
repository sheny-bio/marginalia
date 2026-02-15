import { APIClient, Message } from "./apiClient";
import { StorageManager } from "./storageManager";
import { SettingsManager } from "./settingsManager";
import { ZoteroAPI } from "./zoteroAPI";

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
    // @ts-ignore - ItemPane is available in Zotero runtime
    ztoolkit.ItemPane.registerSection({
      paneType: "item",
      tabLabel: "AI Chat",
      sectionID: "marginalia-chat",
      onInit: () => this.onInit(),
      onItemChange: (item: any) => this.onItemChange(item),
      onDestroy: () => this.onDestroy(),
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
    messageEl.innerHTML = `<div class="marginalia-message-content">${this.escapeHtml(content)}</div>`;
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

    const messages: Message[] = [
      {
        role: "system",
        content: `${systemPrompt}\n\nCurrent paper: ${paperInfo?.title || "Unknown"}`,
      },
      ...this.messages,
      { role: "user", content: userMessage },
    ];

    let fullResponse = "";
    await this.apiClient.chat(messages, (chunk) => {
      fullResponse += chunk;
      this.updateLastMessage(fullResponse);
    });

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
