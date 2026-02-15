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
  private inputElement: HTMLTextAreaElement | null = null;
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
        // 设置 body 样式
        body.style.cssText = `
          display: flex !important;
          flex-direction: column !important;
          height: 500px !important;
          min-height: 300px !important;
          max-height: 100% !important;
          overflow: hidden !important;
        `;

        if (!body.querySelector("#marginalia-container")) {
          const doc = body.ownerDocument!;

          // 创建容器
          const container = doc.createElement("div");
          container.id = "marginalia-container";
          container.className = "marginalia-container";
          container.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            overflow: hidden !important;
          `;

          // 创建消息区域
          const messagesDiv = doc.createElement("div");
          messagesDiv.id = "marginalia-messages";
          messagesDiv.className = "marginalia-messages";
          messagesDiv.style.cssText = "flex: 1; overflow-y: auto; min-height: 100px; padding: 12px;";

          // 创建输入区域
          const inputArea = doc.createElement("div");
          inputArea.className = "marginalia-input-area";
          inputArea.style.cssText = "flex-shrink: 0; padding: 12px; background: #fff; border-top: 1px solid #e5e5e5; display: flex; gap: 8px; align-items: flex-end;";

          // 创建输入框
          const textarea = doc.createElement("textarea") as HTMLTextAreaElement;
          textarea.id = "marginalia-input";
          textarea.className = "marginalia-input";
          textarea.placeholder = "Ask about this paper...";
          textarea.rows = 1;
          textarea.style.cssText = "flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; resize: none; font-size: 14px; font-family: inherit;";
          this.inputElement = textarea;

          // 创建发送按钮
          const sendBtn = doc.createElement("button");
          sendBtn.id = "marginalia-send";
          sendBtn.className = "marginalia-button";
          sendBtn.textContent = "Send";
          sendBtn.style.cssText = "padding: 10px 16px; background: #171717; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;";

          // 创建选项按钮
          const optionsBtn = doc.createElement("button");
          optionsBtn.id = "marginalia-options";
          optionsBtn.className = "marginalia-button marginalia-button-options";
          optionsBtn.textContent = "+";
          optionsBtn.style.cssText = "padding: 10px 12px; background: #f5f5f5; color: #171717; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: 14px;";

          // 直接绑定事件监听器
          sendBtn.addEventListener("click", () => {
            ztoolkit.log("Send button clicked");
            this.sendMessage();
          });

          textarea.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              this.sendMessage();
            }
          });

          // 组装 DOM
          inputArea.appendChild(textarea);
          inputArea.appendChild(sendBtn);
          inputArea.appendChild(optionsBtn);
          container.appendChild(messagesDiv);
          container.appendChild(inputArea);

          this.container = container;
          body.appendChild(container);
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
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  private async sendMessage() {
    ztoolkit.log("sendMessage called");
    const input = this.inputElement;
    ztoolkit.log("input element:", input);
    ztoolkit.log("input.value raw:", input?.value);
    if (!input) {
      ztoolkit.log("No input element");
      return;
    }

    const message = input.value?.trim();
    ztoolkit.log("message:", message || "<empty string>", "currentItemID:", this.currentItemID);

    if (!message || !this.currentItemID) {
      ztoolkit.log("Early return - message empty or no item selected");
      return;
    }

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
    if (!messagesDiv || !this.container) return;

    const doc = this.container.ownerDocument;
    if (!doc) return;
    const messageEl = doc.createElement("div");

    if (toolCall && toolResult !== undefined) {
      // 工具调用显示为可折叠卡片
      messageEl.className = "marginalia-tool-call";
      messageEl.style.cssText = "background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; margin: 8px 0; overflow: hidden;";

      const header = doc.createElement("div");
      header.className = "marginalia-tool-call-header";
      header.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #ebebeb; cursor: pointer;";
      header.innerHTML = `
        <span style="font-weight: 500; font-size: 12px;">${this.escapeHtml(toolCall.name)}</span>
        <span style="margin-left: auto; font-size: 11px; color: #D4AF37;">completed</span>
      `;

      const body = doc.createElement("div");
      body.className = "marginalia-tool-call-body";
      body.style.cssText = "padding: 10px 12px; font-size: 12px; font-family: monospace; border-top: 1px solid #e0e0e0; white-space: pre-wrap; word-break: break-word;";
      body.innerHTML = `
        <div style="color: #666; margin-bottom: 8px;">Arguments: ${this.escapeHtml(JSON.stringify(toolCall.arguments))}</div>
        <div style="color: #333;">${this.escapeHtml(toolResult)}</div>
      `;

      header.addEventListener("click", () => {
        body.style.display = body.style.display === "none" ? "block" : "none";
      });

      messageEl.appendChild(header);
      messageEl.appendChild(body);
    } else {
      messageEl.className = `marginalia-message ${role}`;
      messageEl.style.cssText = `display: flex; ${role === "user" ? "justify-content: flex-end;" : "justify-content: flex-start;"}`;

      const contentDiv = doc.createElement("div");
      contentDiv.className = "marginalia-message-content";

      if (role === "user") {
        contentDiv.style.cssText = "max-width: 85%; padding: 12px 16px; border-radius: 16px; background: #171717; color: #fff; line-height: 1.5; user-select: text; cursor: text;";
        contentDiv.textContent = content;
      } else {
        contentDiv.style.cssText = "max-width: 85%; padding: 12px 16px; border-radius: 16px; background: #fff; color: #171717; border: 1px solid #e5e5e5; line-height: 1.5; user-select: text; cursor: text;";
        contentDiv.innerHTML = MarkdownRenderer.render(content);
      }

      messageEl.appendChild(contentDiv);
    }

    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  private showLoading() {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    const doc = this.container?.ownerDocument;
    if (!doc || !messagesDiv) return;
    const loadingEl = doc.createElement("div");
    loadingEl.className = "marginalia-loading";
    loadingEl.id = "marginalia-loading";
    loadingEl.innerHTML = `<div class="marginalia-spinner"></div><span>Thinking...</span>`;
    messagesDiv.appendChild(loadingEl);
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
    // 手动转义 HTML 特殊字符
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
