import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FileRepository } from "./adapters/file-repository.js";
import { AgentOrchestrator } from "./agent/orchestrator.js";
import { MemorySessionStore } from "./agent/sessions.js";
import { OpenAiAdapter } from "./llm/openai.js";
import { createApi } from "./http/api.js";
import { configSchema } from "./config.js";
export { configSchema } from "./config.js";
export async function startServer(directory = process.cwd()) {
  const config = configSchema.parse(process.env);
  const prompt = await readFile(
    path.join(directory, "agent", "prompt.md"),
    "utf8",
  );
  const knowledge = await readFile(
    path.join(directory, "src", "knowledge", "registro-contratos.md"),
    "utf8",
  );
  const agent = new AgentOrchestrator({
    directory,
    prompt,
    knowledge,
    repository: new FileRepository(directory),
    adapter: new OpenAiAdapter(
      config.OPENAI_API_KEY,
      config.OPENAI_MODEL,
      fetch,
      config.LLM_TIMEOUT_MS,
    ),
    sessions: new MemorySessionStore(),
    maxIterations: config.MAX_ITERATIONS,
    maxSessionTokens: config.MAX_SESSION_TOKENS,
    maxOutputTokens: config.MAX_OUTPUT_TOKENS,
    maxSessions: config.MAX_SESSIONS,
    maxTotalTokens: config.MAX_TOTAL_TOKENS,
  });
  const handler = createApi({
    agent,
    provider: "openai",
    model: config.OPENAI_MODEL,
    configured: !!config.OPENAI_API_KEY,
  });
  const server = createServer(async (req, res) => {
    try {
      let body = "";
      let bytes = 0;
      for await (const chunk of req) {
        bytes += Buffer.byteLength(chunk as Buffer);
        if (bytes > 65536) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ ok: false, error: "Request body too large" }),
          );
          return;
        }
        body += String(chunk);
      }
      const host = req.headers.host ?? `127.0.0.1:${config.PORT}`;
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (typeof value === "string") headers.set(name, value);
      }
      const request = new Request(`http://${host}${req.url ?? "/"}`, {
        method: req.method,
        headers,
        ...(body ? { body } : {}),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: "Server could not complete the request",
        }),
      );
    }
  });
  server.listen(config.PORT, "127.0.0.1", () =>
    console.log(
      `ContractFlow backend listening at http://127.0.0.1:${config.PORT}`,
    ),
  );
  return { server, agent };
}
