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
      "你是一位专业的学术论文分析助手。请基于论文内容提供清晰、简洁的回答。请使用中文回复，但专业术语（如 Transformer、Attention、Gradient Descent 等）保留英文原文，不要强行翻译。"
    );
  }

  async setSystemPrompt(prompt: string) {
    this.setPref("systemPrompt", prompt);
  }
}
