import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { FileRepository } from "../src/adapters/file-repository.js";
import { resolveCommercial } from "../src/domain/commercials.js";
import type { Commercial, Contract } from "../src/domain/contracts.js";
import * as tools from "../src/tools/contratos.js";
import { readResult } from "../src/services/demo-scenario.js";
import { toolDefinitions } from "../src/agent/orchestrator.js";
let output: string;
let repository: FileRepository;
beforeEach(() => {
  output = path.join(process.cwd(), "out", "acceptance-" + randomUUID());
  repository = new FileRepository(process.cwd(), output);
});
afterEach(async () => {
  await rm(output, { recursive: true, force: true });
});
const context = () => ({
  directory: process.cwd(),
  sessionId: "acceptance-schema",
  repository,
  hoy: "2026-09-03",
});
type SchemaFailure = {
  ok: false;
  error: string;
  code: string;
  issues: Array<{ path: string; code: string; message: string }>;
};
describe("expanded acceptance contracts", () => {
  it("strict tool args return structured Zod issues and a backward-compatible readable error", async () => {
    const result = JSON.parse(
      await tools.leer_buzon.execute(
        { unexpected: true } as unknown as {},
        context(),
      ),
    ) as SchemaFailure;
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.code).toBe("schema_validation_error");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unrecognized_keys" }),
      ]),
    );
    expect(
      result.issues.every(
        (issue) =>
          typeof issue.path === "string" && typeof issue.message === "string",
      ),
    ).toBe(true);
  });
  it.each([-0.01, 1.01])(
    "confidence %s is rejected at its exact field path without writing",
    async (confidence) => {
      const contract = readResult<Contract>(
        await tools.extraer.execute({ mensaje_id: "msg-001" }, context()),
      );
      contract.valor.confianza = confidence;
      const before = await repository.readState();
      const result = JSON.parse(
        await tools.registrar.execute(
          { mensaje_id: "msg-001", contrato: contract },
          context(),
        ),
      ) as SchemaFailure;
      expect(result.code).toBe("schema_validation_error");
      expect(
        result.issues.some(
          (issue) => issue.path === "contrato.valor.confianza",
        ),
      ).toBe(true);
      expect(await repository.readState()).toEqual(before);
    },
  );
  it("unexpected nested contract/field metadata cannot be silently stripped", async () => {
    const contract = readResult<Contract>(
      await tools.extraer.execute({ mensaje_id: "msg-001" }, context()),
    );
    const altered = {
      ...contract,
      cliente: { ...contract.cliente, unauthorizedMetadata: "not allowed" },
    };
    const result = JSON.parse(
      await tools.validar.execute(
        { mensaje_id: "msg-001", contrato: altered },
        context(),
      ),
    ) as SchemaFailure;
    expect(result.code).toBe("schema_validation_error");
    expect(
      result.issues.some(
        (issue) =>
          issue.path === "contrato.cliente" &&
          issue.code === "unrecognized_keys",
      ),
    ).toBe(true);
  });
  it("catalog resolver returns exact email/name/region and does not invent an unknown commercial", async () => {
    const catalog = await repository.commercials();
    const original = JSON.parse(
      await readFile("fixtures/reto-02/comerciales.json", "utf8"),
    ) as Commercial[];
    for (const record of original) {
      expect(resolveCommercial(record.email, catalog)).toEqual(record);
      expect(resolveCommercial(record.email.toUpperCase(), catalog)).toEqual(
        record,
      );
      expect(resolveCommercial(record.email, catalog)!.region).toBe(
        record.region,
      );
    }
    expect(
      resolveCommercial("not-in-catalog@example.invalid", catalog),
    ).toBeNull();
    const contract = readResult<Contract>(
      await tools.extraer.execute({ mensaje_id: "msg-001" }, context()),
    );
    expect(contract.comercial.valor).toBe(original[0]!.nombre);
  });
  it("every model-facing tool has strict object parameters and described arguments", () => {
    expect(toolDefinitions).toHaveLength(5);
    for (const definition of toolDefinitions) {
      expect(definition.description.length).toBeGreaterThan(10);
      expect(definition.parameters.additionalProperties).toBe(false);
      const properties = definition.parameters.properties as Record<
        string,
        { description?: string }
      >;
      for (const schema of Object.values(properties))
        expect(typeof schema.description).toBe("string");
    }
  });
  it("cost means/monthly scenarios are arithmetic derivations, never individually measured mail usage", async () => {
    const data = JSON.parse(
      await readFile("docs/COST-ASSUMPTIONS.json", "utf8"),
    ) as {
      observed_batch: {
        messages: number;
        input_tokens: number;
        output_tokens: number;
      };
      rates_usd_per_million: { input: number; output: number };
    };
    const batch = data.observed_batch;
    const cost =
      (batch.input_tokens * data.rates_usd_per_million.input +
        batch.output_tokens * data.rates_usd_per_million.output) /
      1000000;
    expect(batch.input_tokens / batch.messages).toBe(14398.5);
    expect(batch.output_tokens / batch.messages).toBeCloseTo(745.333333333, 9);
    expect(cost).toBeCloseTo(0.208558, 9);
    expect(cost / batch.messages).toBeCloseTo(0.034759666667, 9);
    expect((cost / batch.messages) * 100).toBeCloseTo(3.475966666667, 9);
    expect((cost / batch.messages) * 1000).toBeCloseTo(34.759666666667, 9);
  });
});
