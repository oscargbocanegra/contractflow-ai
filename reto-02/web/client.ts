import { z } from "zod";
const traceSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.unknown(),
  result: z.unknown(),
});
const pendingSchema = z.object({
  id: z.string(),
  mensajeId: z.string(),
  fields: z.array(z.string()),
  values: z.record(z.string(), z.unknown()),
});
export const responseSchema = z.object({
  sessionId: z.string(),
  reply: z.string(),
  toolCalls: z.array(traceSchema),
  needsConfirmation: z.boolean(),
  pendingReview: pendingSchema.optional(),
  tokensUsed: z.number(),
  error: z.string().optional(),
});
export const historySchema = z.object({
  sessionId: z.string(),
  messages: z.array(
    z.object({ role: z.string(), content: z.string().nullable() }),
  ),
  toolCalls: z.array(traceSchema),
  tokensUsed: z.number(),
  needsConfirmation: z.boolean(),
  pendingReview: pendingSchema.optional(),
  processing: z.boolean().optional(),
});
export const healthSchema = z.object({
  ok: z.boolean(),
  provider: z.string(),
  model: z.string(),
  configured: z.boolean(),
});
export type ToolTrace = z.infer<typeof traceSchema>;
export type PendingReview = z.infer<typeof pendingSchema>;
export type ChatResponse = z.infer<typeof responseSchema>;
export type ChatHistory = z.infer<typeof historySchema>;
export type Health = z.infer<typeof healthSchema>;
export async function requestJson(
  url: string,
  options: RequestInit = {},
  timeoutMs = 65000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (response.status === 404 && url.startsWith("/api/sessions/"))
      return null;
    if (!response.ok)
      throw new Error(
        `Request failed (${response.status}). Refresh history before retrying.`,
      );
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "Request timed out. The server may still be processing; refresh history before retrying.",
      );
    throw error instanceof Error
      ? error
      : new Error("Network request failed. Refresh history before retrying.");
  } finally {
    clearTimeout(timer);
  }
}
export function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "The server returned an invalid response. Refresh history before retrying.",
    );
  return parsed.data;
}
