import { z } from "zod";
import {
  ProviderError,
  type LlmAdapter,
  type LlmMessage,
  type LlmResponse,
  type ToolDefinition,
} from "./adapter.js";
const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.literal("function"),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
  usage: z.object({
    prompt_tokens: z.number().nonnegative(),
    completion_tokens: z.number().nonnegative(),
  }),
});
export class OpenAiAdapter implements LlmAdapter {
  constructor(
    private readonly apiKey: string,
    readonly model = "gpt-4.1",
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 25000,
  ) {}
  async enviar(
    messages: LlmMessage[],
    tools: ToolDefinition[],
    maxOutputTokens: number,
  ): Promise<LlmResponse> {
    if (!this.apiKey)
      throw new ProviderError(
        "Model provider is not configured. Add OPENAI_API_KEY to the backend environment.",
        false,
      );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + this.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            messages: messages.map((item) => ({
              role: item.role,
              content: item.content,
              ...(item.toolCallId ? { tool_call_id: item.toolCallId } : {}),
              ...(item.toolCalls?.length
                ? {
                    tool_calls: item.toolCalls.map((call) => ({
                      id: call.id,
                      type: "function",
                      function: { name: call.name, arguments: call.arguments },
                    })),
                  }
                : {}),
            })),
            tools: tools.map((tool) => ({
              type: "function",
              function: { ...tool, strict: false },
            })),
            tool_choice: "auto",
            parallel_tool_calls: false,
            max_completion_tokens: maxOutputTokens,
            store: false,
          }),
        },
      );
      if (!response.ok)
        throw new ProviderError(
          response.status === 429
            ? "Model provider rate limit reached. Retry later."
            : "Model provider request failed. Check backend configuration and account access.",
        );
      const parsed = completionSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new ProviderError("Model provider returned an invalid response.");
      const value = parsed.data;
      const message = value.choices[0]!.message;
      return {
        content: message.content ?? null,
        toolCalls: (message.tool_calls ?? []).map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        })),
        usage: {
          inputTokens: value.usage.prompt_tokens,
          outputTokens: value.usage.completion_tokens,
        },
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (controller.signal.aborted)
        throw new ProviderError(
          "Model provider timed out. The session is preserved; retry later.",
        );
      throw new ProviderError(
        "Model provider is unavailable. The session is preserved; retry later.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
