export interface APIConfig {
  url: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

export type ContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "low" | "high" | "auto" };
    };

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

interface RawChatResult {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: string;
}

export class APIClient {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  private getEndpointUrl(): string {
    const url = this.config.url.replace(/\/+$/, "");
    // 如果路径最后一段是版本号（如 /v1、/v2、/v3），则补全 chat/completions
    // 否则认为用户提供的是完整端点 URL，直接使用
    const lastSegment = url.split("/").pop() ?? "";
    if (/^v\d+$/i.test(lastSegment) || lastSegment === "") {
      return `${url}/chat/completions`;
    }
    return url;
  }

  private async rawChat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<RawChatResult> {
    const url = this.getEndpointUrl();
    ztoolkit.log("[API] Request to:", url);
    ztoolkit.log("[API] Model:", this.config.model);
    ztoolkit.log("[API] Messages count:", messages.length);

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        return msg;
      }),
      temperature: this.config.temperature ?? 0.7,
      stream: false,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: ToolCall[];
        };
        finish_reason?: string;
      }[];
    };

    const choice = data.choices?.[0];
    const result: RawChatResult = {
      content: choice?.message?.content ?? null,
      finish_reason: choice?.finish_reason ?? "stop",
    };
    if (choice?.message?.tool_calls?.length) {
      result.tool_calls = choice.message.tool_calls;
    }

    ztoolkit.log(
      "[API] finish_reason:",
      result.finish_reason,
      "tool_calls:",
      result.tool_calls?.length ?? 0,
      "content length:",
      result.content?.length ?? 0,
    );
    return result;
  }

  async chat(messages: Message[]): Promise<string> {
    ztoolkit.log("[API] Simple chat, messages:", messages.length);
    try {
      const result = await this.rawChat(messages);
      return result.content || "";
    } catch (error) {
      ztoolkit.log("[API] Request failed:", error);
      throw new Error(`API call failed: ${error}`);
    }
  }

  /**
   * 带 Function Call 支持的对话。
   * 循环调用 API，执行工具，直到模型返回最终文本或达到最大工具调用轮数。
   *
   * @param messages       初始消息列表
   * @param tools          工具定义列表
   * @param onToolCall     工具执行回调，返回工具结果字符串
   * @param onStatus       状态更新回调，用于 UI 展示
   * @param maxToolRounds  最大工具调用轮数，默认 10
   */
  async chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    onToolCall: (
      toolName: string,
      toolArgs: Record<string, unknown>,
    ) => Promise<string | ContentPart[]>,
    onStatus: (status: string) => void,
    maxToolRounds: number = 10,
    signal?: AbortSignal,
  ): Promise<string> {
    const conversationMessages: Message[] = [...messages];
    let toolCallRound = 0;

    ztoolkit.log(
      "[API] chatWithTools start, tools:",
      tools.map((t) => t.function.name),
    );

    while (true) {
      const canCallTools = toolCallRound < maxToolRounds;
      const currentTools = canCallTools && tools.length > 0 ? tools : undefined;

      ztoolkit.log(
        `[API] chatWithTools round ${toolCallRound}/${maxToolRounds}, canCallTools: ${canCallTools}`,
      );

      let result: RawChatResult;
      try {
        result = await this.rawChat(conversationMessages, currentTools, signal);
      } catch (error) {
        ztoolkit.log("[API] rawChat failed:", error);
        throw new Error(`API call failed: ${error}`);
      }

      const wantsToolCall =
        result.finish_reason === "tool_calls" &&
        result.tool_calls &&
        result.tool_calls.length > 0;

      if (wantsToolCall && canCallTools) {
        // 将含 tool_calls 的 assistant 消息追加到对话
        conversationMessages.push({
          role: "assistant",
          content: result.content,
          tool_calls: result.tool_calls,
        });

        // 依次执行每个工具调用
        for (const toolCall of result.tool_calls!) {
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
          } catch (e) {
            ztoolkit.log(
              "[API] Failed to parse tool arguments:",
              toolCall.function.arguments,
              e,
            );
          }

          ztoolkit.log(
            "[API] Executing tool:",
            toolCall.function.name,
            "args:",
            toolArgs,
          );

          let toolResult: string | ContentPart[];
          try {
            toolResult = await onToolCall(toolCall.function.name, toolArgs);
          } catch (e) {
            toolResult = `工具调用出错: ${e}`;
            ztoolkit.log("[API] Tool execution failed:", e);
          }

          ztoolkit.log(
            "[API] Tool result length:",
            typeof toolResult === "string"
              ? toolResult.length
              : `${toolResult.length} parts`,
          );

          // 将工具结果追加到对话
          // 若结果含图片（ContentPart[]），tool 消息只放文本摘要，
          // 图片单独放到 user 消息中（多数 API 的 tool 消息不支持多模态）
          if (Array.isArray(toolResult)) {
            const textParts = toolResult
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("\n");
            const imageParts = toolResult.filter((p) => p.type === "image_url");

            conversationMessages.push({
              role: "tool",
              content: textParts || "OK",
              tool_call_id: toolCall.id,
            });

            if (imageParts.length > 0) {
              conversationMessages.push({
                role: "user",
                content: [
                  { type: "text" as const, text: textParts },
                  ...imageParts,
                ],
              });
            }
          } else {
            conversationMessages.push({
              role: "tool",
              content: toolResult,
              tool_call_id: toolCall.id,
            });
          }
        }

        toolCallRound++;
        onStatus("💭 正在生成回答...");
      } else {
        // 无工具调用，或已达最大轮数 → 返回最终文本
        if (!canCallTools && wantsToolCall) {
          ztoolkit.log(
            "[API] Max tool rounds reached, returning current content",
          );
        }
        return result.content || "";
      }
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
