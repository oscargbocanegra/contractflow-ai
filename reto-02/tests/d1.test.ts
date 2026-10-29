import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
import { D1Repository } from "../src/adapters/d1-repository.js";
import { D1SessionStore } from "../src/adapters/d1-sessions.js";
import { D1BudgetAdapter } from "../src/adapters/d1-budget.js";
import type { D1Db } from "../src/adapters/d1-types.js";
import { fixtureBundle } from "../src/generated/fixture-bundle.js";
import { runScenario } from "../src/services/demo-scenario.js";
import { OpenAiAdapter } from "../src/llm/openai.js";
import type { LlmAdapter, LlmResponse } from "../src/llm/adapter.js";
import type { Session } from "../src/agent/sessions.js";
let mf: Miniflare;
let db: D1Db;
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        'export default {fetch(){return new Response("D1 test runtime")}}',
      compatibilityDate: "2026-10-28",
      d1Databases: ["DB"],
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as D1Db;
  const migration = await readFile("migrations/0001_contractflow.sql", "utf8");
  await db.batch(
    migration
      .split(";")
      .map((sql) => sql.trim())
      .filter(Boolean)
      .map((sql) => db.prepare(sql)),
  );
}, 30000);
afterAll(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await db.batch(
    [
      "contract_state",
      "audit_log",
      "reports",
      "sessions",
      "session_leases",
      "quota_reservations",
    ].map((name) => db.prepare(`DELETE FROM ${name}`)),
  );
  await db
    .prepare("UPDATE quota_budget SET used=0,session_usage='{}' WHERE id=1")
    .run();
});
const session = (id: string): Session => ({
  id,
  messages: [],
  toolCalls: [],
  candidates: {},
  tokensUsed: 0,
  turn: 1,
  busy: false,
  updatedAt: new Date().toISOString(),
});
const answer: LlmResponse = {
  content: null,
  toolCalls: [],
  usage: { inputTokens: 900, outputTokens: 100 },
};
describe("actual local D1 SQLite through Miniflare, not a SQL mock", () => {
  it("pending human review survives a fresh orchestrator and authorizes only the later bound user turn", async () => {
    const store = new D1SessionStore(db);
    const firstLease = { sessionId: "session-human", owner: "first-isolate" };
    await store.acquire(firstLease.sessionId, firstLease.owner);
    let calls = 0;
    const controlled: LlmAdapter = {
      async enviar(messages) {
        calls++;
        if (calls === 1)
          return {
            content: null,
            toolCalls: [
              {
                id: "extract-one",
                name: "contratos_extraer",
                arguments: JSON.stringify({ mensaje_id: "msg-006" }),
              },
            ],
            usage: { inputTokens: 0, outputTokens: 0 },
          };
        const extracted = JSON.parse(
          messages.filter((row) => row.role === "tool").at(-1)!.content!,
        ) as { data: unknown };
        return {
          content: null,
          toolCalls: [
            {
              id: "validate-one",
              name: "contratos_validar",
              arguments: JSON.stringify({
                mensaje_id: "msg-006",
                contrato: extracted.data,
              }),
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      },
    };
    const common = {
      directory: ".",
      prompt: await readFile("agent/prompt.md", "utf8"),
      knowledge: await readFile("src/knowledge/registro-contratos.md", "utf8"),
    };
    const first = new AgentOrchestrator({
      ...common,
      repository: new D1Repository(db, fixtureBundle, firstLease),
      sessions: new D1SessionStore(db, firstLease),
      adapter: new D1BudgetAdapter(db, controlled, firstLease),
    });
    const review = await first.chat({
      sessionId: firstLease.sessionId,
      message: "Process with reference date 2026-09-03",
    });
    expect(review.needsConfirmation).toBe(true);
    expect(
      (await new D1Repository(db, fixtureBundle).readState()).contratos,
    ).toHaveLength(8);
    await store.release(firstLease);
    const nextLease = { sessionId: firstLease.sessionId, owner: "new-isolate" };
    await store.acquire(nextLease.sessionId, nextLease.owner);
    const second = new AgentOrchestrator({
      ...common,
      repository: new D1Repository(db, fixtureBundle, nextLease),
      sessions: new D1SessionStore(db, nextLease),
      adapter: {
        async enviar() {
          throw new Error("Confirmation must not call a model");
        },
      },
    });
    const pending = review.pendingReview!;
    const result = await second.chat({
      sessionId: nextLease.sessionId,
      message: "Confirm",
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
    expect(result.needsConfirmation).toBe(false);
    expect(result.reply).toContain("create CM-2026-03");
    expect(
      (await new D1Repository(db, fixtureBundle).readState()).contratos,
    ).toHaveLength(9);
    expect(calls).toBe(2);
    await store.release(nextLease);
  });
  it("runs all six original fixtures on actual D1 and exports logical files", async () => {
    const repo = new D1Repository(db, fixtureBundle);
    const outcome = await runScenario({
      directory: ".",
      sessionId: "d1-demo",
      repository: repo,
      hoy: "2026-09-03",
    });
    expect(outcome.outcomes.map((row) => row.accion)).toEqual([
      "create",
      "create",
      "update",
      "duplicate",
      "reject",
      "human_review",
    ]);
    const state = await repo.readState();
    expect(state.contratos).toHaveLength(11);
    expect(state.historial).toHaveLength(4);
    expect(Object.keys(state.procesados)).toHaveLength(4);
    expect((await repo.exported("maestro-contratos.csv"))!.content).toContain(
      "CM-2026-03",
    );
    expect(
      (await repo.exported("historial.jsonl"))!.content.split("\n"),
    ).toHaveLength(4);
    expect((await repo.exported("log.jsonl"))!.content).toContain(
      "contratos_registrar",
    );
    expect((await repo.exported("alertas.md"))!.content).toContain(
      "CT-2026-009",
    );
    expect(await repo.exported("../secret")).toBeNull();
  });
  it("seeds only once and retains master after constructing a new adapter", async () => {
    const repo = new D1Repository(db, fixtureBundle);
    await repo.transaction((state) => {
      state.contratos[0]!.valor = 123;
    });
    expect(
      (await new D1Repository(db, fixtureBundle).readState()).contratos[0]!
        .valor,
    ).toBe(123);
    expect(
      (await db
        .prepare("SELECT COUNT(*) AS count FROM contract_state")
        .first<{ count: number }>())!.count,
    ).toBe(1);
  });
  it("CAS rejects a stale mutation without overwriting a concurrent commit", async () => {
    const repo = new D1Repository(db, fixtureBundle);
    let signal: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      signal = resolve;
    });
    let release: () => void = () => undefined;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stale = repo.transaction(async (state) => {
      state.contratos[0]!.valor = 111;
      signal();
      await wait;
    });
    await entered;
    await new D1Repository(db, fixtureBundle).transaction((state) => {
      state.contratos[0]!.valor = 222;
    });
    release();
    await expect(stale).rejects.toThrow("conflict");
    expect((await repo.readState()).contratos[0]!.valor).toBe(222);
  });
  it("cross-isolate leases exclude concurrent requests, support expiry, and fence stale owners", async () => {
    const store = new D1SessionStore(db);
    const a = { sessionId: "session-one", owner: "owner-a" };
    const b = { sessionId: "session-one", owner: "owner-b" };
    expect(await store.acquire(a.sessionId, a.owner)).toBe(true);
    expect(await new D1SessionStore(db).acquire(b.sessionId, b.owner)).toBe(
      false,
    );
    expect(await store.renew(a)).toBe(true);
    await db
      .prepare("UPDATE session_leases SET expires_at=? WHERE session_id=?")
      .bind(Date.now() - 1, a.sessionId)
      .run();
    expect(await store.acquire(b.sessionId, b.owner)).toBe(true);
    await store.release(a);
    await expect(
      new D1Repository(db, fixtureBundle, a).report("unauthorized"),
    ).rejects.toThrow("expired session authority");
    await expect(
      new D1SessionStore(db, b).set(session("other-session")),
    ).rejects.toThrow("identity mismatch");
    expect(await store.processing(a.sessionId)).toBe(true);
    await expect(
      new D1Repository(db, fixtureBundle, a).transaction((state) => {
        state.contratos[0]!.valor++;
      }),
    ).rejects.toThrow("expired session authority");
    await expect(
      new D1SessionStore(db, a).set(session(a.sessionId)),
    ).rejects.toThrow("authority");
    await new D1SessionStore(db, b).set(session(b.sessionId));
    expect((await new D1SessionStore(db).get(b.sessionId))!.turn).toBe(1);
    await store.release(b);
    expect(await store.processing(b.sessionId)).toBe(false);
  });
  it("D1 session count capacity is enforced atomically in storage", async () => {
    const store = new D1SessionStore(db, undefined, 1);
    await store.set(session("session-one"));
    await expect(store.set(session("session-two"))).rejects.toThrow("capacity");
    expect(await store.count()).toBe(1);
  });
  it("durable quota persists actual usage across adapters and blocks another session at global cap", async () => {
    const store = new D1SessionStore(db);
    const a = { sessionId: "session-one", owner: "a" };
    const b = { sessionId: "session-two", owner: "b" };
    await store.acquire(a.sessionId, a.owner);
    await store.acquire(b.sessionId, b.owner);
    let calls = 0;
    const inner: LlmAdapter = {
      async enviar() {
        calls++;
        return answer;
      },
    };
    await new D1BudgetAdapter(db, inner, a, 5000, 1500).enviar([], [], 50);
    const row = await db
      .prepare("SELECT used,session_usage FROM quota_budget WHERE id=1")
      .first<{ used: number; session_usage: string }>();
    expect(row!.used).toBe(1000);
    expect(JSON.parse(row!.session_usage)["session-one"]).toBe(1000);
    await expect(
      new D1BudgetAdapter(db, inner, b, 5000, 1500).enviar([], [], 50),
    ).rejects.toThrow("budget");
    expect(calls).toBe(1);
  });
  it("known missing key refunds the durable reservation to zero without network usage", async () => {
    const store = new D1SessionStore(db);
    const lease = { sessionId: "session-one", owner: "a" };
    await store.acquire(lease.sessionId, lease.owner);
    await expect(
      new D1BudgetAdapter(db, new OpenAiAdapter(""), lease).enviar([], [], 50),
    ).rejects.toThrow("not configured");
    expect(
      (await db
        .prepare("SELECT used FROM quota_budget WHERE id=1")
        .first<{ used: number }>())!.used,
    ).toBe(0);
    expect(
      (await db
        .prepare("SELECT actual,settled FROM quota_reservations")
        .first<{ actual: number; settled: number }>())!,
    ).toEqual({ actual: 0, settled: 1 });
  });
  it("unknown provider outcome retains reserved usage and never retries the provider", async () => {
    const lease = { sessionId: "session-one", owner: "a" };
    await new D1SessionStore(db).acquire(lease.sessionId, lease.owner);
    let calls = 0;
    const inner: LlmAdapter = {
      async enviar() {
        calls++;
        throw new Error("uncertain network failure");
      },
    };
    await expect(
      new D1BudgetAdapter(db, inner, lease, 5000, 1500).enviar([], [], 50),
    ).rejects.toThrow("uncertain usage");
    expect(
      (await db
        .prepare("SELECT used FROM quota_budget WHERE id=1")
        .first<{ used: number }>())!.used,
    ).toBeGreaterThan(1000);
    await expect(
      new D1BudgetAdapter(db, inner, lease, 5000, 1500).enviar([], [], 50),
    ).rejects.toThrow("budget");
    expect(calls).toBe(1);
  });
  it("two concurrent durable reservations cannot both consume the same remaining global budget", async () => {
    const store = new D1SessionStore(db);
    const a = { sessionId: "session-one", owner: "a" };
    const b = { sessionId: "session-two", owner: "b" };
    await store.acquire(a.sessionId, a.owner);
    await store.acquire(b.sessionId, b.owner);
    let calls = 0;
    let release: (value: LlmResponse) => void = () => undefined;
    const waiting = new Promise<LlmResponse>((resolve) => {
      release = resolve;
    });
    const inner: LlmAdapter = {
      async enviar() {
        calls++;
        return waiting;
      },
    };
    const first = new D1BudgetAdapter(db, inner, a, 5000, 1500).enviar(
      [],
      [],
      50,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(
      new D1BudgetAdapter(db, inner, b, 5000, 1500).enviar([], [], 50),
    ).rejects.toThrow("budget");
    release({ ...answer, usage: { inputTokens: 0, outputTokens: 0 } });
    await first;
    expect(calls).toBe(1);
    expect(
      (await db
        .prepare("SELECT used FROM quota_budget WHERE id=1")
        .first<{ used: number }>())!.used,
    ).toBe(0);
  });
});
