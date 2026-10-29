import {
  contractSchema,
  fieldKeys,
  normalize,
  validDate,
  type Contract,
  type MasterRow,
  type Registration,
  type Validation,
} from "../domain/contracts.js";
import { contractAttachment, extract } from "../domain/extract.js";
import { validate } from "../domain/validate.js";
import type { ContractRepository } from "../ports/repository.js";
export class ContractService {
  constructor(
    readonly repository: ContractRepository,
    readonly today = "2026-09-03",
  ) {}
  async document(id: string) {
    const doc = (await this.repository.messages()).find(
      (item) => item.correo.id === id,
    );
    if (!doc) throw new Error("Unknown message ID");
    return doc;
  }
  async inbox() {
    const state = await this.repository.readState();
    return {
      mensajes: (await this.repository.messages())
        .filter((doc) => !state.procesados[doc.correo.id])
        .map((doc) => ({
          ...doc.correo,
          tiene_contrato: contractAttachment(doc) !== null,
          ...(contractAttachment(doc) === null
            ? { clasificacion: "rechazado", motivo: "No contract attachment" }
            : {}),
        })),
    };
  }
  async extract(id: string): Promise<Contract> {
    const doc = await this.document(id);
    return extract(
      doc,
      (await this.repository.readState()).contratos,
      await this.repository.commercials(),
    );
  }
  async validate(id: string, candidate: Contract): Promise<Validation> {
    const doc = await this.document(id);
    const state = await this.repository.readState();
    const baseline = contractAttachment(doc)
      ? extract(doc, state.contratos, await this.repository.commercials())
      : undefined;
    return validate(
      doc,
      contractSchema.parse(candidate),
      state.contratos,
      baseline,
    );
  }
  async register(
    id: string,
    candidate: Contract,
    confirmed = false,
  ): Promise<Registration> {
    const parsed = contractSchema.parse(candidate);
    const doc = await this.document(id);
    const commercials = await this.repository.commercials();
    return this.repository.transaction((state) => {
      const prior = state.procesados[id];
      if (prior) return { ...prior, accion: "duplicate" as const };
      const attachment = contractAttachment(doc);
      const baseline = attachment
        ? extract(doc, state.contratos, commercials)
        : undefined;
      const check = validate(doc, parsed, state.contratos, baseline);
      if (check.clasificacion === "rechazado")
        return {
          id_contrato: parsed.id_contrato.valor ?? "",
          accion: "reject",
          ruta_archivo: "",
          motivo: check.motivo,
        };
      if (check.clasificacion === "duplicado")
        return {
          id_contrato: check.id_contrato_existente!,
          accion: "duplicate",
          ruta_archivo: state.contratos.find(
            (row) => row.id_contrato === check.id_contrato_existente,
          )!.ruta_sharepoint,
        };
      if (check.requiere_revision.length && !confirmed)
        throw new Error(
          "requiere revisión: " + check.requiere_revision.join(", "),
        );
      const essential = fieldKeys.filter(
        (key) => !["id_contrato", "comercial"].includes(key),
      );
      const missing = essential.filter((key) => parsed[key].valor === null);
      if (missing.length)
        throw new Error(
          "Missing essential fields even after confirmation: " +
            missing.join(", "),
        );
      if (!validDate(this.today))
        throw new Error("Invalid registration reference date");
      const prefix = `AUTO-${parsed.fecha_inicio.valor!.slice(0, 4)}-`;
      let sequence = 1;
      while (
        state.contratos.some(
          (row) =>
            row.id_contrato === prefix + String(sequence).padStart(4, "0"),
        )
      )
        sequence++;
      const newId =
        parsed.id_contrato.valor ?? prefix + String(sequence).padStart(4, "0");
      const existing = state.contratos.find(
        (row) => row.id_contrato === check.id_contrato_existente,
      );
      const recordId = existing?.id_contrato ?? newId;
      const slug = normalize(parsed.cliente.valor!).replace(/ /g, "-");
      const safeId = recordId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const ext = attachment!.name.split(".").pop() ?? "txt";
      const archive = `Contratos/${parsed.fecha_inicio.valor!.slice(0, 4)}/${slug}/${safeId}.${ext}`;
      const row: MasterRow = {
        id_contrato: recordId,
        cliente: parsed.cliente.valor!,
        nit_cliente: parsed.nit_cliente.valor!,
        pais: parsed.pais.valor!,
        objeto: parsed.objeto.valor!,
        valor: parsed.valor.valor!,
        moneda: parsed.moneda.valor!,
        fecha_inicio: parsed.fecha_inicio.valor!,
        fecha_fin: parsed.fecha_fin.valor!,
        requiere_poliza: parsed.requiere_poliza.valor!,
        tipo_poliza: parsed.requiere_poliza.valor
          ? parsed.tipo_poliza.valor!
          : "",
        estado_poliza: parsed.requiere_poliza.valor
          ? existing?.estado_poliza === "vigente"
            ? "vigente"
            : "pendiente"
          : "no_aplica",
        comercial: parsed.comercial.valor ?? doc.correo.de,
        ruta_sharepoint: archive,
        fecha_registro: existing?.fecha_registro ?? this.today,
        fuente: "buzon",
      };
      const action = existing ? "update" : "create";
      if (existing) state.contratos[state.contratos.indexOf(existing)] = row;
      else state.contratos.push(row);
      state.historial.push({
        ts: new Date().toISOString(),
        id_contrato: recordId,
        accion: action,
        cambios: check.diferencias,
        mensaje_id: id,
      });
      state.archivos[archive] = attachment!.text;
      const result: Registration = {
        id_contrato: recordId,
        accion: action,
        ruta_archivo: archive,
      };
      state.procesados[id] = result;
      return result;
    });
  }
  async alerts(today: string) {
    if (!validDate(today)) throw new Error("Invalid reference date");
    const rows = (await this.repository.readState()).contratos;
    const start = Date.parse(today + "T00:00:00Z");
    const vencen = rows.filter((row) => {
      const days =
        (Date.parse(row.fecha_fin + "T00:00:00Z") - start) / 86400000;
      return days >= 0 && days <= 60;
    });
    const polizas_pendientes = rows.filter(
      (row) => row.requiere_poliza && row.estado_poliza !== "vigente",
    );
    const registrados_desde_corte = rows.filter(
      (row) => row.fecha_registro >= "2026-05-30",
    );
    const list = (items: MasterRow[]) =>
      items.length
        ? items
            .map(
              (row) =>
                `- ${row.id_contrato} | ${row.cliente} | ${row.fecha_fin} | ${row.estado_poliza}`,
            )
            .join("\n")
        : "- None";
    await this.repository.report(
      `# Contract alerts — ${today}\n\n## Expiring in <= 60 days\n${list(vencen)}\n\n## Pending policies\n${list(polizas_pendientes)}\n\n## Registered since 2026-05-30\n${list(registrados_desde_corte)}\n`,
    );
    return {
      ruta: "out/alertas.md",
      vencen,
      polizas_pendientes,
      registrados_desde_corte,
    };
  }
}
