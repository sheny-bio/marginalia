import { APIClient, Message } from "./apiClient";
import { StorageManager } from "./storageManager";
import { SettingsManager } from "./settingsManager";
import { ZoteroAPI } from "./zoteroAPI";
import { MarkdownRenderer } from "../utils/markdown";
import { ToolCaller, ToolCall, AVAILABLE_TOOLS } from "./toolCaller";

interface StoredMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
}

export class ChatPanel {
  private container: HTMLElement | null = null;
  private currentItemID: number | null = null;
  private apiClient: APIClient | null = null;
  private storageManager: StorageManager;
  private settingsManager: SettingsManager;
  private messages: StoredMessage[] = [];

  constructor(storageManager: StorageManager, settingsManager: SettingsManager) {
    this.storageManager = storageManager;
    this.settingsManager = settingsManager;
  }

  async register() {
    Zotero.ItemPaneManager.registerSection({
      paneID: "marginalia-chat",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: "marginalia-chat-header",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
      },
      sidenav: {
        l10nID: "marginalia-chat-sidenav",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
      },
      onRender: ({ body, item }) => {
        // 设置 body 及其父元素的样式以确保正确显示
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.height = "100%";
        body.style.overflow = "hidden";

        // 确保父容器也有正确的高度
        const parent = body.parentElement as HTMLElement | null;
        if (parent) {
          parent.style.height = "100%";
          parent.style.display = "flex";
          parent.style.flexDirection = "column";
        }

        if (!body.querySelector("#marginalia-container")) {
          const doc = body.ownerDocument!;
          const container = doc.createElement("div");
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
          body.appendChild(container);
          this.attachEventListeners();
        }
        this.onItemChange(item);
      },
    });
  }

  private onInit() {
    // @ts-expect-error - document is available in browser context
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
      const { response, toolCalls } = await this.callAPI(message);
      this.removeLoading();
      this.addMessage("assistant", response);
      await this.saveMessage("user", message);
      await this.saveMessage("assistant", response, toolCalls.length > 0 ? toolCalls : undefined);
    } catch (error) {
      this.removeLoading();
      this.addMessage("assistant", `Error: ${error}`);
    }
  }

  private addMessage(role: string, content: string, toolCall?: ToolCall, toolResult?: string) {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    // @ts-expect-error - document is available in browser context
    const messageEl = document.createElement("div");

    if (toolCall && toolResult !== undefined) {
      // 工具调用显示为可折叠卡片
      messageEl.className = "marginalia-tool-call";
      messageEl.innerHTML = `
        <div class="marginalia-tool-call-header">
          <svg class="marginalia-tool-call-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span class="marginalia-tool-call-name">${this.escapeHtml(toolCall.name)}</span>
          <span class="marginalia-tool-call-status">completed</span>
        </div>
        <div class="marginalia-tool-call-body">
          <div class="marginalia-tool-call-args">Arguments: ${this.escapeHtml(JSON.stringify(toolCall.arguments))}</div>
          <div class="marginalia-tool-call-result">${this.escapeHtml(toolResult)}</div>
        </div>
      `;
      // 添加折叠功能
      const header = messageEl.querySelector(".marginalia-tool-call-header");
      header?.addEventListener("click", () => {
        messageEl.classList.toggle("collapsed");
      });
    } else {
      messageEl.className = `marginalia-message ${role}`;
      let renderedContent = content;
      if (role === "assistant") {
        renderedContent = MarkdownRenderer.render(content);
      } else {
        renderedContent = this.escapeHtml(content);
      }
      messageEl.innerHTML = `<div class="marginalia-message-content">${renderedContent}</div>`;
    }

    messagesDiv?.appendChild(messageEl);
    (messagesDiv as any)?.scrollTo(0, (messagesDiv as any).scrollHeight);
  }

  private showLoading() {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    // @ts-expect-error - document is available in browser context
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

  private async callAPI(userMessage: string): Promise<{ response: string; toolCalls: ToolCall[] }> {
    if (!this.apiClient) {
      const config = await this.settingsManager.getAPIConfig();
      this.apiClient = new APIClient(config);
    }

    const paperInfo = ZoteroAPI.getPaperInfo(this.currentItemID!);
    const systemPrompt = await this.settingsManager.getSystemPrompt();
    const enableToolCalling = await this.settingsManager.isToolCallingEnabled();

    let systemMessage = `${systemPrompt}\n\nCurrent paper: ${paperInfo?.title || "Unknown"}\nCurrent paper ID: ${this.currentItemID}`;

    if (enableToolCalling) {
      systemMessage += `\n\nYou have access to the following tools. To use a tool, wrap your call in XML tags like this:
<tool_call>
<name>tool_name</name>
<arguments>{"param": "value"}</arguments>
</tool_call>

Available tools:
${AVAILABLE_TOOLS.map((t) => `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`).join("\n")}`;
    }

    const messages: Message[] = [
      {
        role: "system",
        content: systemMessage,
      },
      ...this.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    let fullResponse = "";
    await this.apiClient.chat(messages, (chunk) => {
      fullResponse += chunk;
      this.updateLastMessage(fullResponse);
    });

    const executedToolCalls: ToolCall[] = [];

    // 处理工具调用
    if (enableToolCalling) {
      const toolCalls = ToolCaller.parseToolCalls(fullResponse);
      for (const toolCall of toolCalls) {
        try {
          const result = await ToolCaller.executeTool(toolCall);
          this.addMessage("system", result, toolCall, result);
          executedToolCalls.push(toolCall);
        } catch (error) {
          this.addMessage("system", `Error: ${error}`, toolCall, `Error: ${error}`);
        }
      }
    }

    return { response: fullResponse, toolCalls: executedToolCalls };
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
    this.messages = loadedMessages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      toolCalls: msg.toolCalls,
    }));
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    if (messagesDiv) {
      messagesDiv.innerHTML = "";
      for (const msg of this.messages) {
        this.addMessage(msg.role, msg.content);
        // 如果有工具调用，显示工具调用卡片
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const toolCall of msg.toolCalls) {
            this.addMessage("system", "", toolCall, "Result loaded from history");
          }
        }
      }
    }
  }

  private async saveMessage(role: string, content: string, toolCalls?: ToolCall[]) {
    if (!this.currentItemID) return;

    await this.storageManager.saveMessage(this.currentItemID, role, content, toolCalls);
    this.messages.push({
      role: role as "user" | "assistant" | "system",
      content,
      toolCalls,
    });
  }

  private escapeHtml(text: string): string {
    // @ts-expect-error - document is available in browser context
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
