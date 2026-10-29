import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import {
  FileRepository,
  parseCsv,
  serializeCsv,
} from "../src/adapters/file-repository.js";
import {
  emptyContract,
  field,
  fieldKeys,
  similarity,
  type Contract,
  type MessageDocument,
  type Registration,
  type ToolResult,
  type Validation,
} from "../src/domain/contracts.js";
import type { ToolContext } from "../src/ports/repository.js";
import * as tools from "../src/tools/contratos.js";
import {
  humanDemoCandidate,
  readResult,
  runScenario,
} from "../src/services/demo-scenario.js";
const root = process.cwd();
let output: string;
let repository: FileRepository;
let ctx: ToolContext;
const cleanup: string[] = [];
beforeEach(() => {
  output = path.join(root, "out", "test-" + randomUUID());
  cleanup.push(output);
  repository = new FileRepository(root, output);
  ctx = {
    directory: root,
    sessionId: "test-session",
    repository,
    hoy: "2026-09-03",
  };
});
afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const candidate = async (id: string) =>
  readResult<Contract>(await tools.extraer.execute({ mensaje_id: id }, ctx));
const check = async (id: string, contract: Contract) =>
  readResult<Validation>(
    await tools.validar.execute({ mensaje_id: id, contrato: contract }, ctx),
  );
const register = async (id: string, contract: Contract, confirmed = false) =>
  JSON.parse(
    await tools.registrar.execute(
      { mensaje_id: id, contrato: contract, confirmado: confirmed },
      ctx,
    ),
  ) as ToolResult<Registration>;
async function protectedSnapshot() {
  const state = await repository.readState();
  return JSON.stringify({
    contratos: state.contratos,
    historial: state.historial,
    archivos: state.archivos,
    procesados: state.procesados,
  });
}
describe("six original fixtures and RN1-RN7", () => {
  it("HU1 lists exactly six source messages with quotation identified", async () => {
    const data = readResult<{
      mensajes: Array<{
        id: string;
        tiene_contrato: boolean;
        de: string;
        asunto: string;
        fecha: string;
        adjuntos: string[];
      }>;
    }>(await tools.leer_buzon.execute({}, ctx));
    expect(data.mensajes.map((x) => x.id)).toEqual([
      "msg-001",
      "msg-002",
      "msg-003",
      "msg-004",
      "msg-005",
      "msg-006",
    ]);
    expect(data.mensajes.find((x) => x.id === "msg-005")!.tiene_contrato).toBe(
      false,
    );
    expect(
      data.mensajes.every(
        (x) => x.de && x.asunto && x.fecha && x.adjuntos.length,
      ),
    ).toBe(true);
  });
  it("msg-001 RN3 creates contract with pending policy and actual .txt archive", async () => {
    const item = await candidate("msg-001");
    expect(item.id_contrato.valor).toBe("CT-2026-015");
    expect(item.valor.valor).toBe(265000000);
    expect(item.nit_cliente.valor).toBe("890900111");
    expect(item.fecha_inicio.valor).toBe("2026-08-01");
    expect(item.fecha_fin.valor).toBe("2027-07-31");
    expect((await check("msg-001", item)).requiere_revision).toEqual([]);
    const result = await register("msg-001", item);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accion).toBe("create");
    expect(result.data.ruta_archivo).toMatch(
      /Contratos\/2026\/.*CT-2026-015\.txt$/,
    );
    const state = await repository.readState();
    expect(state.contratos).toHaveLength(9);
    expect(state.contratos.at(-1)!.estado_poliza).toBe("pendiente");
    expect(
      await readFile(
        path.join(output, "sharepoint", result.data.ruta_archivo),
        "utf8",
      ),
    ).toBe((await repository.messages())[0]!.archivos["contrato.txt"]);
    expect(state.historial).toHaveLength(1);
    expect(state.procesados["msg-001"]).toBeDefined();
  });
  it("msg-002 RN3 preserves Ecuador RUC and creates without policy", async () => {
    const item = await candidate("msg-002");
    expect(item.nit_cliente.valor).toBe("1790012345001");
    expect(item.pais.valor).toBe("EC");
    expect(item.valor.valor).toBe(120000);
    expect(item.moneda.valor).toBe("USD");
    expect(item.fecha_inicio.valor).toBe("2026-08-15");
    expect(item.fecha_fin.valor).toBe("2027-08-14");
    expect((await register("msg-002", item)).ok).toBe(true);
    const row = (await repository.readState()).contratos.at(-1)!;
    expect(row.estado_poliza).toBe("no_aplica");
    expect(row.comercial).toBe("Carlos Ruiz Medina");
  });
  it("msg-003 RN2 updates value/end once and preserves inherited field provenance", async () => {
    const item = await candidate("msg-003");
    expect(item.objeto.fuente).toContain(
      "maestro-contratos.csv#CT-2026-011.objeto",
    );
    expect(item.fecha_inicio.valor).toBe("2026-05-02");
    expect(item.valor.valor).toBe(520000);
    expect(item.fecha_fin.valor).toBe("2027-11-01");
    const validation = await check("msg-003", item);
    expect(validation.clasificacion).toBe("actualizacion");
    expect(validation.diferencias.valor).toEqual({
      antes: 350000,
      despues: 520000,
    });
    expect(validation.advertencias.join(" ")).toContain(
      "not proof of extended coverage",
    );
    const result = await register("msg-003", item);
    expect(result.ok && result.data.accion).toBe("update");
    const state = await repository.readState();
    expect(state.contratos).toHaveLength(8);
    expect(
      state.contratos.find((x) => x.id_contrato === "CT-2026-011")!.fecha_fin,
    ).toBe("2027-11-01");
    expect(state.historial[0]!.cambios.valor).toEqual({
      antes: 350000,
      despues: 520000,
    });
  });
  it("msg-004 RN1 duplicate performs no master/history/archive/processed writes", async () => {
    const item = await candidate("msg-004");
    const before = await protectedSnapshot();
    expect((await check("msg-004", item)).clasificacion).toBe("duplicado");
    expect((await register("msg-004", item)).ok).toBe(true);
    expect(await protectedSnapshot()).toBe(before);
  });
  it("msg-005 RN4 rejects quotation without any contract write", async () => {
    const before = await protectedSnapshot();
    expect((await check("msg-005", emptyContract())).clasificacion).toBe(
      "rechazado",
    );
    const result = await register("msg-005", emptyContract());
    expect(result.ok && result.data.accion).toBe("reject");
    expect(await protectedSnapshot()).toBe(before);
  });
  it("msg-006 RN5 keeps missing dates null and demands explicit sufficient human input", async () => {
    const item = await candidate("msg-006");
    expect(item.valor_indeterminado).toBe(true);
    expect(item.valor.valor).toBe(0);
    expect(item.valor.valor).not.toBe(100000000);
    expect(item.fecha_inicio).toMatchObject({ valor: null, confianza: 0 });
    expect(item.fecha_fin).toMatchObject({ valor: null, confianza: 0 });
    expect(item.requiere_poliza.valor).toBeNull();
    const validation = await check("msg-006", item);
    expect(validation.clasificacion).toBe("nuevo");
    expect(validation.requiere_revision).toEqual(
      expect.arrayContaining([
        "valor",
        "fecha_inicio",
        "fecha_fin",
        "requiere_poliza",
      ]),
    );
    expect(validation.requiere_revision).not.toContain("comercial");
    expect(validation.advertencias.join(" ")).toContain("Unknown sender");
    const before = await protectedSnapshot();
    expect((await register("msg-006", item)).ok).toBe(false);
    expect((await register("msg-006", item, true)).ok).toBe(false);
    expect(await protectedSnapshot()).toBe(before);
    const confirmed = humanDemoCandidate(item);
    expect((await register("msg-006", confirmed, true)).ok).toBe(true);
    expect((await repository.readState()).contratos.at(-1)!.id_contrato).toBe(
      "CM-2026-03",
    );
  });
  it("RN5 validation alone and forged high confidence do not authorize writes", async () => {
    const item = await candidate("msg-006");
    await check("msg-006", item);
    const forged = humanDemoCandidate(item);
    for (const key of fieldKeys) forged[key].confianza = 1;
    const before = await protectedSnapshot();
    const result = await register("msg-006", forged);
    expect(result.ok).toBe(false);
    expect(await protectedSnapshot()).toBe(before);
  });
  it("RN6 all 14 original fixture hashes remain unchanged", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "docs", "fixture-sha256.json"), "utf8"),
    ) as Array<{ path: string; sha256: string }>;
    expect(manifest).toHaveLength(14);
    for (const entry of manifest) {
      const hash = createHash("sha256")
        .update(await readFile(path.join(root, entry.path)))
        .digest("hex");
      expect(hash, entry.path).toBe(entry.sha256);
    }
    await tools.leer_buzon.execute({}, ctx);
    expect(
      await readFile(
        path.join(output, "sharepoint", "maestro-contratos.csv"),
        "utf8",
      ),
    ).toBe(
      await readFile(
        path.join(root, "fixtures", "reto-02", "maestro-contratos.csv"),
        "utf8",
      ),
    );
  });
  it("RN7 logs every successful and failed execution with required envelope", async () => {
    await tools.leer_buzon.execute({}, ctx);
    await tools.extraer.execute({ mensaje_id: "msg-999" }, ctx);
    await tools.alertas.execute({ hoy: "2026-02-30" }, ctx);
    const logs = (await readFile(path.join(output, "log.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(logs).toHaveLength(3);
    for (const log of logs)
      expect(Object.keys(log).sort()).toEqual(
        ["ts", "herramienta", "mensaje_id", "ok", "resumen"].sort(),
      );
    expect(logs.map((x) => x.ok)).toEqual([true, false, false]);
  });
});
describe("boundaries, errors, idempotency and deterministic replay", () => {
  it("RN2 object similarity admits 0.9 and excludes a value below 0.9", async () => {
    const item = await candidate("msg-001");
    await repository.transaction((state) => {
      state.contratos[0]!.objeto = "abcdefghij";
    });
    item.id_contrato = field("OTHER-2026-1", "human:test");
    item.objeto = field("abcdefghiX", "human:test");
    expect(similarity(item.objeto.valor!, "abcdefghij")).toBe(0.9);
    expect((await check("msg-001", item)).clasificacion).toBe("actualizacion");
    item.objeto = field("abcdefghXY", "human:test");
    expect(similarity(item.objeto.valor!, "abcdefghij")).toBe(0.8);
    expect((await check("msg-001", item)).clasificacion).toBe("nuevo");
  });
  it("expiry window includes day 0 and day 60 but not expired or day 61", async () => {
    await repository.transaction((state) => {
      const template = state.contratos[0]!;
      state.contratos = [
        { ...template, id_contrato: "TODAY", fecha_fin: "2026-09-03" },
        { ...template, id_contrato: "DAY60", fecha_fin: "2026-11-02" },
        { ...template, id_contrato: "DAY61", fecha_fin: "2026-11-03" },
        { ...template, id_contrato: "EXPIRED", fecha_fin: "2026-09-02" },
      ];
    });
    const data = readResult<{ vencen: Array<{ id_contrato: string }> }>(
      await tools.alertas.execute({ hoy: "2026-09-03" }, ctx),
    );
    expect(data.vencen.map((x) => x.id_contrato)).toEqual(["TODAY", "DAY60"]);
  });
  it("AUTO identifier assignment skips occupied sequence numbers", async () => {
    const item = await candidate("msg-001");
    item.id_contrato = field(null, "human:missing-source-id");
    await repository.transaction((state) => {
      state.contratos.push({
        ...state.contratos[1]!,
        id_contrato: "AUTO-2026-0001",
      });
    });
    const result = await register("msg-001", item, true);
    expect(result.ok && result.data.id_contrato).toBe("AUTO-2026-0002");
  });
  it("rejects impossible date and unknown currency without preventing the next message", async () => {
    class BrokenRepository extends FileRepository {
      override async messages() {
        const docs = await super.messages();
        docs[0]!.archivos["contrato.txt"] = docs[0]!.archivos[
          "contrato.txt"
        ]!.replace("COP $265.000.000", "XYZ $265.000.000");
        return docs;
      }
    }
    ctx.repository = new BrokenRepository(root, output);
    const bad = JSON.parse(
      await tools.extraer.execute({ mensaje_id: "msg-001" }, ctx),
    ) as ToolResult<Contract>;
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("Unknown currency");
    expect((await candidate("msg-002")).moneda.valor).toBe("USD");
    ctx.repository = repository;
    const item = await candidate("msg-001");
    item.fecha_fin = field("2027-02-30", "human:test");
    expect(
      JSON.parse(
        await tools.validar.execute(
          { mensaje_id: "msg-001", contrato: item },
          ctx,
        ),
      ).ok,
    ).toBe(false);
  });
  it("rejects empty attachment and missing identifiable parties/object", async () => {
    class EmptyRepository extends FileRepository {
      override async messages() {
        const docs = await super.messages();
        docs[0]!.archivos["contrato.txt"] = "";
        return docs;
      }
    }
    ctx.repository = new EmptyRepository(root, output);
    expect(
      JSON.parse(await tools.extraer.execute({ mensaje_id: "msg-001" }, ctx))
        .ok,
    ).toBe(false);
    ctx.repository = repository;
    const item = await candidate("msg-001");
    item.objeto = field(null, "");
    expect((await check("msg-001", item)).clasificacion).toBe("rechazado");
  });
  it("prevents repeated or concurrent message registration from duplicating rows/history", async () => {
    const item = await candidate("msg-001");
    const results = await Promise.all([
      register("msg-001", item),
      register("msg-001", item),
    ]);
    expect(
      results.filter((x) => x.ok && x.data.accion === "create"),
    ).toHaveLength(1);
    expect(
      results.filter((x) => x.ok && x.data.accion === "duplicate"),
    ).toHaveLength(1);
    const state = await repository.readState();
    expect(state.contratos).toHaveLength(9);
    expect(state.historial).toHaveLength(1);
    const inbox = readResult<{ mensajes: Array<{ id: string }> }>(
      await tools.leer_buzon.execute({}, ctx),
    );
    expect(inbox.mensajes.map((x) => x.id)).not.toContain("msg-001");
  });
  it("matches NIT + object similarity >=0.9 even with a different contract identifier", async () => {
    const item = await candidate("msg-001");
    const master = (await repository.readState()).contratos[0]!;
    item.id_contrato = field("OTHER-2026-1", "human:test");
    item.objeto = field(master.objeto + "!", "human:test");
    expect(similarity(item.objeto.valor!, master.objeto)).toBe(1);
    const validation = await check("msg-001", item);
    expect(validation.clasificacion).toBe("actualizacion");
    expect(validation.id_contrato_existente).toBe("CT-2025-018");
  });
  it("all extracted fields have bounded confidence and provenance", async () => {
    for (const id of ["msg-001", "msg-002", "msg-003", "msg-004", "msg-006"]) {
      const item = await candidate(id);
      for (const key of fieldKeys) {
        expect(item[key].confianza).toBeGreaterThanOrEqual(0);
        expect(item[key].confianza).toBeLessThanOrEqual(1);
        expect(typeof item[key].fuente).toBe("string");
        if (item[key].valor === null) expect(item[key].confianza).toBe(0);
      }
    }
  });
  it("candidate-bound authorization mismatch fails without writing", async () => {
    const item = humanDemoCandidate(await candidate("msg-006"));
    ctx.authorization = {
      mensajeId: "msg-006",
      candidate: "different-candidate",
    };
    const before = await protectedSnapshot();
    expect((await register("msg-006", item, true)).ok).toBe(false);
    expect(await protectedSnapshot()).toBe(before);
  });
  it("alerts include all three sections and exact 60-day boundary filtering", async () => {
    await register("msg-001", await candidate("msg-001"));
    const data = readResult<{
      vencen: Array<{ id_contrato: string }>;
      polizas_pendientes: Array<{ id_contrato: string }>;
      registrados_desde_corte: Array<{ id_contrato: string }>;
    }>(await tools.alertas.execute({ hoy: "2026-09-03" }, ctx));
    expect(data.vencen.map((x) => x.id_contrato)).toEqual([
      "CT-2026-004",
      "CT-2026-009",
    ]);
    expect(data.polizas_pendientes.map((x) => x.id_contrato)).toEqual([
      "CT-2026-004",
      "CT-2026-015",
    ]);
    expect(data.registrados_desde_corte.map((x) => x.id_contrato)).toEqual([
      "CT-2026-015",
    ]);
    const report = await readFile(path.join(output, "alertas.md"), "utf8");
    expect(report.match(/^## /gm)).toHaveLength(3);
  });
  it("tools validate arguments internally and always return a JSON envelope", async () => {
    const result = JSON.parse(
      await tools.alertas.execute(
        { hoy: 25 } as unknown as { hoy: string },
        ctx,
      ),
    ) as ToolResult<unknown>;
    expect(result.ok).toBe(false);
    expect(
      JSON.parse(
        await tools.extraer.execute({ mensaje_id: "../../secret" }, ctx),
      ).ok,
    ).toBe(false);
  });
  it("CSV round trips quoted comma/newline data without losing columns", async () => {
    const rows = (await repository.readState()).contratos;
    rows[0]!.objeto = 'A, B\n"quoted"';
    const csv = serializeCsv(rows);
    expect(parseCsv(csv)[0]!.objeto).toBe('A, B\n"quoted"');
  });
  it("output paths cannot escape project out/", () => {
    expect(() => new FileRepository(root, path.join(root, "fixtures"))).toThrow(
      "inside project out/",
    );
  });
  it("two independently isolated tool demos have identical normalized outcomes", async () => {
    const second = path.join(root, "out", "test-" + randomUUID());
    cleanup.push(second);
    const firstResult = await runScenario(ctx);
    const secondResult = await runScenario({
      ...ctx,
      repository: new FileRepository(root, second),
    });
    expect(secondResult).toEqual(firstResult);
    expect(firstResult.outcomes.map((x) => x.accion)).toEqual([
      "create",
      "create",
      "update",
      "duplicate",
      "reject",
      "human_review",
    ]);
    expect(firstResult.confirmation.accion).toBe("create");
  });
});
