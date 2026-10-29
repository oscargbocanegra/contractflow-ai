import prompt from "../agent/prompt.md";
import knowledge from "./knowledge/registro-contratos.md";
import { fixtureBundle } from "./generated/fixture-bundle.js";
import { D1Repository } from "./adapters/d1-repository.js";
import { D1SessionStore } from "./adapters/d1-sessions.js";
import { D1BudgetAdapter } from "./adapters/d1-budget.js";
import type { D1Db } from "./adapters/d1-types.js";
import { AgentOrchestrator, chatRequestSchema } from "./agent/orchestrator.js";
import { OpenAiAdapter } from "./llm/openai.js";
import { createApi } from "./http/api.js";
import { configSchema } from "./config.js";
export type WorkerEnv = {
  DB: D1Db;
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  MAX_ITERATIONS?: string;
  MAX_SESSION_TOKENS?: string;
  MAX_OUTPUT_TOKENS?: string;
  MAX_SESSIONS?: string;
  MAX_TOTAL_TOKENS?: string;
  LLM_TIMEOUT_MS?: string;
};
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      return json(
        { ok: false, error: "Cross-origin requests are not allowed" },
        403,
      );
    try {
      const config = configSchema.parse(env);
      const publicStore = new D1SessionStore(env.DB);
      let repository = new D1Repository(env.DB, fixtureBundle);
      if (request.method === "GET" && url.pathname === "/api/health") {
        const ready = await env.DB.prepare(
          "SELECT id FROM quota_budget WHERE id=1",
        ).first();
        return json(
          {
            ok: !!ready,
            provider: "openai",
            model: config.OPENAI_MODEL,
            configured: !!config.OPENAI_API_KEY,
            persistence: "d1",
            databaseReady: !!ready,
          },
          ready ? 200 : 503,
        );
      }
      if (
        request.method === "GET" &&
        url.pathname.startsWith("/api/exports/")
      ) {
        let name: string;
        try {
          name = decodeURIComponent(url.pathname.slice("/api/exports/".length));
        } catch {
          return json({ ok: false, error: "Invalid export path" }, 400);
        }
        const result = await repository.exported(name);
        return result
          ? new Response(result.content, {
              headers: {
                "Content-Type": result.type,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
              },
            })
          : json({ ok: false, error: "Export not found" }, 404);
      }
      if (
        request.method === "GET" &&
        url.pathname.startsWith("/api/sessions/")
      ) {
        const id = url.pathname.slice("/api/sessions/".length);
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id))
          return json({ ok: false, error: "Invalid session identifier" }, 400);
        const session = await publicStore.get(id);
        if (!session)
          return json({ ok: false, error: "Session not found" }, 404);
        const agent = new AgentOrchestrator({
          directory: ".",
          prompt,
          knowledge,
          repository,
          adapter: new OpenAiAdapter(
            config.OPENAI_API_KEY,
            config.OPENAI_MODEL,
          ),
          sessions: publicStore,
        });
        const history = await agent.history(id);
        return json({
          ...history,
          processing: await publicStore.processing(id),
        });
      }
      if (request.method !== "POST" || url.pathname !== "/api/chat")
        return json({ ok: false, error: "Not found" }, 404);
      if (Number(request.headers.get("Content-Length") ?? "0") > 65536)
        return json({ ok: false, error: "Request body too large" }, 413);
      const raw = await request.clone().text();
      if (new TextEncoder().encode(raw).length > 65536)
        return json({ ok: false, error: "Request body too large" }, 413);
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ ok: false, error: "Invalid JSON request" }, 400);
      }
      const parsed = chatRequestSchema.safeParse(body);
      if (!parsed.success)
        return json({ ok: false, error: "Invalid chat request" }, 400);
      const lease = {
        sessionId: parsed.data.sessionId,
        owner: crypto.randomUUID(),
      };
      if (!(await publicStore.acquire(lease.sessionId, lease.owner)))
        return json(
          {
            ok: false,
            error:
              "This session is already processing. Refresh history before retrying.",
          },
          409,
        );
      const heartbeat = setInterval(() => {
        void publicStore.renew(lease).catch(() => false);
      }, 15000);
      try {
        repository = new D1Repository(env.DB, fixtureBundle, lease);
        const sessions = new D1SessionStore(env.DB, lease, config.MAX_SESSIONS);
        const provider = new D1BudgetAdapter(
          env.DB,
          new OpenAiAdapter(
            config.OPENAI_API_KEY,
            config.OPENAI_MODEL,
            fetch,
            config.LLM_TIMEOUT_MS,
          ),
          lease,
          config.MAX_SESSION_TOKENS,
          config.MAX_TOTAL_TOKENS,
        );
        const agent = new AgentOrchestrator({
          directory: ".",
          prompt,
          knowledge,
          repository,
          adapter: provider,
          sessions,
          maxIterations: config.MAX_ITERATIONS,
          maxSessionTokens: config.MAX_SESSION_TOKENS,
          maxOutputTokens: config.MAX_OUTPUT_TOKENS,
          maxSessions: config.MAX_SESSIONS,
          maxTotalTokens: config.MAX_TOTAL_TOKENS,
        });
        return await createApi({
          agent,
          provider: "openai",
          model: config.OPENAI_MODEL,
          configured: !!config.OPENAI_API_KEY,
        })(request);
      } finally {
        clearInterval(heartbeat);
        await publicStore.release(lease);
      }
    } catch {
      return json(
        {
          ok: false,
          error:
            "Worker persistence or configuration unavailable. Apply migrations and inspect preserved state before retrying.",
        },
        503,
      );
    }
  },
};
