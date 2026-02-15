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

  async chat(messages: Message[], onChunk?: (chunk: string) => void): Promise<string> {
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
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      return this.handleStream(response, onChunk);
    } catch (error) {
      throw new Error(`API call failed: ${error}`);
    }
  }

  private async handleStream(response: Response, onChunk?: (chunk: string) => void): Promise<string> {
    // @ts-ignore - ReadableStreamDefaultReader is available in browser context
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    let fullText = "";
    const decoder = new TextDecoder();

    while (true) {
      // @ts-ignore - reader.read() is available in browser context
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || "";
            if (content) {
              fullText += content;
              onChunk?.(content);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return fullText;
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

