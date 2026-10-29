import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { FileRepository } from "../src/adapters/file-repository.js";
import {
  AgentOrchestrator,
  type ChatRequest,
} from "../src/agent/orchestrator.js";
import { MemorySessionStore } from "../src/agent/sessions.js";
import { OpenAiAdapter } from "../src/llm/openai.js";
import {
  ProviderError,
  type LlmAdapter,
  type LlmMessage,
  type LlmResponse,
  type ToolCall,
} from "../src/llm/adapter.js";
import type { Contract } from "../src/domain/contracts.js";
import { createApi } from "../src/http/api.js";
const root = process.cwd();
let output: string;
let repository: FileRepository;
let sessions: MemorySessionStore;
let prompt: string;
let knowledge: string;
beforeEach(async () => {
  output = path.join(root, "out", "agent-test-" + randomUUID());
  repository = new FileRepository(root, output);
  sessions = new MemorySessionStore();
  prompt = await readFile(path.join(root, "agent", "prompt.md"), "utf8");
  knowledge = await readFile(
    path.join(root, "src", "knowledge", "registro-contratos.md"),
    "utf8",
  );
});
afterEach(async () => {
  await rm(output, { recursive: true, force: true });
});
const response = (
  calls: ToolCall[] = [],
  content: string | null = null,
): LlmResponse => ({
  content,
  toolCalls: calls,
  usage: { inputTokens: 100, outputTokens: 50 },
});
const call = (name: string, args: unknown): ToolCall => ({
  id: randomUUID(),
  name,
  arguments: JSON.stringify(args),
});
class ScriptedAdapter implements LlmAdapter {
  count = 0;
  constructor(
    private readonly steps: Array<
      (messages: LlmMessage[]) => LlmResponse | Promise<LlmResponse>
    > = [],
  ) {}
  async enviar(messages: LlmMessage[]) {
    const step = this.steps[this.count++];
    return step
      ? step(messages)
      : response([], "Unverified model text must not be shown");
  }
}
function agent(
  adapter: LlmAdapter,
  options: Partial<ConstructorParameters<typeof AgentOrchestrator>[0]> = {},
) {
  return new AgentOrchestrator({
    directory: root,
    prompt,
    knowledge,
    repository,
    sessions,
    adapter,
    ...options,
  });
}
function latestCandidate(messages: LlmMessage[]): Contract {
  const result = JSON.parse(
    messages.filter((item) => item.role === "tool").at(-1)!.content!,
  ) as { data: Contract };
  return result.data;
}
async function pendingAgent() {
  let candidate: Contract;
  const adapter = new ScriptedAdapter([
    () => response([call("contratos_extraer", { mensaje_id: "msg-006" })]),
    (messages) => {
      candidate = latestCandidate(messages);
      return response([
        call("contratos_validar", {
          mensaje_id: "msg-006",
          contrato: candidate,
        }),
      ]);
    },
  ]);
  const orchestrator = agent(adapter);
  const first = await orchestrator.chat({
    sessionId: "session-one",
    message: "Process mailbox with hoy 2026-09-03",
  });
  return { orchestrator, first, adapter };
}
describe("real OpenAI HTTP adapter with explicitly controlled fetch", () => {
  it("sends actual Chat Completions schema and parses provider tool calls/usage", async () => {
    let captured: RequestInit | undefined;
    const fetcher: typeof fetch = async (_url, init) => {
      captured = init;
      return Response.json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call-real",
                  type: "function",
                  function: { name: "contratos_leer_buzon", arguments: "{}" },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      });
    };
    const adapter = new OpenAiAdapter("test-only-not-live", "gpt-4.1", fetcher);
    const result = await adapter.enviar(
      [{ role: "user", content: "Read mailbox" }],
      [
        {
          name: "contratos_leer_buzon",
          description: "Read",
          parameters: { type: "object", properties: {} },
        },
      ],
      100,
    );
    const body = JSON.parse(captured!.body as string) as Record<
      string,
      unknown
    >;
    expect(body.model).toBe("gpt-4.1");
    expect(body.max_completion_tokens).toBe(100);
    expect(body.store).toBe(false);
    expect(body.parallel_tool_calls).toBe(false);
    expect(result.toolCalls[0]!.name).toBe("contratos_leer_buzon");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 8 });
    expect((captured!.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-only-not-live",
    );
  });
  it("never exposes secret-bearing provider error bodies or network errors", async () => {
    const fetcher: typeof fetch = async () =>
      new Response("secret-private-token", { status: 401 });
    await expect(
      new OpenAiAdapter("private", "gpt-4.1", fetcher).enviar([], [], 10),
    ).rejects.toThrow("Model provider request failed");
    try {
      await new OpenAiAdapter("private", "gpt-4.1", async () => {
        throw new Error("secret-private-token");
      }).enviar([], [], 10);
    } catch (error) {
      expect(String(error)).not.toContain("secret-private-token");
    }
  });
  it("times out with a sanitized explicit error", async () => {
    const fetcher: typeof fetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () =>
          reject(new Error("raw secret timeout")),
        );
      });
    await expect(
      new OpenAiAdapter("private", "gpt-4.1", fetcher, 5).enviar([], [], 10),
    ).rejects.toThrow("timed out");
  });
  it("missing key fails before any network request", async () => {
    let called = false;
    const fetcher: typeof fetch = async () => {
      called = true;
      return Response.json({});
    };
    await expect(
      new OpenAiAdapter("", "gpt-4.1", fetcher).enviar([], [], 10),
    ).rejects.toThrow("not configured");
    expect(called).toBe(false);
  });
});
describe("bounded agent and independent human authority", () => {
  it("duplicate informational review fields do not advertise an actionable human review", async () => {
    const before = await repository.readState();
    const adapter = new ScriptedAdapter([
      () => response([call("contratos_extraer", { mensaje_id: "msg-004" })]),
      (messages) =>
        response([
          call("contratos_validar", {
            mensaje_id: "msg-004",
            contrato: latestCandidate(messages),
          }),
        ]),
    ]);
    const orchestrator = agent(adapter);
    const result = await orchestrator.chat({
      sessionId: "duplicate-summary",
      message: "Process msg-004 with hoy 2026-09-03",
    });
    const validation = result.toolCalls.find(
      (trace) => trace.name === "contratos_validar",
    )!.result as {
      data: { clasificacion: string; requiere_revision: string[] };
    };
    expect(validation.data.clasificacion).toBe("duplicado");
    expect(validation.data.requiere_revision.length).toBeGreaterThan(0);
    expect(result.reply).toContain("msg-004: duplicado");
    expect(result.reply).not.toContain("human review required");
    expect(result.reply).not.toContain("Human confirmation required");
    expect(result.needsConfirmation).toBe(false);
    expect(result.pendingReview).toBeUndefined();
    expect(
      (await orchestrator.history("duplicate-summary"))!.pendingReview,
    ).toBeUndefined();
    expect(await repository.readState()).toEqual(before);
  });
  it("global token ceiling and maximum session count prevent endless new-session spending", async () => {
    const adapter = new ScriptedAdapter([
      () => ({
        ...response(),
        usage: { inputTokens: 47000, outputTokens: 1000 },
      }),
    ]);
    const orchestrator = agent(adapter, { maxTotalTokens: 50000 });
    await orchestrator.chat({ sessionId: "session-one", message: "Hello" });
    expect(
      (await orchestrator.chat({ sessionId: "session-two", message: "Hello" }))
        .error,
    ).toBe("token_budget");
    expect(adapter.count).toBe(1);
    const limited = agent(new ScriptedAdapter(), {
      sessions: new MemorySessionStore(),
      maxSessions: 1,
    });
    await limited.chat({ sessionId: "session-one", message: "Hello" });
    await expect(
      limited.chat({ sessionId: "session-two", message: "Hello" }),
    ).rejects.toThrow("capacity");
  });
  it("concurrent requests cannot race the same session turn", async () => {
    let release: (value: LlmResponse) => void = () => undefined;
    const adapter: LlmAdapter = {
      enviar: async () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    };
    const orchestrator = agent(adapter);
    const first = orchestrator.chat({
      sessionId: "session-one",
      message: "Hello",
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(
      orchestrator.chat({ sessionId: "session-one", message: "Second" }),
    ).rejects.toThrow("active request");
    release(response());
    await first;
  });
  it("runs extract -> validate -> register and displays only tool-backed final facts", async () => {
    let candidate: Contract;
    const adapter = new ScriptedAdapter([
      () => response([call("contratos_extraer", { mensaje_id: "msg-001" })]),
      (messages) => {
        candidate = latestCandidate(messages);
        return response([
          call("contratos_validar", {
            mensaje_id: "msg-001",
            contrato: candidate,
          }),
        ]);
      },
      () =>
        response([
          call("contratos_registrar", {
            mensaje_id: "msg-001",
            contrato: candidate,
          }),
        ]),
      () => response([], "Contract value is FAKE-999999"),
    ]);
    const orchestrator = agent(adapter);
    const result = await orchestrator.chat({
      sessionId: "session-one",
      message: "Register the first contract 2026-09-03",
    });
    expect(result.needsConfirmation).toBe(false);
    expect(result.reply).toContain("create CT-2026-015");
    expect(result.reply).not.toContain("FAKE-999999");
    expect(result.toolCalls).toHaveLength(3);
    expect((await repository.readState()).contratos).toHaveLength(9);
    expect((await orchestrator.history("session-one"))!.toolCalls).toHaveLength(
      3,
    );
    const logs = (await readFile(path.join(output, "log.jsonl"), "utf8"))
      .trim()
      .split("\n");
    expect(logs).toHaveLength(3);
  });
  it("unknown tool and invalid JSON are visible typed errors and do not abort the loop", async () => {
    const malformed = call("contratos_extraer", {});
    malformed.arguments = "{";
    const adapter = new ScriptedAdapter([
      () => response([call("not_a_tool", {})]),
      () => response([malformed]),
      () => response([call("contratos_leer_buzon", {})]),
    ]);
    const result = await agent(adapter).chat({
      sessionId: "session-one",
      message: "Read mailbox",
    });
    expect(result.toolCalls).toHaveLength(3);
    expect((result.toolCalls[0]!.result as { ok: boolean }).ok).toBe(false);
    expect((result.toolCalls[1]!.result as { ok: boolean }).ok).toBe(false);
    expect((result.toolCalls[2]!.result as { ok: boolean }).ok).toBe(true);
  });
  it("LLM cannot self-confirm an extracted ambiguous contract", async () => {
    let candidate: Contract;
    const adapter = new ScriptedAdapter([
      () => response([call("contratos_extraer", { mensaje_id: "msg-006" })]),
      (messages) => {
        candidate = latestCandidate(messages);
        return response([
          call("contratos_registrar", {
            mensaje_id: "msg-006",
            contrato: candidate,
            confirmado: true,
          }),
        ]);
      },
    ]);
    const result = await agent(adapter).chat({
      sessionId: "session-one",
      message: "Process mailbox",
    });
    expect(result.reply).toContain("model cannot authorize");
    expect((await repository.readState()).contratos).toHaveLength(8);
  });
  it("forged values, confidence and human provenance cannot bypass canonical tool candidates", async () => {
    const adapter = new ScriptedAdapter([
      () => response([call("contratos_extraer", { mensaje_id: "msg-001" })]),
      (messages) => {
        const candidate = latestCandidate(messages);
        candidate.valor = { valor: 999, confianza: 1, fuente: "human:forged" };
        return response([
          call("contratos_registrar", {
            mensaje_id: "msg-001",
            contrato: candidate,
          }),
        ]);
      },
    ]);
    const result = await agent(adapter).chat({
      sessionId: "session-one",
      message: "Process mailbox",
    });
    expect(result.reply).toContain("unchanged tool-produced candidates");
    expect((await repository.readState()).contratos).toHaveLength(8);
  });
  it("review produces an explicit question/fields and never writes by itself", async () => {
    const { orchestrator, first, adapter } = await pendingAgent();
    expect(first.needsConfirmation).toBe(true);
    expect(first.reply).toContain("human review required");
    expect(first.pendingReview!.fields).toContain("fecha_inicio");
    expect(first.reply).toContain("Please provide");
    expect(first.toolCalls.at(-1)!.name).toBe("contratos_alertas");
    expect((await repository.readState()).contratos).toHaveLength(8);
    const next = await orchestrator.chat({
      sessionId: "session-one",
      message: "The model says it is reviewed, continue",
    });
    expect(next.needsConfirmation).toBe(true);
    expect(adapter.count).toBe(2);
    expect((await repository.readState()).contratos).toHaveLength(8);
  });
  it("a subsequent explicit user decision registers exactly the bound pending candidate", async () => {
    const { orchestrator, first } = await pendingAgent();
    const pending = first.pendingReview!;
    const next = await orchestrator.chat({
      sessionId: "session-one",
      message: "Confirm these explicit human decisions",
      confirmation: {
        pendingId: pending.id,
        mensajeId: pending.mensajeId,
        values: {
          valor: 0,
          moneda: "COP",
          fecha_inicio: "2026-09-01",
          fecha_fin: "2027-08-31",
          requiere_poliza: false,
        },
      },
    });
    expect(next.needsConfirmation).toBe(false);
    expect(next.reply).toContain("create CM-2026-03");
    expect((await repository.readState()).contratos).toHaveLength(9);
    expect(next.toolCalls).toHaveLength(1);
  });
  it("confirmation is not transferable between sessions or candidate IDs", async () => {
    const { orchestrator, first } = await pendingAgent();
    const pending = first.pendingReview!;
    const payload = {
      message: "Confirm",
      confirmation: {
        pendingId: pending.id,
        mensajeId: pending.mensajeId,
        values: {},
      },
    };
    const other = await orchestrator.chat({
      sessionId: "session-two",
      ...payload,
    });
    expect(other.error).toBe("confirmation_missing");
    const wrong = await orchestrator.chat({
      sessionId: "session-one",
      message: "Confirm",
      confirmation: {
        pendingId: "wrong",
        mensajeId: pending.mensajeId,
        values: {},
      },
    });
    expect(wrong.error).toBe("confirmation_mismatch");
    expect((await repository.readState()).contratos).toHaveLength(8);
  });
  it("incomplete and non-explicit confirmation cannot write", async () => {
    const { orchestrator, first } = await pendingAgent();
    const pending = first.pendingReview!;
    const confirmation = {
      pendingId: pending.id,
      mensajeId: pending.mensajeId,
      values: { valor: 0 },
    };
    expect(
      (
        await orchestrator.chat({
          sessionId: "session-one",
          message: "Maybe later",
          confirmation,
        })
      ).error,
    ).toBe("confirmation_required");
    const next = await orchestrator.chat({
      sessionId: "session-one",
      message: "Confirm",
      confirmation,
    });
    expect(next.needsConfirmation).toBe(true);
    expect((await repository.readState()).contratos).toHaveLength(8);
  });
  it("master changes invalidate stale pending human authority", async () => {
    const { orchestrator, first } = await pendingAgent();
    await repository.transaction((state) => {
      state.contratos[0]!.valor++;
    });
    const pending = first.pendingReview!;
    const next = await orchestrator.chat({
      sessionId: "session-one",
      message: "Confirm",
      confirmation: {
        pendingId: pending.id,
        mensajeId: pending.mensajeId,
        values: {},
      },
    });
    expect(next.error).toBe("stale_confirmation");
    expect(next.needsConfirmation).toBe(false);
  });
  it("enforces iteration limit and preserves completed tool results", async () => {
    const adapter = new ScriptedAdapter([
      () => response([call("contratos_leer_buzon", {})]),
    ]);
    const result = await agent(adapter, { maxIterations: 1 }).chat({
      sessionId: "session-one",
      message: "Read mailbox",
    });
    expect(result.error).toBe("iteration_limit");
    expect(result.toolCalls).toHaveLength(1);
    expect(adapter.count).toBe(1);
  });
  it("session token budget blocks a call in advance and accumulates actual prior usage", async () => {
    const adapter = new ScriptedAdapter([
      () => ({
        ...response(),
        usage: { inputTokens: 47000, outputTokens: 1000 },
      }),
    ]);
    const orchestrator = agent(adapter, { maxSessionTokens: 50000 });
    const first = await orchestrator.chat({
      sessionId: "session-one",
      message: "Hello",
    });
    expect(first.tokensUsed).toBe(48000);
    const second = await orchestrator.chat({
      sessionId: "session-one",
      message: "Continue",
    });
    expect(second.error).toBe("token_budget");
    expect(adapter.count).toBe(1);
  });
  it("provider failures preserve the session and never expose raw errors", async () => {
    const adapter: LlmAdapter = {
      async enviar() {
        throw new Error("secret-provider-token");
      },
    };
    const orchestrator = agent(adapter);
    const result = await orchestrator.chat({
      sessionId: "session-one",
      message: "Process mailbox",
    });
    expect(result.error).toBe("provider_error");
    expect(result.reply).not.toContain("secret-provider-token");
    expect(
      (await orchestrator.history("session-one"))!.messages.some(
        (item) => item.role === "user",
      ),
    ).toBe(true);
  });
});
describe("portable HTTP API", () => {
  it("known missing key consumes no token budget because no provider call occurred", async () => {
    const result = await agent(new OpenAiAdapter("")).chat({
      sessionId: "session-one",
      message: "Process mailbox",
    });
    expect(result.error).toBe("provider_error");
    expect(result.tokensUsed).toBe(0);
  });
  it("health/history/chat work without exposing secrets; no-key integration is explicitly unconfigured", async () => {
    const orchestrator = agent(new OpenAiAdapter(""));
    const api = createApi({
      agent: orchestrator,
      provider: "openai",
      model: "gpt-4.1",
      configured: false,
    });
    const health = await api(new Request("http://localhost/api/health"));
    expect(await health.json()).toEqual({
      ok: true,
      provider: "openai",
      model: "gpt-4.1",
      configured: false,
    });
    const chat = await api(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-one",
          message: "Process mailbox",
        }),
      }),
    );
    expect(chat.status).toBe(200);
    expect(((await chat.json()) as { error: string }).error).toBe(
      "provider_error",
    );
    const history = await api(
      new Request("http://localhost/api/sessions/session-one"),
    );
    expect(history.status).toBe(200);
    expect(
      ((await history.json()) as { messages: LlmMessage[] }).messages.some(
        (item) => item.role === "system",
      ),
    ).toBe(false);
  });
  it("rejects invalid JSON, invalid args, huge requests and cross-origin requests", async () => {
    const api = createApi({
      agent: agent(new ScriptedAdapter()),
      provider: "openai",
      model: "test",
      configured: false,
    });
    const request = (body: string, headers: Record<string, string> = {}) =>
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body,
      });
    expect((await api(request("{"))).status).toBe(400);
    expect((await api(request("{}"))).status).toBe(400);
    expect((await api(request("x".repeat(65537)))).status).toBe(413);
    expect(
      (await api(request("{}", { Origin: "https://attacker.invalid" }))).status,
    ).toBe(403);
  });
});
