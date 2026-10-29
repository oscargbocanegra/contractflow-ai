import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { FileRepository } from "../src/adapters/file-repository.js";
import type {
  Contract,
  MessageDocument,
  ToolResult,
  Validation,
} from "../src/domain/contracts.js";
import * as tools from "../src/tools/contratos.js";
import { readResult } from "../src/services/demo-scenario.js";
let output: string;
beforeEach(() => {
  output = path.join(process.cwd(), "out", "policy-test-" + randomUUID());
});
afterEach(async () => {
  await rm(output, { recursive: true, force: true });
});
async function evaluate(
  transform: (docs: MessageDocument[]) => void,
  id = "msg-002",
) {
  class VariantRepository extends FileRepository {
    override async messages() {
      const docs = await super.messages();
      transform(docs);
      return docs;
    }
  }
  const repository = new VariantRepository(process.cwd(), output);
  const ctx = {
    directory: process.cwd(),
    sessionId: "policy-regression",
    repository,
    hoy: "2026-09-03",
  };
  const contract = readResult<Contract>(
    await tools.extraer.execute({ mensaje_id: id }, ctx),
  );
  const validation = readResult<Validation>(
    await tools.validar.execute({ mensaje_id: id, contrato: contract }, ctx),
  );
  const registration = JSON.parse(
    await tools.registrar.execute({ mensaje_id: id, contrato: contract }, ctx),
  ) as ToolResult<unknown>;
  return {
    contract,
    validation,
    registration,
    state: await repository.readState(),
  };
}
describe("policy certainty requires actual evidence, not a missing guarantee clause", () => {
  it("neutral email and absent clause remain null/0 and cannot register unconfirmed", async () => {
    const result = await evaluate((docs) => {
      docs[1]!.correo.cuerpo = "Adjunto el contrato firmado para su revisión.";
    });
    for (const key of [
      "requiere_poliza",
      "tipo_poliza",
      "estado_poliza",
    ] as const)
      expect(result.contract[key]).toMatchObject({ valor: null, confianza: 0 });
    expect(result.validation.requiere_revision).toEqual(
      expect.arrayContaining([
        "requiere_poliza",
        "tipo_poliza",
        "estado_poliza",
      ]),
    );
    expect(result.registration.ok).toBe(false);
    expect(result.state.contratos).toHaveLength(8);
  });
  it("original msg-002 explicit email negative stays registrable with actual email provenance", async () => {
    const result = await evaluate(() => undefined);
    expect(result.contract.requiere_poliza).toMatchObject({
      valor: false,
      confianza: 1,
    });
    expect(result.contract.requiere_poliza.fuente).toContain(
      "msg-002/correo.json#cuerpo",
    );
    expect(result.contract.estado_poliza.valor).toBe("no_aplica");
    expect(result.registration.ok).toBe(true);
  });
  it("explicit negative in the actual contract text is accepted without neutral-email inference", async () => {
    const result = await evaluate((docs) => {
      docs[1]!.correo.cuerpo = "Adjunto contrato firmado.";
      docs[1]!.archivos["contrato.txt"] +=
        "\nEste contrato no requiere póliza.\n";
    });
    expect(result.contract.requiere_poliza).toMatchObject({
      valor: false,
      confianza: 1,
    });
    expect(result.contract.requiere_poliza.fuente).toContain(
      "msg-002/contrato.txt",
    );
    expect(result.registration.ok).toBe(true);
  });
  it("positive contractual guarantee plus negative email is a conflict, not a certain false", async () => {
    const result = await evaluate((docs) => {
      docs[0]!.correo.cuerpo = "Este contrato no requiere póliza.";
    }, "msg-001");
    expect(result.contract.requiere_poliza).toMatchObject({
      valor: null,
      confianza: 0,
    });
    expect(result.contract.advertencias.join(" ")).toContain(
      "Conflicting policy evidence",
    );
    expect(result.registration.ok).toBe(false);
    expect(result.state.contratos).toHaveLength(8);
  });
  it("quoted or conditional negatives do not authorize a no-policy registration", async () => {
    for (const body of [
      "El cliente dijo «Este no pide póliza», favor confirmar.",
      "Este contrato no requiere póliza si se cumple la condición pendiente.",
      "No es cierto que este contrato no requiere póliza.",
    ]) {
      const result = await evaluate((docs) => {
        docs[1]!.correo.cuerpo = body;
      });
      expect(result.contract.requiere_poliza).toMatchObject({
        valor: null,
        confianza: 0,
      });
      expect(result.registration.ok).toBe(false);
    }
  });
  it("msg-004 remains RN1 duplicate/no-write without inventing missing policy evidence", async () => {
    const result = await evaluate(() => undefined, "msg-004");
    expect(result.contract.requiere_poliza).toMatchObject({
      valor: null,
      confianza: 0,
    });
    expect(result.validation.clasificacion).toBe("duplicado");
    expect(result.registration.ok).toBe(true);
    expect(result.state.contratos).toHaveLength(8);
    expect(result.state.historial).toHaveLength(0);
  });
});
