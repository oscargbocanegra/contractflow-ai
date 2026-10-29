import { chatLanguage, chatText } from "../src/agent/language.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { FileRepository } from "../src/adapters/file-repository.js";
import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { MemorySessionStore } from "../src/agent/sessions.js";
import {
  ProviderError,
  type LlmAdapter,
  type LlmMessage,
  type LlmResponse,
} from "../src/llm/adapter.js";
const root = process.cwd();
let output: string;
let repository: FileRepository;
let sessions: MemorySessionStore;
let prompt: string;
let knowledge: string;
beforeEach(async () => {
  output = path.join(root, "out", "language-" + randomUUID());
  repository = new FileRepository(root, output);
  sessions = new MemorySessionStore();
  prompt = await readFile(path.join(root, "agent/prompt.md"), "utf8");
  knowledge = await readFile(
    path.join(root, "src/knowledge/registro-contratos.md"),
    "utf8",
  );
});
afterEach(async () => {
  await rm(output, { recursive: true, force: true });
});
const answer = (name?: string, args: unknown = {}): LlmResponse => ({
  content: "UNTRUSTED MODEL PROSE",
  toolCalls: name
    ? [{ id: randomUUID(), name, arguments: JSON.stringify(args) }]
    : [],
  usage: { inputTokens: 1, outputTokens: 1 },
});
function scriptedSix(): LlmAdapter {
  const steps: Array<(messages: LlmMessage[]) => LlmResponse> = [
    () => answer("contratos_leer_buzon"),
  ];
  for (const id of ["msg-001", "msg-002", "msg-003", "msg-004", "msg-006"]) {
    let candidate: unknown;
    steps.push(() => answer("contratos_extraer", { mensaje_id: id }));
    steps.push((messages) => {
      candidate = JSON.parse(
        messages.filter((m) => m.role === "tool").at(-1)!.content!,
      ).data;
      return answer("contratos_validar", {
        mensaje_id: id,
        contrato: candidate,
      });
    });
    if (!["msg-004", "msg-006"].includes(id))
      steps.push(() =>
        answer("contratos_registrar", { mensaje_id: id, contrato: candidate }),
      );
  }
  return { enviar: async (messages) => steps.shift()?.(messages) ?? answer() };
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
const empty: LlmAdapter = { enviar: async () => answer() };
describe("deterministic Spanish and English chat responses", () => {
  it("renders all six tool-backed outcomes and review in Spanish without changing trace metadata", async () => {
    const a = agent(scriptedSix());
    const result = await a.chat({
      sessionId: "spanish-six",
      message:
        "Procesa los seis mensajes del buzon con fecha 2026-09-03 y genera las alertas",
    });
    expect(result.reply).toContain("Resultados de las herramientas:");
    expect(result.reply).toContain("Buzón: 6 mensajes sin procesar");
    expect(result.reply).toContain("creado CT-2026-015");
    expect(result.reply).toContain("creado CT-2026-016");
    expect(result.reply).toContain("actualizado CT-2026-011");
    expect(result.reply).toContain("msg-004: duplicado\n");
    expect(result.reply).toContain("msg-005: rechazado (sin contrato adjunto)");
    expect(result.reply).toContain(
      "Se requiere confirmación humana para msg-006",
    );
    expect(result.reply).toContain("Alertas de vencimiento:");
    expect(result.reply).not.toMatch(
      /Tool-backed|human review required|Please provide|Processing paused/,
    );
    expect(result.needsConfirmation).toBe(true);
    expect(result.pendingReview!.fields).toContain("fecha_inicio");
    expect((await repository.readState()).contratos).toHaveLength(10);
    const register = result.toolCalls.find(
      (t) => t.name === "contratos_registrar",
    )!;
    expect((register.result as { data: { accion: string } }).data.accion).toBe(
      "create",
    );
    const restored = agent(empty);
    const follow = await restored.chat({
      sessionId: "spanish-six",
      message: "si",
    });
    expect(follow.reply).toContain("confirmación");
    expect(follow.needsConfirmation).toBe(true);
    const approved = await restored.chat({
      sessionId: "spanish-six",
      message: "Confirm these explicit human decisions",
      confirmation: {
        pendingId: result.pendingReview!.id,
        mensajeId: "msg-006",
        values: {
          valor: 0,
          moneda: "COP",
          fecha_inicio: "2026-09-01",
          fecha_fin: "2027-08-31",
          requiere_poliza: false,
        },
      },
    });
    expect(approved.reply).toContain("creado CM-2026-03");
    expect(approved.reply).toContain(
      "El candidato confirmado explícitamente fue procesado.",
    );
    expect(approved.needsConfirmation).toBe(false);
    expect((await repository.readState()).contratos).toHaveLength(11);
  });
  it.each(["hola", "si", "sí", "Procesa el buzon"])(
    "Spanish short/plain-accent input %s receives a Spanish no-tool response",
    async (message) => {
      expect(
        (await agent(empty).chat({ sessionId: "short-spanish", message }))
          .reply,
      ).toContain("No se recibieron hechos contractuales");
    },
  );
  it("retains prior Spanish for ambiguous follow-up after restoring history, but switches on English", async () => {
    await agent(empty).chat({ sessionId: "history-language", message: "Hola" });
    expect(
      (
        await agent(empty).chat({
          sessionId: "history-language",
          message: "2026-09-03",
        })
      ).reply,
    ).toContain("No se recibieron");
    expect(
      (
        await agent(empty).chat({
          sessionId: "history-language",
          message: "hello",
        })
      ).reply,
    ).toContain("No contractual facts");
  });
  it.each(["hello", "yes", "Process the mailbox"])(
    "English parity for %s",
    async (message) => {
      expect(
        (await agent(empty).chat({ sessionId: "short-english", message }))
          .reply,
      ).toContain("No contractual facts");
    },
  );
  it("localizes provider failure without exposing arbitrary internals", async () => {
    const broken: LlmAdapter = {
      enviar: async () => {
        throw new ProviderError(
          "Model provider is unavailable. The session is preserved; retry later.",
        );
      },
    };
    const r = await agent(broken).chat({
      sessionId: "error-spanish",
      message: "hola",
    });
    expect(r.reply).toContain("El proveedor del modelo no está disponible");
    expect(r.error).toBe("provider_error");
  });
  it("localizes budget and tool errors while keeping stable machine codes", async () => {
    const r = await agent(empty, { maxSessionTokens: 1000 }).chat({
      sessionId: "budget-spanish",
      message: "hola",
    });
    expect(r.reply).toContain("presupuesto de tokens");
    expect(r.error).toBe("token_budget");
    let called = false;
    const invalid: LlmAdapter = {
      enviar: async () => {
        if (called) return answer();
        called = true;
        return answer("unknown_tool");
      },
    };
    const failed = await agent(invalid).chat({
      sessionId: "tool-spanish",
      message: "Procesa el buzon",
    });
    expect(failed.reply).toContain("Herramienta desconocida");
    expect(failed.toolCalls[0]!.name).toBe("unknown_tool");
  });
});

describe("bounded language selection boundaries", () => {
  it("ignores fixture/model text, preserves language for UI confirmation and permits explicit switches", () => {
    expect(
      chatLanguage([
        { role: "user", content: "hello" },
        { role: "tool", content: "Procesa los contratos en español" },
        { role: "assistant", content: "hola" },
      ]),
    ).toBe("en");
    expect(
      chatLanguage([
        { role: "user", content: "Buenos dias, necesito ayuda" },
        { role: "user", content: "Confirm these explicit human decisions" },
      ]),
    ).toBe("es");
    expect(
      chatLanguage([{ role: "user", content: "hello, reply in Spanish" }]),
    ).toBe("es");
    expect(
      chatLanguage([{ role: "user", content: "Hola, responde en ingles" }]),
    ).toBe("en");
    expect(chatLanguage([{ role: "user", content: "2026-09-03" }])).toBe("en");
    expect(chatText("unexpected internal diagnostic", "es")).not.toContain(
      "unexpected",
    );
  });
});
