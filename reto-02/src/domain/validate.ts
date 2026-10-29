import {
  fieldKeys,
  similarity,
  normalize,
  validDate,
  type Contract,
  type MasterRow,
  type MessageDocument,
  type Validation,
} from "./contracts.js";
import { identifiable, contractAttachment } from "./extract.js";
export function validate(
  doc: MessageDocument,
  candidate: Contract,
  master: MasterRow[],
  baseline?: Contract,
): Validation {
  const result: Validation = {
    clasificacion: "nuevo",
    requiere_revision: [],
    diferencias: {},
    advertencias: [...candidate.advertencias],
  };
  if (!identifiable(doc, candidate))
    return {
      ...result,
      clasificacion: "rechazado",
      motivo: "No contract attachment or identifiable parties and object",
    };
  for (const key of ["fecha_inicio", "fecha_fin"] as const)
    if (candidate[key].valor !== null && !validDate(candidate[key].valor!))
      throw new Error(`Invalid date: ${key}`);
  if (
    candidate.fecha_inicio.valor &&
    candidate.fecha_fin.valor &&
    candidate.fecha_fin.valor < candidate.fecha_inicio.valor
  )
    throw new Error("End date precedes start date");
  for (const key of fieldKeys) {
    if (key === "comercial") continue; // An unknown sender is explicitly non-blocking under HU3.
    if (key === "id_contrato" && candidate[key].valor === null) continue; // AUTO identifier assigned only at a successful create.
    const entry = candidate[key];
    if (entry.valor === null || entry.confianza < 0.8)
      result.requiere_revision.push(key);
    if (
      baseline &&
      entry.valor === baseline[key].valor &&
      baseline[key].confianza < 0.8 &&
      !entry.fuente.startsWith("human:")
    )
      result.requiere_revision.push(key);
    if (
      baseline &&
      entry.valor !== baseline[key].valor &&
      !result.requiere_revision.includes(key)
    )
      result.requiere_revision.push(key);
  }
  const existing =
    master.find(
      (row) =>
        candidate.id_contrato.valor !== null &&
        row.id_contrato === candidate.id_contrato.valor,
    ) ??
    master.find(
      (row) =>
        row.nit_cliente === candidate.nit_cliente.valor &&
        similarity(row.objeto, candidate.objeto.valor ?? "") >= 0.9,
    );
  if (existing) {
    result.id_contrato_existente = existing.id_contrato;
    if (
      existing.id_contrato === candidate.id_contrato.valor &&
      ["valor", "fecha_inicio", "fecha_fin"].every(
        (key) =>
          existing[key as "valor" | "fecha_inicio" | "fecha_fin"] ===
          candidate[key as "valor" | "fecha_inicio" | "fecha_fin"].valor,
      )
    )
      result.clasificacion = "duplicado";
    else result.clasificacion = "actualizacion";
    for (const key of fieldKeys)
      if (key !== "comercial" && existing[key] !== candidate[key].valor)
        result.diferencias[key] = {
          antes: existing[key],
          despues: candidate[key].valor,
        };
  }
  if (existing && result.clasificacion === "actualizacion") {
    const attachment = contractAttachment(doc);
    const explicitAmendment =
      attachment !== null && /^\s*OTROS[IÍ](?=\s|$)/i.test(attachment.text);
    const documentSource = attachment
      ? `fixtures/reto-02/buzon/${doc.correo.id}/${attachment.name}`
      : "";
    const conflicts: string[] = [];
    for (const key of fieldKeys) {
      if (key === "comercial" || existing[key] === candidate[key].valor)
        continue;
      if (
        key === "cliente" &&
        normalize(existing.cliente).replace(/\s/g, "") ===
          normalize(candidate.cliente.valor ?? "").replace(/\s/g, "")
      )
        continue;
      if (
        key === "objeto" &&
        normalize(existing.objeto) === normalize(candidate.objeto.valor ?? "")
      )
        continue;
      const intendedChange =
        explicitAmendment &&
        baseline !== undefined &&
        (key === "valor" || key === "fecha_fin") &&
        baseline[key].fuente === documentSource &&
        baseline[key].valor === candidate[key].valor;
      if (!intendedChange) conflicts.push(key);
    }
    result.requiere_revision.push(...conflicts);
    if (conflicts.length)
      result.advertencias.push(
        "Master conflict requires human review: " + conflicts.join(", "),
      );
  }
  result.requiere_revision = [...new Set(result.requiere_revision)];
  return result;
}
