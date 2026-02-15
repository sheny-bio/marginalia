import { generateText, streamText, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export interface APIConfig {
  url: string;
  apiKey: string;
  model: string;
  provider?: "openai" | "anthropic" | "openai-compatible";
  temperature?: number;
  maxTokens?: number;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export class APIClient {
  private config: APIConfig;
  private model: LanguageModel;

  constructor(config: APIConfig) {
    this.config = config;
    this.model = this.createModel();
  }

  private detectProvider(): "openai" | "anthropic" | "openai-compatible" {
    if (this.config.provider) return this.config.provider;

    const url = this.config.url.toLowerCase();
    if (url.includes("anthropic.com")) return "anthropic";
    if (url.includes("openai.com")) return "openai";
    return "openai-compatible";
  }

  private createModel(): LanguageModel {
    const provider = this.detectProvider();
    ztoolkit.log("[API] Detected provider:", provider);

    switch (provider) {
      case "anthropic": {
        const anthropic = createAnthropic({
          apiKey: this.config.apiKey,
          baseURL: this.config.url || undefined,
        });
        return anthropic(this.config.model);
      }
      case "openai": {
        const openai = createOpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.url || undefined,
        });
        return openai(this.config.model);
      }
      default: {
        // OpenAI-compatible API (most third-party services)
        const openaiCompatible = createOpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.url,
        });
        return openaiCompatible(this.config.model);
      }
    }
  }

  async chat(messages: Message[], onChunk?: (chunk: string) => void): Promise<string> {
    ztoolkit.log("[API] Request with model:", this.config.model);
    ztoolkit.log("[API] Messages count:", messages.length);

    try {
      if (onChunk) {
        // 流式输出
        const result = await streamText({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: this.config.temperature ?? 0.7,
          maxOutputTokens: this.config.maxTokens ?? 2000,
        });

        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          onChunk(chunk);
        }

        ztoolkit.log("[API] Stream completed, total length:", fullText.length);
        return fullText;
      } else {
        // 非流式输出
        const result = await generateText({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: this.config.temperature ?? 0.7,
          maxOutputTokens: this.config.maxTokens ?? 2000,
        });

        ztoolkit.log("[API] Response length:", result.text.length);
        return result.text;
      }
    } catch (error) {
      ztoolkit.log("[API] Request failed:", error);
      throw new Error(`API call failed: ${error}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await generateText({
        model: this.model,
        messages: [{ role: "user", content: "Hi" }],
        maxOutputTokens: 10,
      });
      return !!result.text;
    } catch (error) {
      ztoolkit.log("[API] Test connection failed:", error);
      return false;
    }
  }
}
