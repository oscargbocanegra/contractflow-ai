import {
  emptyContract,
  field,
  type Contract,
  type ToolResult,
  type Validation,
  type Registration,
} from "../domain/contracts.js";
import type { ToolContext } from "../ports/repository.js";
import * as tools from "../tools/contratos.js";
export function readResult<T>(serialized: string): T {
  const result = JSON.parse(serialized) as ToolResult<T>;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
export function humanDemoCandidate(contract: Contract): Contract {
  const candidate = structuredClone(contract);
  const source = "human:explicit-demo-input-not-extracted";
  candidate.valor = field(0, source);
  candidate.moneda = field("COP", source);
  candidate.fecha_inicio = field("2026-09-01", source);
  candidate.fecha_fin = field("2027-08-31", source);
  candidate.requiere_poliza = field(false, source);
  candidate.tipo_poliza = field("", source);
  candidate.estado_poliza = field("no_aplica", source);
  return candidate;
}
export type DemoOutcome = {
  mensaje_id: string;
  clasificacion: string;
  requiere_revision: string[];
  accion: string;
  error?: string;
};
export async function runScenario(ctx: ToolContext): Promise<{
  outcomes: DemoOutcome[];
  confirmation: Registration;
  alertIds: string[];
}> {
  const inbox = readResult<{
    mensajes: Array<{ id: string; tiene_contrato: boolean }>;
  }>(await tools.leer_buzon.execute({}, ctx));
  const outcomes: DemoOutcome[] = [];
  let pending: Contract | undefined;
  for (const message of inbox.mensajes) {
    let contract: Contract;
    if (message.tiene_contrato)
      contract = readResult<Contract>(
        await tools.extraer.execute({ mensaje_id: message.id }, ctx),
      );
    else contract = emptyContract();
    const check = readResult<Validation>(
      await tools.validar.execute(
        { mensaje_id: message.id, contrato: contract },
        ctx,
      ),
    );
    const registration = JSON.parse(
      await tools.registrar.execute(
        { mensaje_id: message.id, contrato: contract },
        ctx,
      ),
    ) as ToolResult<Registration>;
    outcomes.push({
      mensaje_id: message.id,
      clasificacion: check.clasificacion,
      requiere_revision: check.requiere_revision,
      accion: registration.ok ? registration.data.accion : "human_review",
      ...(!registration.ok ? { error: registration.error } : {}),
    });
    if (message.id === "msg-006") pending = contract;
  }
  if (!pending) throw new Error("Demo did not reach msg-006");
  const candidate = humanDemoCandidate(pending);
  const confirmation = readResult<Registration>(
    await tools.registrar.execute(
      { mensaje_id: "msg-006", contrato: candidate, confirmado: true },
      ctx,
    ),
  );
  const alerts = readResult<{ vencen: Array<{ id_contrato: string }> }>(
    await tools.alertas.execute({ hoy: "2026-09-03" }, ctx),
  );
  return {
    outcomes,
    confirmation,
    alertIds: alerts.vencen.map((row) => row.id_contrato),
  };
}
