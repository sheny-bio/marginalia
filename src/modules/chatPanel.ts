import { APIClient, Message } from "./apiClient";
import { StorageManager } from "./storageManager";
import { SettingsManager } from "./settingsManager";
import { ZoteroAPI } from "./zoteroAPI";
import { ChatUI } from "./chatUI";
import { ContextBuilder } from "./contextBuilder";
import * as chatActions from "./chatActions";
import { getString } from "../utils/locale";

interface StoredMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class ChatPanel {
  private currentItemID: number | null = null;
  private apiClient: APIClient | null = null;
  private lastAPIConfig: { url: string; apiKey: string; model: string } | null =
    null;
  private storageManager: StorageManager;
  private settingsManager: SettingsManager;
  private messages: StoredMessage[] = [];
  private currentItem: any = null;
  private quotes: string[] = [];
  private linkedCollection: { id: number; name: string } | null = null;
  private chatUI: ChatUI;
  private contextBuilder: ContextBuilder;
  private _abortController: AbortController | null = null;
  private _pagedContentCache: string | null = null;

  constructor(
    storageManager: StorageManager,
    settingsManager: SettingsManager,
  ) {
    this.storageManager = storageManager;
    this.settingsManager = settingsManager;
    this.chatUI = new ChatUI();
    this.contextBuilder = new ContextBuilder();
  }

  async register() {
    Zotero.ItemPaneManager.registerSection({
      paneID: "marginalia-chat",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: `${addon.data.config.addonRef}-chat-header`,
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
      },
      sidenav: {
        l10nID: `${addon.data.config.addonRef}-chat-sidenav`,
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
      },
      onRender: ({ body, item }) => {
        body.style.cssText = `
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
        `;

        if (!body.querySelector("#marginalia-container")) {
          this.chatUI.buildLayout(body, {
            onSend: () => this.sendMessage(),
            onAbort: () => {
              this._abortController?.abort();
            },
            onExport: () =>
              chatActions.exportAsMarkdown(
                { messages: this.messages, currentItem: this.currentItem },
                (msg) => this.chatUI.showToast(msg),
              ),
            onClear: () =>
              chatActions.showClearConfirmDialog(
                this.chatUI.getContainer()!,
                () => this.clearHistory(),
              ),
            onSaveAsNote: () =>
              chatActions.showSaveAsNoteDialog(
                this.chatUI.getContainer()!,
                {
                  messages: this.messages,
                  currentItem: this.currentItem,
                  currentItemID: this.currentItemID,
                  apiClient: this.apiClient,
                  settingsManager: this.settingsManager,
                },
                (msg) => this.chatUI.showToast(msg),
              ),
            onLibraryBtnClick: (anchorEl) => {
              const libraryID = this.currentItem
                ? this.currentItem.libraryID
                : Zotero.Libraries.userLibraryID;
              const collections = Zotero.Collections.getByLibrary(
                libraryID,
                true,
              );
              this.chatUI.showCollectionPicker(anchorEl, collections, (col) => {
                this.linkedCollection = { id: col.id, name: col.name };
                this.chatUI.renderLinkedCollection(this.linkedCollection);
              });
            },
            onSuggestionClick: (text) => {
              const input = this.chatUI.getInput();
              if (input) input.value = text;
              this.sendMessage();
            },
            onQuoteRemove: (index) => {
              this.quotes.splice(index, 1);
              this.chatUI.renderQuotes(this.quotes);
            },
            onLinkedCollectionRemove: () => {
              this.linkedCollection = null;
              this.chatUI.renderLinkedCollection(null);
            },
            onCopyText: async (text) => {
              const doc = this.chatUI.getContainer()?.ownerDocument;
              if (doc) {
                await chatActions.copyToClipboard(text, doc, (msg) =>
                  this.chatUI.showToast(msg),
                );
              }
            },
          });
        }
        this.onItemChange(item);
      },
    });
  }

  private async onItemChange(item: any) {
    if (item) {
      this.currentItemID = item.id;
      this.currentItem = item;
      this.quotes = [];
      this._pagedContentCache = null;
      this.chatUI.renderQuotes([]);
      await this.loadMessages();
    }
  }

  addQuote(text: string) {
    this.quotes.push(text);
    this.chatUI.renderQuotes(this.quotes);
    this.ensurePanelVisible();
  }

  private ensurePanelVisible() {
    try {
      const contextPane = ztoolkit.getGlobal("ZoteroContextPane");
      if (!contextPane) return;

      const splitter = contextPane.splitter;
      if (splitter?.getAttribute("state") === "collapsed") {
        contextPane.togglePane();
      }

      const sidenav = contextPane.sidenav as any;
      if (!sidenav) return;

      sidenav._collapsed = false;

      if (sidenav.container?.scrollToPane) {
        sidenav.container.scrollToPane("marginalia-chat", "smooth");
      }

      if (sidenav.render) {
        sidenav.render();
      }
    } catch (error) {
      ztoolkit.log("Error ensuring panel visible:", error);
    }
  }

  private async sendMessage() {
    const input = this.chatUI.getInput();
    if (!input) return;

    const message = input.value?.trim();
    if (!message || !this.currentItemID) return;

    input.value = "";
    input.style.height = "auto";
    this.chatUI.removeWelcomePage();
    this.chatUI.addMessage("user", message);
    this.chatUI.showLoading();
    this.chatUI.setSendState("loading");

    const win = this.chatUI.getContainer()?.ownerDocument?.defaultView as any;
    const AbortControllerClass =
      win?.AbortController ?? ztoolkit.getGlobal("AbortController");
    const abortController = new AbortControllerClass();
    this._abortController = abortController;

    try {
      const response = await this.callAPI(message, abortController.signal);
      this.chatUI.removeLoading();
      this.chatUI.setSendState("idle");

      const shell = this.chatUI.createAssistantMessageShell();
      if (shell) {
        await this.chatUI.typewriterRender(shell.contentDiv, response);
        this.chatUI.addCopyButtonToMessage(
          shell.messageEl,
          response,
          "assistant",
        );
      }

      await this.saveMessage("user", message);
      await this.saveMessage("assistant", response);
      this.quotes = [];
      this.chatUI.renderQuotes([]);
    } catch (error: unknown) {
      this.chatUI.removeLoading();
      this.chatUI.setSendState("idle");
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (!isAbort) {
        this.chatUI.showErrorMessage(error);
      }
    } finally {
      this._abortController = null;
    }
  }

  private async callAPI(
    userMessage: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const config = await this.settingsManager.getAPIConfig();
    if (
      !this.apiClient ||
      !this.lastAPIConfig ||
      this.lastAPIConfig.url !== config.url ||
      this.lastAPIConfig.apiKey !== config.apiKey ||
      this.lastAPIConfig.model !== config.model
    ) {
      this.apiClient = new APIClient(config);
      this.lastAPIConfig = {
        url: config.url,
        apiKey: config.apiKey,
        model: config.model,
      };
    }

    const enableVision = this.settingsManager.getEnableVision();

    // 若启用 vision，尝试从当前 PDF reader 获取带页码全文（带缓存）
    let pagedContent: string | null = null;
    let pdfReaderCtx: ReturnType<typeof ZoteroAPI.getActivePdfReaderContext> =
      null;
    if (enableVision) {
      pdfReaderCtx = ZoteroAPI.getActivePdfReaderContext();
      if (pdfReaderCtx) {
        if (!this._pagedContentCache) {
          this._pagedContentCache = await ZoteroAPI.getPaperContentWithPages(
            pdfReaderCtx.pdfViewer,
          );
        }
        pagedContent = this._pagedContentCache;
      }
    }

    const visionEffective = enableVision && !!pagedContent;

    const systemPrompt = await this.settingsManager.getSystemPrompt();
    const { systemMessage, tools } = await this.contextBuilder.build({
      itemID: this.currentItemID!,
      quotes: this.quotes,
      linkedCollection: this.linkedCollection,
      systemPrompt,
      onStatusUpdate: (s) => this.chatUI.updateLoadingStatus(s),
      enableVision: visionEffective,
      pagedContent,
    });

    const messages: Message[] = [
      { role: "system", content: systemMessage },
      ...this.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    // 构建 onGetPageImage 回调（tool call 时重新获取 context 以应对标签页切换）
    const onGetPageImage = visionEffective
      ? async (pageNumber: number): Promise<string | null> => {
          const ctx = ZoteroAPI.getActivePdfReaderContext();
          if (!ctx) return null;
          return ZoteroAPI.renderPageToBase64(ctx.pdfViewer, pageNumber);
        }
      : undefined;

    return this.apiClient.chatWithTools(
      messages,
      tools,
      (toolName, toolArgs) =>
        this.contextBuilder.executeToolCall(
          toolName,
          toolArgs,
          (s) => this.chatUI.updateLoadingStatus(s),
          onGetPageImage,
        ),
      (s) => this.chatUI.updateLoadingStatus(s),
      10,
      signal,
    );
  }

  private async loadMessages() {
    if (!this.currentItemID) return;

    const loadedMessages = await this.storageManager.getMessages(
      this.currentItemID,
    );
    this.messages = loadedMessages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));

    const container = this.chatUI.getContainer();
    const messagesDiv = container?.querySelector("#marginalia-messages");
    if (messagesDiv) {
      messagesDiv.innerHTML = "";
      if (this.messages.length === 0) {
        this.chatUI.showWelcomePage(
          this.currentItem?.getField?.("title") || "",
        );
      } else {
        for (const msg of this.messages) {
          this.chatUI.addMessage(msg.role, msg.content);
        }
      }
    }
  }

  private async saveMessage(role: string, content: string) {
    if (!this.currentItemID) return;

    await this.storageManager.saveMessage(this.currentItemID, role, content);
    this.messages.push({
      role: role as "user" | "assistant" | "system",
      content,
    });

    await this.enforceHistoryLimit();
  }

  private async enforceHistoryLimit() {
    if (!this.currentItemID) return;

    const maxRounds = await this.settingsManager.getMaxHistoryRounds();
    if (maxRounds <= 0) return;

    const userMessages = this.messages.filter((m) => m.role === "user");
    const currentRounds = userMessages.length;

    if (currentRounds > maxRounds) {
      const roundsToRemove = currentRounds - maxRounds;
      await this.storageManager.deleteOldestMessages(
        this.currentItemID,
        roundsToRemove * 2,
      );
      await this.loadMessages();
    }
  }

  private async clearHistory() {
    if (!this.currentItemID) return;

    await this.storageManager.clearMessages(this.currentItemID);
    this.messages = [];

    const container = this.chatUI.getContainer();
    const messagesDiv = container?.querySelector("#marginalia-messages");
    if (messagesDiv) {
      messagesDiv.innerHTML = "";
    }

    this.chatUI.showWelcomePage(this.currentItem?.getField?.("title") || "");
    this.chatUI.showToast(getString("chat-toast-cleared"));
  }
}
