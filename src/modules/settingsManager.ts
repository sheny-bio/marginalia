import { StorageManager } from "./storageManager";

export class SettingsManager {
  private storage: StorageManager;

  constructor(storage: StorageManager) {
    this.storage = storage;
  }

  async getAPIConfig() {
    const url = await this.storage.getSetting("apiUrl");
    const apiKey = await this.storage.getSetting("apiKey");
    const model = await this.storage.getSetting("model");

    return {
      url: url || "https://api.openai.com/v1",
      apiKey: apiKey || "",
      model: model || "gpt-4o-mini",
    };
  }

  async setAPIConfig(url: string, apiKey: string, model: string) {
    await this.storage.saveSetting("apiUrl", url);
    await this.storage.saveSetting("apiKey", apiKey);
    await this.storage.saveSetting("model", model);
  }

  async getMaxHistoryRounds(): Promise<number> {
    const value = await this.storage.getSetting("maxHistoryRounds");
    return parseInt(value || "20", 10);
  }

  async setMaxHistoryRounds(rounds: number) {
    await this.storage.saveSetting("maxHistoryRounds", rounds.toString());
  }

  async getSystemPrompt(): Promise<string> {
    return (
      (await this.storage.getSetting("systemPrompt")) ||
      "You are a helpful academic paper analysis assistant."
    );
  }

  async setSystemPrompt(prompt: string) {
    await this.storage.saveSetting("systemPrompt", prompt);
  }

  async isToolCallingEnabled(): Promise<boolean> {
    const value = await this.storage.getSetting("enableToolCalling");
    return value === "true";
  }

  async setToolCallingEnabled(enabled: boolean) {
    await this.storage.saveSetting("enableToolCalling", enabled.toString());
  }
}
