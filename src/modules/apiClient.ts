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
    const url = this.config.url.endsWith("/")
      ? `${this.config.url}chat/completions`
      : `${this.config.url}/chat/completions`;

    ztoolkit.log("[API] Request to:", url);
    ztoolkit.log("[API] Model:", this.config.model);
    ztoolkit.log("[API] Messages count:", messages.length);

    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 2000,
      stream: false,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content || "";
      ztoolkit.log("[API] Response length:", content.length);
      return content;
    } catch (error) {
      ztoolkit.log("[API] Request failed:", error);
      throw new Error(`API call failed: ${error}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.chat([{ role: "user", content: "Hi" }]);
      return !!result;
    } catch (error) {
      ztoolkit.log("[API] Test connection failed:", error);
      return false;
    }
  }
}
