export class ChatPanel {
  private container: HTMLElement | null = null;
  private currentItemID: number | null = null;

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
      this.addMessage("assistant", response);
      await this.saveMessage("user", message);
      await this.saveMessage("assistant", response);
    } catch (error) {
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

  private async callAPI(message: string): Promise<string> {
    return "This is a placeholder response.";
  }

  private async loadMessages() {
    // Placeholder for loading messages from storage
  }

  private async saveMessage(role: string, content: string) {
    // Placeholder for saving messages to storage
  }

  private escapeHtml(text: string): string {
    // @ts-ignore - document is available in browser context
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
