export type ToolCall = { id: string; name: string; arguments: string };
export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
};
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};
export type LlmResponse = {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
};
export interface LlmAdapter {
  enviar(
    messages: LlmMessage[],
    tools: ToolDefinition[],
    maxOutputTokens: number,
  ): Promise<LlmResponse>;
}
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly billingUnknown = true,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
