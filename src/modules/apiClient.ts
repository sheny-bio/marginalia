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

  async chat(
    messages: Message[],
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
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
      stream: !!onChunk,
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

      if (onChunk && body.stream) {
        return await this.handleStreamResponse(response, onChunk);
      } else {
        return await this.handleJsonResponse(response);
      }
    } catch (error) {
      ztoolkit.log("[API] Request failed:", error);
      throw new Error(`API call failed: ${error}`);
    }
  }

  private async handleJsonResponse(response: Response): Promise<string> {
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content || "";
    ztoolkit.log("[API] Response length:", content.length);
    return content;
  }

  private async handleStreamResponse(
    response: Response,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const reader = response.body?.getReader() as
      | ReadableStreamDefaultReader<Uint8Array>
      | undefined;
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await (
        reader as ReadableStreamDefaultReader<Uint8Array>
      ).read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (_e) {
          // Skip invalid JSON
        }
      }
    }

    ztoolkit.log("[API] Stream completed, total length:", fullText.length);
    return fullText;
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
