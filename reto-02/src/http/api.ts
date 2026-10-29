import { z } from "zod";
import { AgentOrchestrator, chatRequestSchema } from "../agent/orchestrator.js";
export type ApiOptions = {
  agent: AgentOrchestrator;
  provider: string;
  model: string;
  configured: boolean;
  maxBodyBytes?: number;
};
export function createApi(
  options: ApiOptions,
): (request: Request) => Promise<Response> {
  const json = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  return async (request: Request) => {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      return json(
        { ok: false, error: "Cross-origin requests are not allowed" },
        403,
      );
    if (request.method === "GET" && url.pathname === "/api/health")
      return json({
        ok: true,
        provider: options.provider,
        model: options.model,
        configured: options.configured,
      });
    if (request.method === "GET" && url.pathname.startsWith("/api/sessions/")) {
      const id = url.pathname.slice("/api/sessions/".length);
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id))
        return json({ ok: false, error: "Invalid session identifier" }, 400);
      const history = await options.agent.history(id);
      return history
        ? json(history)
        : json({ ok: false, error: "Session not found" }, 404);
    }
    if (request.method === "POST" && url.pathname === "/api/chat") {
      if (!request.headers.get("Content-Type")?.includes("application/json"))
        return json(
          { ok: false, error: "Content-Type must be application/json" },
          415,
        );
      const limit = options.maxBodyBytes ?? 65536;
      if (Number(request.headers.get("Content-Length") ?? "0") > limit)
        return json({ ok: false, error: "Request body too large" }, 413);
      try {
        const text = await request.text();
        if (new TextEncoder().encode(text).length > limit)
          return json({ ok: false, error: "Request body too large" }, 413);
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return json({ ok: false, error: "Invalid JSON request" }, 400);
        }
        const body = chatRequestSchema.safeParse(parsed);
        if (!body.success)
          return json({ ok: false, error: "Invalid chat request" }, 400);
        return json(await options.agent.chat(body.data));
      } catch (error) {
        if (error instanceof z.ZodError)
          return json({ ok: false, error: "Invalid chat request" }, 400);
        return json(
          {
            ok: false,
            error:
              "Chat request could not be completed. Existing session history is preserved.",
          },
          503,
        );
      }
    }
    return json({ ok: false, error: "Not found" }, 404);
  };
}
