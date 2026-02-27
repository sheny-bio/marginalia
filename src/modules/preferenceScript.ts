import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { APIClient } from "./apiClient";
import { SettingsManager } from "./settingsManager";
import { StorageManager } from "./storageManager";

export function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
  });
}

export async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [],
      rows: [],
    };
  } else {
    addon.data.prefs.window = _window;
  }
  bindPrefEvents();
}

function bindPrefEvents() {
  const window = addon.data.prefs?.window;
  if (!window) return;

  const testBtn = window.document?.querySelector("#marginalia-test-connection");
  testBtn?.addEventListener("click", async () => {
    await testAPIConnection(window);
  });

  const saveBtn = window.document?.querySelector("#marginalia-save-settings");
  saveBtn?.addEventListener("click", async () => {
    await saveSettings(window);
  });
}

async function testAPIConnection(window: Window) {
  const testBtn = window.document?.querySelector(
    "#marginalia-test-connection",
  ) as HTMLButtonElement;
  const apiUrlInput = window.document?.querySelector(
    "#marginalia-apiUrl",
  ) as HTMLInputElement;
  const apiKeyInput = window.document?.querySelector(
    "#marginalia-apiKey",
  ) as HTMLInputElement;
  const modelInput = window.document?.querySelector(
    "#marginalia-model",
  ) as HTMLInputElement;

  const url = apiUrlInput?.value || "";
  const apiKey = apiKeyInput?.value || "";
  const model = modelInput?.value || "";

  if (!url || !apiKey || !model) {
    window.alert(getString("pref-fill-all-fields"));
    return;
  }

  const originalLabel =
    testBtn?.getAttribute("label") || getString("pref-test-connection-label");
  testBtn?.setAttribute("label", getString("pref-test-connection-testing"));
  testBtn?.setAttribute("disabled", "true");

  try {
    const client = new APIClient({ url, apiKey, model });
    const isConnected = await client.testConnection();

    if (isConnected) {
      window.alert(getString("pref-test-connection-success"));
    } else {
      window.alert(getString("pref-test-connection-failed"));
    }
  } catch (error) {
    window.alert(
      getString("pref-test-connection-error", {
        args: { error: String(error) },
      }),
    );
  } finally {
    testBtn?.setAttribute("label", originalLabel);
    testBtn?.removeAttribute("disabled");
  }
}

async function saveSettings(window: Window) {
  const storageManager = new StorageManager();
  const settingsManager = new SettingsManager(storageManager);

  const apiUrlInput = window.document?.querySelector(
    "#marginalia-apiUrl",
  ) as HTMLInputElement;
  const apiKeyInput = window.document?.querySelector(
    "#marginalia-apiKey",
  ) as HTMLInputElement;
  const modelInput = window.document?.querySelector(
    "#marginalia-model",
  ) as HTMLInputElement;

  const url = apiUrlInput?.value || "";
  const apiKey = apiKeyInput?.value || "";
  const model = modelInput?.value || "";

  if (!url || !apiKey || !model) {
    window.alert(getString("pref-fill-all-fields"));
    return;
  }

  try {
    await settingsManager.setAPIConfig(url, apiKey, model);
    window.alert(getString("pref-save-success"));
  } catch (error) {
    window.alert(
      getString("pref-save-failed", { args: { error: String(error) } }),
    );
  }
}
