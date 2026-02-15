import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { APIClient } from "./apiClient";
import { SettingsManager } from "./settingsManager";
import { StorageManager } from "./storageManager";

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
}

async function testAPIConnection(window: Window) {
  const apiUrlInput = window.document?.querySelector("#marginalia-apiUrl") as HTMLInputElement;
  const apiKeyInput = window.document?.querySelector("#marginalia-apiKey") as HTMLInputElement;
  const modelInput = window.document?.querySelector("#marginalia-model") as HTMLInputElement;

  const url = apiUrlInput?.value || "";
  const apiKey = apiKeyInput?.value || "";
  const model = modelInput?.value || "";

  if (!url || !apiKey || !model) {
    window.alert("Please fill in all API configuration fields");
    return;
  }

  try {
    const client = new APIClient({ url, apiKey, model });
    const isConnected = await client.testConnection();

    if (isConnected) {
      window.alert("✓ API connection successful!");
    } else {
      window.alert("✗ API connection failed. Please check your settings.");
    }
  } catch (error) {
    window.alert(`✗ Connection error: ${error}`);
  }
}
