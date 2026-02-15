import { StorageManager } from "./storageManager";

const PREF_PREFIX = "extensions.zotero.marginalia";

export class SettingsManager {
  private storage: StorageManager;

  constructor(storage: StorageManager) {
    this.storage = storage;
  }

  private getPref(key: string): string | null {
    try {
      return Zotero.Prefs.get(`${PREF_PREFIX}.${key}`, true) as string | null;
    } catch {
      return null;
    }
  }

  private setPref(key: string, value: string) {
    Zotero.Prefs.set(`${PREF_PREFIX}.${key}`, value, true);
  }

  async getAPIConfig() {
    const url = this.getPref("apiUrl");
    const apiKey = this.getPref("apiKey");
    const model = this.getPref("model");

    return {
      url: url || "https://api.openai.com/v1",
      apiKey: apiKey || "",
      model: model || "gpt-4o-mini",
    };
  }

  async setAPIConfig(url: string, apiKey: string, model: string) {
    this.setPref("apiUrl", url);
    this.setPref("apiKey", apiKey);
    this.setPref("model", model);
  }

  async getMaxHistoryRounds(): Promise<number> {
    const value = this.getPref("maxHistoryRounds");
    return parseInt(value || "20", 10);
  }

  async setMaxHistoryRounds(rounds: number) {
    this.setPref("maxHistoryRounds", rounds.toString());
  }

  async getSystemPrompt(): Promise<string> {
    const value = this.getPref("systemPrompt");
    return (
      value ||
      "You are a helpful academic paper analysis assistant. Provide clear, concise answers based on the paper content."
    );
  }

  async setSystemPrompt(prompt: string) {
    this.setPref("systemPrompt", prompt);
  }

  async isToolCallingEnabled(): Promise<boolean> {
    const value = this.getPref("enableToolCalling");
    return value === "true";
  }

  async setToolCallingEnabled(enabled: boolean) {
    this.setPref("enableToolCalling", enabled.toString());
  }
}
