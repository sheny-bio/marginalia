export interface APIConfig {
  url: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export class APIClient {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  async chat(messages: Message[]): Promise<string> {
    try {
      const response = await fetch(`${this.config.url}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 2000,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = (await response.json()) as any;
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      throw new Error(`API call failed: ${error}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
