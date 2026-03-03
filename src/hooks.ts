import { getString, initLocale } from "./utils/locale";
import {
  registerPrefsScripts,
  registerPrefsPane,
} from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { ChatPanel } from "./modules/chatPanel";
import { StorageManager } from "./modules/storageManager";
import { SettingsManager } from "./modules/settingsManager";
import { TranslationPopup } from "./modules/translationPopup";
import { MarkdownRenderer } from "./utils/markdown";

const storageManager = new StorageManager();
const settingsManager = new SettingsManager(storageManager);
const chatPanel = new ChatPanel(storageManager, settingsManager);
const translationPopup = new TranslationPopup(settingsManager, chatPanel);

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // 初始化 Markdown 渲染器（包括 KaTeX 扩展）
  MarkdownRenderer.initialize();

  initLocale();
  await storageManager.init();
  addon.data.storageManager = storageManager;
  addon.data.settingsManager = settingsManager;

  registerPrefsPane();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  translationPopup.register();
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // 加载 CSS 样式
  const doc = win.document;

  // 注入 KaTeX CSS
  if (!doc.getElementById("marginalia-katex-styles")) {
    const katexLink = doc.createElement("link");
    katexLink.id = "marginalia-katex-styles";
    katexLink.rel = "stylesheet";
    katexLink.href = `chrome://${addon.data.config.addonRef}/content/katex.css`;
    doc.documentElement?.appendChild(katexLink);
  }

  // 注入自定义样式
  if (!doc.getElementById("marginalia-katex-custom-styles")) {
    const customLink = doc.createElement("link");
    customLink.id = "marginalia-katex-custom-styles";
    customLink.rel = "stylesheet";
    customLink.href = `chrome://${addon.data.config.addonRef}/content/katex-custom.css`;
    doc.documentElement?.appendChild(customLink);
  }

  // 加载聊天面板 CSS
  if (!doc.getElementById("marginalia-chat-styles")) {
    const link = doc.createElement("link");
    link.id = "marginalia-chat-styles";
    link.rel = "stylesheet";
    link.href = `chrome://${addon.data.config.addonRef}/content/chatPanel.css`;
    doc.documentElement?.appendChild(link);
  }

  await chatPanel.register();
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  translationPopup.unregister();
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(type: string) {
  // Placeholder for future shortcut handlers
}

function onDialogEvents(type: string) {
  // Placeholder for future dialog event handlers
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
