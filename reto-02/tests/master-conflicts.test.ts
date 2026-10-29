import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { MemorySessionStore } from "../src/agent/sessions.js";
import type { LlmAdapter } from "../src/llm/adapter.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { FileRepository } from "../src/adapters/file-repository.js";
import type {
  Contract,
  MasterRow,
  MessageDocument,
  ToolResult,
  Validation,
} from "../src/domain/contracts.js";
import type { ToolContext } from "../src/ports/repository.js";
import * as tools from "../src/tools/contratos.js";
import { readResult } from "../src/services/demo-scenario.js";
let output: string;
let repo: FileRepository;
let ctx: ToolContext;
beforeEach(() => {
  output = path.join(process.cwd(), "out", "conflict-" + randomUUID());
  repo = new FileRepository(process.cwd(), output);
  ctx = {
    directory: process.cwd(),
    sessionId: "master-conflict-test",
    repository: repo,
    hoy: "2026-09-03",
  };
});
afterEach(async () => {
  await rm(output, { recursive: true, force: true });
});
function variant(transform: (docs: MessageDocument[]) => void) {
  class Variant extends FileRepository {
    override async messages() {
      const docs = await super.messages();
      transform(docs);
      return docs;
    }
  }
  repo = new Variant(process.cwd(), output);
  ctx.repository = repo;
}
async function extract(id = "msg-001") {
  return readResult<Contract>(
    await tools.extraer.execute({ mensaje_id: id }, ctx),
  );
}
async function assess(candidate: Contract, id = "msg-001") {
  return readResult<Validation>(
    await tools.validar.execute({ mensaje_id: id, contrato: candidate }, ctx),
  );
}
async function register(candidate: Contract, id = "msg-001") {
  return JSON.parse(
    await tools.registrar.execute(
      { mensaje_id: id, contrato: candidate, confirmado: false },
      ctx,
    ),
  ) as ToolResult<unknown>;
}
async function seed(candidate: Contract, edit: (row: MasterRow) => void) {
  await repo.transaction((state) => {
    const row: MasterRow = {
      ...state.contratos[0]!,
      id_contrato: candidate.id_contrato.valor!,
      cliente: candidate.cliente.valor!,
      nit_cliente: candidate.nit_cliente.valor!,
      pais: candidate.pais.valor!,
      objeto: candidate.objeto.valor!,
      valor: candidate.valor.valor!,
      moneda: candidate.moneda.valor!,
      fecha_inicio: candidate.fecha_inicio.valor!,
      fecha_fin: candidate.fecha_fin.valor!,
      requiere_poliza: candidate.requiere_poliza.valor!,
      tipo_poliza: candidate.tipo_poliza.valor!,
      estado_poliza: candidate.estado_poliza.valor!,
    };
    edit(row);
    state.contratos.push(row);
  });
}
describe("HU3 contradictory master data requires independent human review", () => {
  it("actual agent surfaces canonical extracted master conflict and review alone still authorizes nothing", async () => {
    variant((docs) => {
      docs[0]!.archivos["contrato.txt"] = docs[0]!.archivos[
        "contrato.txt"
      ]!.replace("CT-2026-015", "CT-2026-012");
    });
    let calls = 0;
    const controlled: LlmAdapter = {
      async enviar(messages) {
        calls++;
        if (calls === 1)
          return {
            content: null,
            toolCalls: [
              {
                id: "extract-conflict",
                name: "contratos_extraer",
                arguments: JSON.stringify({ mensaje_id: "msg-001" }),
              },
            ],
            usage: { inputTokens: 0, outputTokens: 0 },
          };
        const candidate = JSON.parse(
          messages.filter((row) => row.role === "tool").at(-1)!.content!,
        ) as { data: Contract };
        return {
          content: null,
          toolCalls: [
            {
              id: "validate-conflict",
              name: "contratos_validar",
              arguments: JSON.stringify({
                mensaje_id: "msg-001",
                contrato: candidate.data,
              }),
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      },
    };
    const agent = new AgentOrchestrator({
      directory: process.cwd(),
      prompt: "Controlled test, not a live provider",
      knowledge: "Original source variants only",
      repository: repo,
      adapter: controlled,
      sessions: new MemorySessionStore(),
    });
    const before = await repo.readState();
    const result = await agent.chat({
      sessionId: "actual-conflict-session",
      message: "Process reference 2026-09-03",
    });
    expect(result.needsConfirmation).toBe(true);
    expect(result.pendingReview!.fields).toEqual(
      expect.arrayContaining(["cliente", "nit_cliente"]),
    );
    await agent.chat({
      sessionId: "actual-conflict-session",
      message: "I have reviewed it",
    });
    expect(calls).toBe(2);
    expect(await repo.readState()).toEqual(before);
  });
  it("explicit country evidence on an othersi cannot be hidden by inherited master country", async () => {
    await repo.transaction((state) => {
      state.contratos.find((row) => row.id_contrato === "CT-2026-011")!.pais =
        "CO";
    });
    const candidate = await extract("msg-003");
    expect(candidate.pais.valor).toBe("PE");
    const before = await repo.readState();
    expect((await assess(candidate, "msg-003")).requiere_revision).toContain(
      "pais",
    );
    expect((await register(candidate, "msg-003")).ok).toBe(false);
    expect(await repo.readState()).toEqual(before);
  });
  it("reproduces incoming Delta with existing Clinic ID and blocks every contractual mutation", async () => {
    variant((docs) => {
      docs[0]!.archivos["contrato.txt"] = docs[0]!.archivos[
        "contrato.txt"
      ]!.replace("CT-2026-015", "CT-2026-012");
    });
    const candidate = await extract();
    const before = await repo.readState();
    const validation = await assess(candidate);
    expect(await repo.readState()).toEqual(before);
    const result = await register(candidate);
    expect(validation.clasificacion).toBe("actualizacion");
    expect(validation.requiere_revision).toEqual(
      expect.arrayContaining(["cliente", "nit_cliente"]),
    );
    expect(result.ok).toBe(false);
    expect(await repo.readState()).toEqual(before);
  });
  it.each([
    ["nit_cliente", "111222333"],
    ["cliente", "Unrelated Customer S.A."],
    ["pais", "PE"],
    ["fecha_inicio", "2026-07-01"],
    ["fecha_fin", "2027-06-30"],
    ["moneda", "USD"],
    ["requiere_poliza", false],
    ["tipo_poliza", "responsabilidad_civil"],
    ["estado_poliza", "vigente"],
    ["valor", 260000000],
  ] as const)(
    "unannounced master difference %s is not silently overwritten",
    async (key, value) => {
      const candidate = await extract();
      await seed(candidate, (row) => {
        row.valor = 260000000;
        Object.assign(row, { [key]: value });
      });
      const before = await repo.readState();
      const validation = await assess(candidate);
      const result = await register(candidate);
      expect(validation.requiere_revision).toContain(key);
      expect(result.ok).toBe(false);
      expect(await repo.readState()).toEqual(before);
    },
  );
  it("NIT/object match with a different ID requires review rather than silently choosing the master ID", async () => {
    const candidate = await extract();
    await seed(candidate, (row) => {
      row.id_contrato = "MATCHED-OTHER-ID";
    });
    const before = await repo.readState();
    const validation = await assess(candidate);
    expect(validation.id_contrato_existente).toBe("MATCHED-OTHER-ID");
    expect(validation.requiere_revision).toContain("id_contrato");
    expect((await register(candidate)).ok).toBe(false);
    expect(await repo.readState()).toEqual(before);
  });
  it("explicit othersi never excuses a different customer/tax identity", async () => {
    variant((docs) => {
      docs[2]!.archivos["otrosi.txt"] = docs[2]!.archivos[
        "otrosi.txt"
      ]!.replace("20512345678", "20599999999").replace(
        "MINERA LOS ANDES S.A.C.",
        "OTRO CLIENTE S.A.C.",
      );
    });
    const candidate = await extract("msg-003");
    const before = await repo.readState();
    const validation = await assess(candidate, "msg-003");
    expect(validation.requiere_revision).toEqual(
      expect.arrayContaining(["cliente", "nit_cliente"]),
    );
    expect((await register(candidate, "msg-003")).ok).toBe(false);
    expect(await repo.readState()).toEqual(before);
  });
  it("announced othersi value/end changes and cosmetic client normalization remain legitimate", async () => {
    await repo.transaction((state) => {
      state.contratos.find(
        (row) => row.id_contrato === "CT-2026-011",
      )!.cliente = "minera los ándes sac";
    });
    const candidate = await extract("msg-003");
    const before = await repo.readState();
    const validation = await assess(candidate, "msg-003");
    expect(validation.clasificacion).toBe("actualizacion");
    expect(validation.requiere_revision).toEqual([]);
    expect(await repo.readState()).toEqual(before);
    expect((await register(candidate, "msg-003")).ok).toBe(true);
    expect((await repo.readState()).historial).toHaveLength(1);
  });
  it("preserves exact RN1 duplicate precedence and no write for original msg-004", async () => {
    const candidate = await extract("msg-004");
    const before = await repo.readState();
    expect((await assess(candidate, "msg-004")).clasificacion).toBe(
      "duplicado",
    );
    expect((await register(candidate, "msg-004")).ok).toBe(true);
    expect(await repo.readState()).toEqual(before);
  });
});
