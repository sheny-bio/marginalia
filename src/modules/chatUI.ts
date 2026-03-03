import { MarkdownRenderer } from "../utils/markdown";
import { getString } from "../utils/locale";
import * as chatActions from "./chatActions";

export interface UICallbacks {
  onSend: () => void;
  onExport: () => void;
  onClear: () => void;
  onLibraryBtnClick: (anchorEl: HTMLElement) => void;
  onSuggestionClick: (text: string) => void;
  onQuoteRemove: (index: number) => void;
  onLinkedCollectionRemove: () => void;
  onCopyText: (text: string) => Promise<void>;
}

export class ChatUI {
  private _container: HTMLElement | null = null;
  private _inputElement: HTMLTextAreaElement | null = null;
  private _messagesDiv: HTMLElement | null = null;
  private _inputArea: HTMLElement | null = null;
  private _callbacks: UICallbacks | null = null;
  private _hasLinkedCollection: boolean = false;

  getInput(): HTMLTextAreaElement | null {
    return this._inputElement;
  }

  getContainer(): HTMLElement | null {
    return this._container;
  }

  buildLayout(body: HTMLElement, callbacks: UICallbacks): void {
    this._callbacks = callbacks;

    const doc = body.ownerDocument!;

    // 创建容器
    const container = doc.createElement("div");
    container.id = "marginalia-container";
    container.className = "marginalia-container";
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      overflow: hidden;
      background: #FAFAFA;
    `;

    // 创建消息区域
    const messagesDiv = doc.createElement("div");
    messagesDiv.id = "marginalia-messages";
    messagesDiv.className = "marginalia-messages";
    messagesDiv.style.cssText =
      "flex: 1; overflow-y: auto; min-height: 200px; max-height: 500px; padding: 12px;";
    this._messagesDiv = messagesDiv;

    // 创建输入区域
    const inputArea = doc.createElement("div");
    inputArea.className = "marginalia-input-area";
    inputArea.style.cssText =
      "flex-shrink: 0; padding: 16px; background: #fff; border-top: 1px solid #e5e5e5;";
    this._inputArea = inputArea;

    // 创建工具栏
    const toolbar = doc.createElement("div");
    toolbar.className = "marginalia-toolbar";
    toolbar.style.cssText =
      "display: flex; align-items: center; gap: 4px; padding: 0 0 8px 0;";

    // 导出按钮
    const exportBtn = doc.createElement("button");
    exportBtn.className = "marginalia-toolbar-btn";
    exportBtn.title = getString("chat-menu-export");
    exportBtn.style.cssText =
      "display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: none; border: 1px solid transparent; border-radius: 6px; cursor: pointer; color: #9CA3AF; transition: all 0.15s; padding: 0;";
    exportBtn.appendChild(
      this._createSvgIcon(doc, [
        {
          tag: "path",
          attrs: {
            d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
          },
        },
        { tag: "polyline", attrs: { points: "14 2 14 8 20 8" } },
        { tag: "line", attrs: { x1: "16", y1: "13", x2: "8", y2: "13" } },
        { tag: "line", attrs: { x1: "16", y1: "17", x2: "8", y2: "17" } },
        { tag: "polyline", attrs: { points: "10 9 9 9 8 9" } },
      ]),
    );
    exportBtn.addEventListener("mouseenter", () => {
      exportBtn.style.background = "#F5F5F5";
      exportBtn.style.borderColor = "#e5e5e5";
      exportBtn.style.color = "#171717";
    });
    exportBtn.addEventListener("mouseleave", () => {
      exportBtn.style.background = "none";
      exportBtn.style.borderColor = "transparent";
      exportBtn.style.color = "#9CA3AF";
    });
    exportBtn.addEventListener("click", () => this._callbacks?.onExport());

    // 清除按钮
    const clearBtn = doc.createElement("button");
    clearBtn.className = "marginalia-toolbar-btn";
    clearBtn.title = getString("chat-menu-clear");
    clearBtn.style.cssText =
      "display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: none; border: 1px solid transparent; border-radius: 6px; cursor: pointer; color: #9CA3AF; transition: all 0.15s; padding: 0;";
    clearBtn.appendChild(
      this._createSvgIcon(doc, [
        { tag: "polyline", attrs: { points: "3 6 5 6 21 6" } },
        {
          tag: "path",
          attrs: {
            d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
          },
        },
      ]),
    );
    clearBtn.addEventListener("mouseenter", () => {
      clearBtn.style.background = "#FEF2F2";
      clearBtn.style.borderColor = "#FECACA";
      clearBtn.style.color = "#DC2626";
    });
    clearBtn.addEventListener("mouseleave", () => {
      clearBtn.style.background = "none";
      clearBtn.style.borderColor = "transparent";
      clearBtn.style.color = "#9CA3AF";
    });
    clearBtn.addEventListener("click", () => this._callbacks?.onClear());

    toolbar.appendChild(exportBtn);
    toolbar.appendChild(clearBtn);

    // 关联文献库按钮（推到右端）
    const libraryBtn = doc.createElement("button");
    libraryBtn.id = "marginalia-library-btn";
    libraryBtn.title = "关联文献库";
    libraryBtn.style.cssText =
      "display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; background: none; border: 1px solid transparent; border-radius: 6px; cursor: pointer; color: #9CA3AF; font-size: 12px; font-family: inherit; margin-left: auto; transition: all 0.15s;";
    libraryBtn.textContent = "关联文献库";
    libraryBtn.addEventListener("mouseenter", () => {
      if (!this._hasLinkedCollection) {
        libraryBtn.style.background = "#EFF6FF";
        libraryBtn.style.borderColor = "#BFDBFE";
        libraryBtn.style.color = "#1D4ED8";
      }
    });
    libraryBtn.addEventListener("mouseleave", () => {
      if (!this._hasLinkedCollection) {
        libraryBtn.style.background = "none";
        libraryBtn.style.borderColor = "transparent";
        libraryBtn.style.color = "#9CA3AF";
      }
    });
    libraryBtn.addEventListener("click", () =>
      this._callbacks?.onLibraryBtnClick(libraryBtn),
    );
    toolbar.appendChild(libraryBtn);

    // 创建输入容器
    const inputContainer = doc.createElement("div");
    inputContainer.className = "marginalia-input-container";
    inputContainer.style.cssText =
      "display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #fff; border: 1px solid #e5e5e5; border-radius: 24px; transition: border-color 0.2s, box-shadow 0.2s;";

    // 创建输入框
    const textarea = doc.createElement("textarea") as HTMLTextAreaElement;
    textarea.id = "marginalia-input";
    textarea.className = "marginalia-input";
    textarea.placeholder = getString("chat-input-placeholder");
    textarea.rows = 1;
    textarea.style.cssText =
      "flex: 1; min-width: 0; padding: 6px 8px; background: transparent; border: none; font-size: 14px; font-family: inherit; color: #171717; resize: none; max-height: 120px; line-height: 1.5; outline: none;";
    this._inputElement = textarea;

    // 输入框自适应高度
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      const scrollHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${scrollHeight}px`;
    });

    // 容器聚焦效果
    textarea.addEventListener("focus", () => {
      inputContainer.style.borderColor = "#D4AF37";
      inputContainer.style.boxShadow = "0 0 0 3px rgba(212, 175, 55, 0.1)";
    });
    textarea.addEventListener("blur", () => {
      inputContainer.style.borderColor = "#e5e5e5";
      inputContainer.style.boxShadow = "none";
    });

    // 创建发送按钮
    const sendBtn = doc.createElement("button");
    sendBtn.id = "marginalia-send";
    sendBtn.textContent = getString("chat-send-button");
    sendBtn.style.cssText =
      "display: flex; align-items: center; justify-content: center; padding: 8px 16px; background: #171717; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; flex-shrink: 0;";
    sendBtn.addEventListener("mouseenter", () => {
      sendBtn.style.background = "#404040";
    });
    sendBtn.addEventListener("mouseleave", () => {
      sendBtn.style.background = "#171717";
    });
    sendBtn.addEventListener("click", () => {
      ztoolkit.log("Send button clicked");
      this._callbacks?.onSend();
    });

    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._callbacks?.onSend();
      }
    });

    // 组装 DOM
    inputContainer.appendChild(textarea);
    inputContainer.appendChild(sendBtn);
    inputArea.appendChild(toolbar);
    inputArea.appendChild(inputContainer);
    container.appendChild(messagesDiv);
    container.appendChild(inputArea);

    this._container = container;
    body.appendChild(container);
  }

  renderLinkedCollection(col: { id: number; name: string } | null): void {
    this._hasLinkedCollection = !!col;

    if (!this._inputArea) return;
    const doc = this._inputArea.ownerDocument;
    if (!doc) return;

    // 更新按钮高亮状态
    const libraryBtn = this._inputArea.querySelector(
      "#marginalia-library-btn",
    ) as HTMLElement | null;
    if (libraryBtn) {
      if (col) {
        libraryBtn.style.background = "#EFF6FF";
        libraryBtn.style.borderColor = "#BFDBFE";
        libraryBtn.style.color = "#1D4ED8";
      } else {
        libraryBtn.style.background = "none";
        libraryBtn.style.borderColor = "transparent";
        libraryBtn.style.color = "#9CA3AF";
      }
    }

    // 移除旧的集合标签
    const existing = this._inputArea.querySelector("#marginalia-library-chip");
    if (existing) existing.remove();

    if (!col) return;

    const chipArea = doc.createElement("div");
    chipArea.id = "marginalia-library-chip";
    chipArea.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 6px; padding: 0 0 8px 0;";

    const chip = doc.createElement("div");
    chip.style.cssText =
      "display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; font-size: 12px; color: #1D4ED8;";

    const icon = doc.createElement("span");
    icon.textContent = "📚";
    icon.style.fontSize = "11px";

    const label = doc.createElement("span");
    label.style.cssText =
      "overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;";
    label.textContent = col.name;
    label.title = col.name;

    const closeBtn = doc.createElement("span");
    closeBtn.textContent = "×";
    closeBtn.style.cssText =
      "cursor: pointer; color: #3B82F6; font-size: 14px; line-height: 1; flex-shrink: 0;";
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "#DC2626";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "#3B82F6";
    });
    closeBtn.addEventListener("click", () => {
      this._callbacks?.onLinkedCollectionRemove();
    });

    chip.appendChild(icon);
    chip.appendChild(label);
    chip.appendChild(closeBtn);
    chipArea.appendChild(chip);

    // 插入到 quotesDiv 之前，或 inputContainer 之前
    const quotesDiv = this._inputArea.querySelector("#marginalia-quotes");
    const inputContainer = this._inputArea.querySelector(
      ".marginalia-input-container",
    );
    if (quotesDiv) {
      this._inputArea.insertBefore(chipArea, quotesDiv);
    } else if (inputContainer) {
      this._inputArea.insertBefore(chipArea, inputContainer);
    } else {
      this._inputArea.prepend(chipArea);
    }
  }

  showCollectionPicker(
    anchorEl: HTMLElement,
    collections: any[],
    onSelect: (col: { id: number; name: string }) => void,
  ): void {
    const doc = this._container?.ownerDocument;
    if (!doc) return;

    // 如果已存在则关闭（toggle）
    const existingPicker = doc.querySelector("#marginalia-collection-picker");
    if (existingPicker) {
      existingPicker.remove();
      return;
    }

    const picker = doc.createElement("div");
    picker.id = "marginalia-collection-picker";
    picker.style.cssText = `
      position: fixed;
      z-index: 9999;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      max-height: 280px;
      overflow-y: auto;
      min-width: 200px;
      visibility: hidden;
    `;

    if (collections.length === 0) {
      const empty = doc.createElement("div");
      empty.style.cssText =
        "padding: 12px 16px; color: #9CA3AF; font-size: 13px;";
      empty.textContent = "暂无文献集合";
      picker.appendChild(empty);
    } else {
      collections.forEach((col) => {
        const item = doc.createElement("div");
        item.style.cssText =
          "display: flex; align-items: center; gap: 6px; padding: 8px 14px; cursor: pointer; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; transition: background 0.1s;";

        const colIcon = doc.createElement("span");
        colIcon.textContent = "📁";
        colIcon.style.fontSize = "12px";

        const colName = doc.createElement("span");
        colName.textContent = col.name;
        colName.style.cssText =
          "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";

        item.appendChild(colIcon);
        item.appendChild(colName);

        item.addEventListener("mouseenter", () => {
          item.style.background = "#F5F7FF";
        });
        item.addEventListener("mouseleave", () => {
          item.style.background = "transparent";
        });
        item.addEventListener("click", () => {
          onSelect({ id: col.id, name: col.name });
          picker.remove();
        });
        picker.appendChild(item);
      });
    }

    (doc.body ?? doc.documentElement!).appendChild(picker);

    // 计算位置：优先放左上方，防止溢出
    const rect = anchorEl.getBoundingClientRect();
    const pickerHeight = picker.offsetHeight;
    const pickerWidth = picker.offsetWidth;
    const viewportWidth = doc.documentElement.clientWidth;

    // 水平：优先左对齐，超出右边界则右对齐
    let left = rect.left;
    if (left + pickerWidth > viewportWidth - 8) {
      left = viewportWidth - pickerWidth - 8;
    }
    if (left < 8) left = 8;

    // 垂直：优先显示在按钮上方
    let top: number;
    if (rect.top - pickerHeight - 4 >= 8) {
      top = rect.top - pickerHeight - 4;
    } else {
      top = rect.bottom + 4;
    }

    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
    picker.style.visibility = "visible";

    // 点击外部关闭
    const closeOnOutside = (e: MouseEvent) => {
      if (
        !picker.contains(e.target as Node) &&
        e.target !== anchorEl &&
        !(anchorEl as HTMLElement).contains(e.target as Node)
      ) {
        picker.remove();
        doc.removeEventListener("click", closeOnOutside, true);
      }
    };
    setTimeout(() => {
      doc.addEventListener("click", closeOnOutside, true);
    }, 0);
  }

  renderQuotes(quotes: string[]): void {
    if (!this._inputArea) return;
    const doc = this._inputArea.ownerDocument;
    if (!doc) return;

    // 移除旧的引用区域
    const existing = this._inputArea.querySelector("#marginalia-quotes");
    if (existing) existing.remove();

    if (quotes.length === 0) return;

    const quotesDiv = doc.createElement("div");
    quotesDiv.id = "marginalia-quotes";
    quotesDiv.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 6px; padding: 0 0 8px 0;";

    quotes.forEach((text, index) => {
      const chip = doc.createElement("div");
      chip.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 8px; background: #F5F5F5; border: 1px solid #e5e5e5;
        border-radius: 6px; font-size: 12px; color: #6B7280;
        max-width: 120px;
      `;

      const label = doc.createElement("span");
      label.style.cssText =
        "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
      label.textContent = text.length > 5 ? text.substring(0, 5) + "..." : text;
      label.title = text.substring(0, 100);

      const closeBtn = doc.createElement("span");
      closeBtn.textContent = "×";
      closeBtn.style.cssText =
        "cursor: pointer; color: #9CA3AF; font-size: 14px; line-height: 1; flex-shrink: 0;";
      closeBtn.addEventListener("mouseenter", () => {
        closeBtn.style.color = "#DC2626";
      });
      closeBtn.addEventListener("mouseleave", () => {
        closeBtn.style.color = "#9CA3AF";
      });
      closeBtn.addEventListener("click", () => {
        this._callbacks?.onQuoteRemove(index);
      });

      chip.appendChild(label);
      chip.appendChild(closeBtn);
      quotesDiv.appendChild(chip);
    });

    // 插入到 inputContainer 之前
    const inputContainer = this._inputArea.querySelector(
      ".marginalia-input-container",
    );
    if (inputContainer) {
      this._inputArea.insertBefore(quotesDiv, inputContainer);
    } else {
      this._inputArea.prepend(quotesDiv);
    }
  }

  addMessage(role: string, content: string): void {
    if (!this._messagesDiv || !this._container) return;
    const doc = this._container.ownerDocument;
    if (!doc) return;

    const messageEl = doc.createElement("div");
    messageEl.className = `marginalia-message ${role}`;
    messageEl.style.cssText = `display: flex; margin-bottom: 12px; ${role === "user" ? "justify-content: flex-end;" : "justify-content: flex-start;"}`;

    const contentDiv = doc.createElement("div");
    contentDiv.className = "marginalia-message-content";

    if (role === "user") {
      contentDiv.style.cssText =
        "max-width: 85%; padding: 12px 16px; border-radius: 16px; background: #171717; color: #fff; line-height: 1.5; user-select: text; cursor: text;";
      contentDiv.textContent = content;
    } else {
      contentDiv.style.cssText =
        "max-width: 85%; padding: 12px 16px; border-radius: 16px; background: #fff; color: #171717; border: 1px solid #e5e5e5; line-height: 1.5; user-select: text; cursor: text;";
      contentDiv.innerHTML = MarkdownRenderer.render(content);
    }

    messageEl.appendChild(contentDiv);
    this.addCopyButtonToMessage(messageEl, content, role);

    this._messagesDiv.appendChild(messageEl);
    this.scrollToBottom();
  }

  showLoading(): void {
    if (!this._messagesDiv || !this._container) return;
    const doc = this._container.ownerDocument;
    if (!doc) return;

    const messageEl = doc.createElement("div");
    messageEl.className = "marginalia-message assistant";
    messageEl.id = "marginalia-loading";
    messageEl.style.cssText = "display: flex; justify-content: flex-start;";

    const contentDiv = doc.createElement("div");
    contentDiv.id = "marginalia-loading-content";
    contentDiv.className = "marginalia-message-content";
    contentDiv.style.cssText =
      "max-width: 85%; padding: 12px 16px; border-radius: 16px; background: #fff; color: #171717; border: 1px solid #e5e5e5; line-height: 1.5; display: flex; align-items: center; gap: 10px;";
    contentDiv.innerHTML = `
      <div class="marginalia-spinner" style="
        width: 18px;
        height: 18px;
        border: 2px solid #E5E5E5;
        border-top-color: #D4AF37;
        border-radius: 50%;
        animation: marginalia-spin 0.8s linear infinite;
        flex-shrink: 0;
      "></div>
      <span style="color: #6B7280;">${getString("chat-thinking")}</span>
    `;

    messageEl.appendChild(contentDiv);

    // 添加动画样式
    if (!doc.querySelector("#marginalia-spinner-style")) {
      const style = doc.createElement("style");
      style.id = "marginalia-spinner-style";
      style.textContent = `
        @keyframes marginalia-spin {
          to { transform: rotate(360deg); }
        }
      `;
      (doc.head || doc.documentElement)?.appendChild(style);
    }

    this._messagesDiv.appendChild(messageEl);
    this.scrollToBottom();
  }

  removeLoading(): void {
    const loading = this._container?.querySelector("#marginalia-loading");
    loading?.remove();
  }

  updateLoadingStatus(status: string): void {
    const contentDiv = this._container?.querySelector(
      "#marginalia-loading-content",
    ) as HTMLElement | null;
    if (!contentDiv) return;

    contentDiv.innerHTML = `
      <div class="marginalia-spinner" style="
        width: 18px; height: 18px;
        border: 2px solid #E5E5E5;
        border-top-color: #D4AF37;
        border-radius: 50%;
        animation: marginalia-spin 0.8s linear infinite;
        flex-shrink: 0;
      "></div>
      <span style="color: #6B7280; font-size: 13px;">${this._escapeHtml(status)}</span>
    `;
    this.scrollToBottom();
  }

  createAssistantMessageShell(): {
    messageEl: HTMLElement;
    contentDiv: HTMLElement;
  } | null {
    if (!this._messagesDiv || !this._container) return null;
    const doc = this._container.ownerDocument;
    if (!doc) return null;

    const messageEl = doc.createElement("div");
    messageEl.className = "marginalia-message assistant";
    messageEl.style.cssText =
      "display: flex; margin-bottom: 12px; justify-content: flex-start;";

    const contentDiv = doc.createElement("div");
    contentDiv.className = "marginalia-message-content";
    contentDiv.style.cssText =
      "max-width: 85%; padding: 12px 16px; border-radius: 16px; background: #fff; color: #171717; border: 1px solid #e5e5e5; line-height: 1.5; user-select: text; cursor: text; position: relative; min-height: 20px;";

    messageEl.appendChild(contentDiv);
    this._messagesDiv.appendChild(messageEl);
    this.scrollToBottom();

    return { messageEl, contentDiv };
  }

  typewriterRender(contentDiv: HTMLElement, content: string): Promise<void> {
    return new Promise((resolve) => {
      const doc = contentDiv.ownerDocument;
      if (!doc) {
        contentDiv.innerHTML = MarkdownRenderer.render(content);
        resolve();
        return;
      }

      // 注入光标样式（只注入一次）
      if (!doc.querySelector("#marginalia-cursor-style")) {
        const style = doc.createElement("style");
        style.id = "marginalia-cursor-style";
        style.textContent = `
          @keyframes marginalia-blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          .marginalia-cursor {
            display: inline-block;
            width: 2px;
            height: 1em;
            background: #171717;
            margin-left: 1px;
            vertical-align: text-bottom;
            animation: marginalia-blink 0.8s step-start infinite;
          }
        `;
        (doc.head || doc.documentElement)?.appendChild(style);
      }

      const totalLength = content.length;
      const intervalMs = 15;
      const chunkSize = Math.max(1, Math.ceil(totalLength / 200));
      let currentLength = 0;

      const timer = setInterval(() => {
        currentLength = Math.min(currentLength + chunkSize, totalLength);
        const currentText = content.substring(0, currentLength);
        const isDone = currentLength >= totalLength;

        contentDiv.innerHTML = MarkdownRenderer.render(currentText);

        if (!isDone) {
          const cursor = doc.createElement("span");
          cursor.className = "marginalia-cursor";
          contentDiv.appendChild(cursor);
        }

        this.scrollToBottom();

        if (isDone) {
          clearInterval(timer);
          resolve();
        }
      }, intervalMs);
    });
  }

  scrollToBottom(): void {
    const messagesDiv = this._messagesDiv as HTMLElement | null;
    if (!messagesDiv) return;
    messagesDiv.scrollTo({
      top: messagesDiv.scrollHeight,
      behavior: "smooth",
    });
  }

  showErrorMessage(error: unknown): void {
    if (!this._messagesDiv || !this._container) return;
    const doc = this._container.ownerDocument;
    if (!doc) return;

    // 移除空的 assistant 消息
    const lastAssistant = this._messagesDiv.querySelector(
      ".marginalia-message.assistant:last-of-type",
    );
    if (lastAssistant) {
      const content = lastAssistant.querySelector(
        ".marginalia-message-content",
      );
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
        <div style="font-weight: 500; margin-bottom: 4px;">${getString("chat-error-title")}</div>
        <div style="color: #991B1B; font-size: 12px;">${this._escapeHtml(errorMessage)}</div>
      </div>
    `;

    this._messagesDiv.appendChild(errorEl);
    this.scrollToBottom();
  }

  showWelcomePage(title: string): void {
    if (!this._messagesDiv || !this._container) return;
    const doc = this._container.ownerDocument;
    if (!doc) return;

    const welcome = doc.createElement("div");
    welcome.id = "marginalia-welcome";
    welcome.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 32px 24px;
      text-align: center;
      min-height: 300px;
    `;

    const truncatedTitle =
      title.length > 60 ? title.substring(0, 60) + "..." : title;

    welcome.innerHTML = `
      <div style="
        width: 48px; height: 48px; margin-bottom: 16px;
        background: linear-gradient(135deg, #D4AF37 0%, #F5D76E 100%);
        border-radius: 12px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);
      ">
        <span style="font-size: 24px; color: #fff; font-weight: 700;">M</span>
      </div>
      <div style="font-size: 16px; font-weight: 600; color: #171717; margin-bottom: 6px;">
        ${getString("chat-welcome-title")}
      </div>
      <div style="font-size: 13px; color: #9CA3AF; margin-bottom: ${truncatedTitle ? "8px" : "24px"}; line-height: 1.4;">
        ${getString("chat-welcome-subtitle")}
      </div>
      ${truncatedTitle ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 24px; padding: 6px 12px; background: #F5F5F5; border-radius: 6px; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this._escapeHtml(truncatedTitle)}</div>` : ""}
      <div id="marginalia-welcome-suggestions" style="display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 280px;"></div>
    `;

    this._messagesDiv.appendChild(welcome);

    // 添加快捷提问按钮
    const suggestions = [
      getString("chat-suggestion-summarize"),
      getString("chat-suggestion-contributions"),
      getString("chat-suggestion-methodology"),
      getString("chat-suggestion-limitations"),
    ];

    const suggestionsContainer = welcome.querySelector(
      "#marginalia-welcome-suggestions",
    );
    if (suggestionsContainer) {
      for (const text of suggestions) {
        const btn = doc.createElement("button");
        btn.textContent = text;
        btn.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          background: #FFFFFF;
          border: 1px solid #E5E5E5;
          border-radius: 10px;
          font-size: 13px;
          color: #171717;
          cursor: pointer;
          font-family: inherit;
          transition: background-color 0.15s, border-color 0.15s;
        `;
        btn.addEventListener("mouseenter", () => {
          btn.style.background = "#F5F5F5";
          btn.style.borderColor = "#D4AF37";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = "#FFFFFF";
          btn.style.borderColor = "#E5E5E5";
        });
        btn.addEventListener("click", () => {
          this._callbacks?.onSuggestionClick(text);
        });
        suggestionsContainer.appendChild(btn);
      }
    }
  }

  removeWelcomePage(): void {
    const welcome = this._container?.querySelector("#marginalia-welcome");
    if (welcome) welcome.remove();
  }

  showToast(message: string): void {
    const doc = this._container?.ownerDocument;
    if (!doc) return;

    // 移除已存在的 toast
    const existingToast = doc.querySelector(".marginalia-toast");
    if (existingToast) existingToast.remove();

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

    const win = doc.defaultView;
    if (win) {
      win.requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
      });
    } else {
      setTimeout(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
      }, 10);
    }

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  addCopyButtonToMessage(
    messageEl: HTMLElement,
    _content: string,
    _role: string,
  ): void {
    const doc = messageEl.ownerDocument;
    if (!doc) return;

    const contentDiv = messageEl.querySelector(
      ".marginalia-message-content",
    ) as HTMLElement;
    if (!contentDiv) return;

    contentDiv.style.position = "relative";

    const copyBtn = doc.createElement("button");
    copyBtn.className = "marginalia-copy-btn";
    copyBtn.textContent = getString("chat-copy-button");
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

    contentDiv.addEventListener("mouseenter", () => {
      copyBtn.style.opacity = "1";
    });
    contentDiv.addEventListener("mouseleave", () => {
      copyBtn.style.opacity = "0";
    });

    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const currentContent = contentDiv.textContent || "";
      await this._callbacks?.onCopyText(currentContent);
      copyBtn.textContent = getString("chat-copied-button");
      copyBtn.style.background = "#D4AF37";
      copyBtn.style.color = "#fff";
      copyBtn.style.borderColor = "#D4AF37";
      setTimeout(() => {
        copyBtn.textContent = getString("chat-copy-button");
        copyBtn.style.background = "rgba(255,255,255,0.9)";
        copyBtn.style.color = "#6B7280";
        copyBtn.style.borderColor = "#e5e5e5";
      }, 2000);
    });

    contentDiv.appendChild(copyBtn);
  }

  private _createSvgIcon(
    doc: Document,
    children: { tag: string; attrs: Record<string, string> }[],
  ): SVGSVGElement {
    const NS = "http://www.w3.org/2000/svg";
    const svg = doc.createElementNS(NS, "svg") as unknown as SVGSVGElement;
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const child of children) {
      const el = doc.createElementNS(NS, child.tag);
      for (const [key, value] of Object.entries(child.attrs)) {
        el.setAttribute(key, value);
      }
      svg.appendChild(el);
    }
    return svg;
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
