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
    const requestUrl = `${this.config.url}/chat/completions`;
    const requestBody = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 2000,
      stream: true,
    };

    ztoolkit.log("[API] Request URL:", requestUrl);
    ztoolkit.log("[API] Model:", this.config.model);
    ztoolkit.log("[API] API Key (first 10 chars):", this.config.apiKey?.substring(0, 10) + "...");

    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      ztoolkit.log("[API] Response status:", response.status);
      const contentType = response.headers.get("content-type") || "";
      ztoolkit.log("[API] Content-Type:", contentType);

      if (!response.ok) {
        const errorText = await response.text();
        ztoolkit.log("[API] Error response body:", errorText);
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      // 根据 content-type 决定处理方式
      if (contentType.includes("text/event-stream")) {
        return this.handleStream(response, onChunk);
      } else {
        // 非流式响应，直接解析 JSON
        return this.handleNonStream(response, onChunk);
      }
    } catch (error) {
      ztoolkit.log("[API] Request failed:", error);
      throw new Error(`API call failed: ${error}`);
    }
  }

  private async handleNonStream(response: Response, onChunk?: (chunk: string) => void): Promise<string> {
    const text = await response.text();
    ztoolkit.log("[API] Raw response:", text.substring(0, 500));

    try {
      const json = JSON.parse(text);
      const content = json.choices?.[0]?.message?.content || json.content?.[0]?.text || "";
      ztoolkit.log("[API] Parsed content:", content.substring(0, 100));
      onChunk?.(content);
      return content;
    } catch (error) {
      ztoolkit.log("[API] JSON parse error:", error);
      // 如果不是 JSON，可能是 HTML 错误页面
      throw new Error(`Invalid response format: ${text.substring(0, 200)}`);
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

