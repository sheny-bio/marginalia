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
  private dropdownVisible: boolean = false;
  private currentItem: any = null;

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
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
      },
      sidenav: {
        l10nID: "marginalia-chat-sidenav",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
      },
      onRender: ({ body, item }) => {
        // 设置 body 样式 - 占满可用空间
        body.style.cssText = `
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
          min-height: 400px;
        `;

        if (!body.querySelector("#marginalia-container")) {
          const doc = body.ownerDocument!;

          // 创建容器 - 占满父容器高度
          const container = doc.createElement("div");
          container.id = "marginalia-container";
          container.className = "marginalia-container";
          container.style.cssText = `
            display: flex;
            flex-direction: column;
            flex: 1;
            height: 100%;
            min-height: 700px;
            overflow: hidden;
          `;

          // 创建消息区域
          const messagesDiv = doc.createElement("div");
          messagesDiv.id = "marginalia-messages";
          messagesDiv.className = "marginalia-messages";
          messagesDiv.style.cssText = "flex: 1; overflow-y: auto; min-height: 200px; padding: 12px;";

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
          textarea.style.cssText = `
            flex: 1;
            min-width: 0;
            padding: 12px 16px;
            background: #F5F5F5;
            border: 1px solid #E5E5E5;
            border-radius: 12px;
            font-size: 14px;
            font-family: inherit;
            color: #171717;
            resize: none;
            min-height: 44px;
            max-height: 120px;
            line-height: 1.5;
            overflow-y: auto;
            transition: border-color 0.2s, box-shadow 0.2s;
          `;
          this.inputElement = textarea;

          // 输入框自适应高度
          textarea.addEventListener("input", () => {
            textarea.style.height = "auto";
            const scrollHeight = Math.min(textarea.scrollHeight, 120);
            textarea.style.height = `${scrollHeight}px`;
          });

          // 输入框焦点样式
          textarea.addEventListener("focus", () => {
            textarea.style.borderColor = "#D4AF37";
            textarea.style.boxShadow = "0 0 0 3px rgba(212, 175, 55, 0.15)";
          });
          textarea.addEventListener("blur", () => {
            textarea.style.borderColor = "#E5E5E5";
            textarea.style.boxShadow = "none";
          });

          // 创建发送按钮
          const sendBtn = doc.createElement("button");
          sendBtn.id = "marginalia-send";
          sendBtn.className = "marginalia-button";
          sendBtn.textContent = "Send";
          sendBtn.style.cssText = "padding: 10px 16px; background: #171717; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;";

          // 创建选项按钮包装器（用于下拉菜单定位）
          const optionsWrapper = doc.createElement("div");
          optionsWrapper.className = "marginalia-options-wrapper";
          optionsWrapper.style.cssText = "position: relative;";

          // 创建选项按钮
          const optionsBtn = doc.createElement("button");
          optionsBtn.id = "marginalia-options";
          optionsBtn.className = "marginalia-button marginalia-button-options";
          optionsBtn.textContent = "+";
          optionsBtn.style.cssText = "padding: 10px 12px; background: #f5f5f5; color: #171717; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: 14px;";

          // 创建下拉菜单
          const dropdown = this.createDropdownMenu(doc);
          optionsWrapper.appendChild(optionsBtn);
          optionsWrapper.appendChild(dropdown);

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

          // 选项按钮点击事件
          optionsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleDropdown();
          });

          // 点击其他地方关闭下拉菜单
          doc.addEventListener("click", () => {
            this.hideDropdown();
          });

          // 组装 DOM
          inputArea.appendChild(textarea);
          inputArea.appendChild(sendBtn);
          inputArea.appendChild(optionsWrapper);
          container.appendChild(messagesDiv);
          container.appendChild(inputArea);

          this.container = container;
          body.appendChild(container);
        }
        this.onItemChange(item);
      },
    });
  }

  private onItemChange(item: any) {
    if (item) {
      this.currentItemID = item.id;
      this.currentItem = item;
      this.loadMessages();
    }
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
    // 重置输入框高度
    input.style.height = "auto";
    this.addMessage("user", message);
    this.addMessage("assistant", ""); // 创建空的 assistant 消息用于流式更新
    this.showLoading();

    try {
      const { response, toolCalls } = await this.callAPI(message);
      this.removeLoading();
      // 流式更新已经完成，不需要再 addMessage
      await this.saveMessage("user", message);
      await this.saveMessage("assistant", response, toolCalls.length > 0 ? toolCalls : undefined);
    } catch (error) {
      this.removeLoading();
      this.showErrorMessage(error);
    }
  }

  // 显示错误消息
  private showErrorMessage(error: unknown) {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    const doc = this.container?.ownerDocument;
    if (!doc || !messagesDiv) return;

    // 移除空的 assistant 消息
    const lastAssistant = messagesDiv.querySelector(".marginalia-message.assistant:last-of-type");
    if (lastAssistant) {
      const content = lastAssistant.querySelector(".marginalia-message-content");
      if (content && !content.textContent?.trim()) {
        lastAssistant.remove();
      }
    }

    const errorEl = doc.createElement("div");
    errorEl.className = "marginalia-error";
    errorEl.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: 12px;
      margin: 8px 0;
      color: #DC2626;
      font-size: 13px;
      line-height: 1.5;
    `;

    const errorMessage = error instanceof Error ? error.message : String(error);
    errorEl.innerHTML = `
      <span style="flex-shrink: 0;">⚠️</span>
      <div>
        <div style="font-weight: 500; margin-bottom: 4px;">Something went wrong</div>
        <div style="color: #991B1B; font-size: 12px;">${this.escapeHtml(errorMessage)}</div>
      </div>
    `;

    messagesDiv.appendChild(errorEl);
    this.scrollToBottom();
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
      // 添加复制按钮
      this.addCopyButtonToMessage(messageEl, content, role);
    }

    messagesDiv.appendChild(messageEl);
    this.scrollToBottom();
  }

  // 平滑滚动到底部
  private scrollToBottom() {
    const messagesDiv = this.container?.querySelector("#marginalia-messages") as HTMLElement;
    if (!messagesDiv) return;

    // 使用 smooth 滚动
    messagesDiv.scrollTo({
      top: messagesDiv.scrollHeight,
      behavior: "smooth",
    });
  }

  private showLoading() {
    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    const doc = this.container?.ownerDocument;
    if (!doc || !messagesDiv) return;
    const loadingEl = doc.createElement("div");
    loadingEl.className = "marginalia-loading";
    loadingEl.id = "marginalia-loading";
    loadingEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      color: #6B7280;
      font-size: 13px;
    `;
    loadingEl.innerHTML = `
      <div class="marginalia-spinner" style="
        width: 18px;
        height: 18px;
        border: 2px solid #E5E5E5;
        border-top-color: #D4AF37;
        border-radius: 50%;
        animation: marginalia-spin 0.8s linear infinite;
      "></div>
      <span>Thinking...</span>
    `;

    // 添加动画样式
    if (!doc.querySelector("#marginalia-spinner-style")) {
      const style = doc.createElement("style");
      style.id = "marginalia-spinner-style";
      style.textContent = `
        @keyframes marginalia-spin {
          to { transform: rotate(360deg); }
        }
      `;
      doc.head?.appendChild(style);
    }

    messagesDiv.appendChild(loadingEl);
    this.scrollToBottom();
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

    // 获取论文全文内容
    let paperContent = "";
    try {
      paperContent = await ZoteroAPI.getPaperContent(this.currentItemID!);
      // 限制全文长度，避免超出 token 限制
      if (paperContent.length > 50000) {
        paperContent = paperContent.substring(0, 50000) + "\n\n[Content truncated due to length...]";
      }
    } catch (error) {
      ztoolkit.log("Error getting paper content:", error);
      paperContent = "Unable to retrieve paper content.";
    }

    let systemMessage = `${systemPrompt}

Current paper information:
- Title: ${paperInfo?.title || "Unknown"}
- Authors: ${paperInfo?.authors?.map((a: any) => `${a.firstName} ${a.lastName}`).join(", ") || "Unknown"}
- Year: ${paperInfo?.year || "Unknown"}
- Abstract: ${paperInfo?.abstract || "No abstract available"}
- Paper ID: ${this.currentItemID}

Paper full text content:
${paperContent}`;

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
    const messages = messagesDiv?.querySelectorAll(".marginalia-message.assistant");
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const contentDiv = lastMessage.querySelector(".marginalia-message-content");
      if (contentDiv) {
        contentDiv.innerHTML = MarkdownRenderer.render(content);
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

    // 检查并执行对话轮数限制
    await this.enforceHistoryLimit();
  }

  private async enforceHistoryLimit() {
    if (!this.currentItemID) return;

    const maxRounds = await this.settingsManager.getMaxHistoryRounds();
    if (maxRounds <= 0) return; // 0 表示不限制

    // 计算当前轮数（一轮 = 一个用户消息 + 一个助手回复）
    const userMessages = this.messages.filter((m) => m.role === "user");
    const currentRounds = userMessages.length;

    if (currentRounds > maxRounds) {
      const roundsToRemove = currentRounds - maxRounds;
      // 删除最早的几轮对话
      await this.storageManager.deleteOldestMessages(this.currentItemID, roundsToRemove * 2);
      // 重新加载消息
      await this.loadMessages();
    }
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

  // ========== Phase 4: 对话管理功能 ==========

  private createDropdownMenu(doc: Document): HTMLElement {
    const dropdown = doc.createElement("div");
    dropdown.id = "marginalia-dropdown";
    dropdown.className = "marginalia-dropdown";
    dropdown.style.cssText = `
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: 8px;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      min-width: 180px;
      overflow: hidden;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transform: translateY(8px);
      transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
    `;

    const menuItems = [
      { id: "export-md", icon: "📄", label: "Export as Markdown", action: () => this.exportAsMarkdown() },
      { id: "copy-all", icon: "📋", label: "Copy All Messages", action: () => this.copyAllMessages() },
      { id: "divider", type: "divider" },
      { id: "clear-history", icon: "🗑️", label: "Clear History", danger: true, action: () => this.showClearConfirmDialog() },
    ];

    for (const item of menuItems) {
      if (item.type === "divider") {
        const divider = doc.createElement("div");
        divider.className = "marginalia-dropdown-divider";
        divider.style.cssText = "height: 1px; background: #e5e5e5; margin: 4px 0;";
        dropdown.appendChild(divider);
      } else {
        const menuItem = doc.createElement("button");
        menuItem.className = `marginalia-dropdown-item${item.danger ? " danger" : ""}`;
        menuItem.style.cssText = `
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          font-size: 14px;
          color: ${item.danger ? "#DC2626" : "#171717"};
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          font-family: inherit;
        `;
        menuItem.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
        menuItem.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hideDropdown();
          item.action?.();
        });
        menuItem.addEventListener("mouseenter", () => {
          menuItem.style.background = item.danger ? "#FEF2F2" : "#F5F5F5";
        });
        menuItem.addEventListener("mouseleave", () => {
          menuItem.style.background = "none";
        });
        dropdown.appendChild(menuItem);
      }
    }

    return dropdown;
  }

  private toggleDropdown() {
    const dropdown = this.container?.querySelector("#marginalia-dropdown") as HTMLElement;
    if (!dropdown) return;

    this.dropdownVisible = !this.dropdownVisible;
    if (this.dropdownVisible) {
      dropdown.style.opacity = "1";
      dropdown.style.visibility = "visible";
      dropdown.style.transform = "translateY(0)";
    } else {
      dropdown.style.opacity = "0";
      dropdown.style.visibility = "hidden";
      dropdown.style.transform = "translateY(8px)";
    }
  }

  private hideDropdown() {
    const dropdown = this.container?.querySelector("#marginalia-dropdown") as HTMLElement;
    if (!dropdown) return;

    this.dropdownVisible = false;
    dropdown.style.opacity = "0";
    dropdown.style.visibility = "hidden";
    dropdown.style.transform = "translateY(8px)";
  }

  private async copyAllMessages() {
    const markdown = this.generateMarkdownContent();
    await this.copyToClipboard(markdown);
    this.showToast("All messages copied!");
  }

  private async exportAsMarkdown() {
    const markdown = this.generateMarkdownContent();
    const title = this.currentItem?.getField?.("title") || "conversation";
    const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_").substring(0, 50);
    const filename = `${safeTitle}_chat_${new Date().toISOString().split("T")[0]}.md`;

    try {
      // 使用 Zotero 的文件保存对话框
      const path = await new ztoolkit.FilePicker(
        "Save Markdown",
        "save",
        [["Markdown Files (*.md)", "*.md"]],
        filename
      ).open();

      if (path) {
        await Zotero.File.putContentsAsync(path, markdown);
        this.showToast("Exported successfully!");
      }
    } catch (error) {
      ztoolkit.log("Error exporting markdown:", error);
      this.showToast("Export failed!");
    }
  }

  private generateMarkdownContent(): string {
    const title = this.currentItem?.getField?.("title") || "Untitled";
    const date = new Date().toLocaleString();
    let markdown = `# Chat History: ${title}\n\n`;
    markdown += `*Exported on ${date}*\n\n---\n\n`;

    for (const msg of this.messages) {
      if (msg.role === "user") {
        markdown += `## 👤 User\n\n${msg.content}\n\n`;
      } else if (msg.role === "assistant") {
        markdown += `## 🤖 Assistant\n\n${msg.content}\n\n`;
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            markdown += `<details>\n<summary>🔧 Tool: ${tc.name}</summary>\n\n`;
            markdown += `**Arguments:**\n\`\`\`json\n${JSON.stringify(tc.arguments, null, 2)}\n\`\`\`\n\n`;
            markdown += `**Result:**\n\`\`\`\n${tc.result || "No result"}\n\`\`\`\n</details>\n\n`;
          }
        }
      }
      markdown += "---\n\n";
    }

    return markdown;
  }

  private showClearConfirmDialog() {
    const doc = this.container?.ownerDocument;
    if (!doc) return;

    const overlay = doc.createElement("div");
    overlay.className = "marginalia-dialog-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    `;

    const dialog = doc.createElement("div");
    dialog.className = "marginalia-dialog";
    dialog.style.cssText = `
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      max-width: 320px;
      width: 90%;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    `;

    dialog.innerHTML = `
      <div style="font-size: 16px; font-weight: 600; color: #171717; margin-bottom: 8px;">Clear Chat History?</div>
      <div style="font-size: 14px; color: #6B7280; margin-bottom: 20px; line-height: 1.5;">
        This will permanently delete all messages for this paper. This action cannot be undone.
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="marginalia-cancel-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; background: #F5F5F5; color: #171717; border: none; font-family: inherit;">Cancel</button>
        <button id="marginalia-confirm-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; background: #DC2626; color: #fff; border: none; font-family: inherit;">Clear</button>
      </div>
    `;

    overlay.appendChild(dialog);
    doc.body?.appendChild(overlay);

    const cancelBtn = dialog.querySelector("#marginalia-cancel-btn");
    const confirmBtn = dialog.querySelector("#marginalia-confirm-btn");

    cancelBtn?.addEventListener("click", () => {
      overlay.remove();
    });

    confirmBtn?.addEventListener("click", async () => {
      await this.clearHistory();
      overlay.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  private async clearHistory() {
    if (!this.currentItemID) return;

    await this.storageManager.clearMessages(this.currentItemID);
    this.messages = [];

    const messagesDiv = this.container?.querySelector("#marginalia-messages");
    if (messagesDiv) {
      messagesDiv.innerHTML = "";
    }

    this.showToast("History cleared!");
  }

  private async copyToClipboard(text: string) {
    ztoolkit.log("[Copy] Starting copy, text length:", text.length);
    ztoolkit.log("[Copy] Text preview:", text.substring(0, 100));

    // 方法1: Zotero.Utilities.Internal.copyTextToClipboard
    try {
      ztoolkit.log("[Copy] Trying Zotero.Utilities.Internal.copyTextToClipboard");
      ztoolkit.log("[Copy] Zotero.Utilities:", typeof Zotero.Utilities);
      ztoolkit.log("[Copy] Zotero.Utilities.Internal:", typeof (Zotero.Utilities as any).Internal);
      ztoolkit.log("[Copy] copyTextToClipboard:", typeof (Zotero.Utilities as any).Internal?.copyTextToClipboard);

      if ((Zotero.Utilities as any).Internal?.copyTextToClipboard) {
        (Zotero.Utilities as any).Internal.copyTextToClipboard(text);
        ztoolkit.log("[Copy] Zotero.Utilities.Internal.copyTextToClipboard succeeded");
        this.showToast("Copied!");
        return;
      } else {
        ztoolkit.log("[Copy] copyTextToClipboard not available");
      }
    } catch (error) {
      ztoolkit.log("[Copy] Zotero.Utilities.Internal.copyTextToClipboard failed:", error);
    }

    // 方法2: nsIClipboardHelper
    try {
      ztoolkit.log("[Copy] Trying nsIClipboardHelper");
      const clipboardService = (Components.classes as any)["@mozilla.org/widget/clipboardhelper;1"]?.getService(
        (Components.interfaces as any).nsIClipboardHelper
      );
      ztoolkit.log("[Copy] clipboardService:", clipboardService);

      if (clipboardService) {
        clipboardService.copyString(text);
        ztoolkit.log("[Copy] nsIClipboardHelper succeeded");
        this.showToast("Copied!");
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
      const doc = this.container?.ownerDocument;
      if (doc && doc.body) {
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
          this.showToast("Copied!");
          return;
        }
      }
    } catch (error) {
      ztoolkit.log("[Copy] execCommand failed:", error);
    }

    ztoolkit.log("[Copy] All methods failed");
    this.showToast("Copy failed");
  }

  private showToast(message: string) {
    const doc = this.container?.ownerDocument;
    if (!doc) return;

    // 移除已存在的 toast
    const existingToast = doc.querySelector(".marginalia-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = doc.createElement("div");
    toast.className = "marginalia-toast";
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #171717;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 3000;
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
    `;

    doc.body?.appendChild(toast);

    // 触发动画
    const win = doc.defaultView;
    if (win) {
      win.requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
      });
    } else {
      // Fallback
      setTimeout(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
      }, 10);
    }

    // 3秒后移除
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // 复制单条消息（添加到消息元素上）
  private addCopyButtonToMessage(messageEl: HTMLElement, _content: string, _role: string) {
    const doc = messageEl.ownerDocument;
    if (!doc) return;

    const wrapper = doc.createElement("div");
    wrapper.className = "marginalia-message-wrapper";
    wrapper.style.cssText = "position: relative;";

    const copyBtn = doc.createElement("button");
    copyBtn.className = "marginalia-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      background: rgba(255,255,255,0.9);
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      font-size: 11px;
      color: #6B7280;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    `;

    wrapper.addEventListener("mouseenter", () => {
      copyBtn.style.opacity = "1";
    });
    wrapper.addEventListener("mouseleave", () => {
      copyBtn.style.opacity = "0";
    });

    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      // 动态获取当前消息内容，而不是使用绑定时的内容
      const contentDiv = messageEl.querySelector(".marginalia-message-content");
      const currentContent = contentDiv?.textContent || "";
      ztoolkit.log("[Copy] Getting content from DOM, length:", currentContent.length);
      await this.copyToClipboard(currentContent);
      copyBtn.textContent = "Copied!";
      copyBtn.style.background = "#D4AF37";
      copyBtn.style.color = "#fff";
      copyBtn.style.borderColor = "#D4AF37";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.style.background = "rgba(255,255,255,0.9)";
        copyBtn.style.color = "#6B7280";
        copyBtn.style.borderColor = "#e5e5e5";
      }, 2000);
    });

    // 将原有内容移到 wrapper 中
    while (messageEl.firstChild) {
      wrapper.appendChild(messageEl.firstChild);
    }
    wrapper.appendChild(copyBtn);
    messageEl.appendChild(wrapper);
  }
}
