import { z } from "zod";

export const countrySchema = z.enum(["CO", "EC", "PE", "PA", "HN"]);
export const currencySchema = z.enum(["COP", "USD", "PEN", "PAB", "HNL"]);
export const policySchema = z.enum([
  "vigente",
  "pendiente",
  "vencida",
  "no_aplica",
]);
export function fieldSchema<T extends z.ZodType>(value: T) {
  return z.strictObject({
    valor: value.nullable(),
    confianza: z.number().min(0).max(1),
    fuente: z.string(),
  });
}
export const contractSchema = z.strictObject({
  id_contrato: fieldSchema(z.string()),
  cliente: fieldSchema(z.string()),
  nit_cliente: fieldSchema(z.string()),
  pais: fieldSchema(countrySchema),
  objeto: fieldSchema(z.string().max(200)),
  valor: fieldSchema(z.number().nonnegative()),
  moneda: fieldSchema(currencySchema),
  fecha_inicio: fieldSchema(z.string()),
  fecha_fin: fieldSchema(z.string()),
  requiere_poliza: fieldSchema(z.boolean()),
  tipo_poliza: fieldSchema(z.string()),
  estado_poliza: fieldSchema(policySchema),
  comercial: fieldSchema(z.string()),
  valor_indeterminado: z.boolean(),
  es_otrosi: z.boolean(),
  advertencias: z.array(z.string()),
});
export type Contract = z.infer<typeof contractSchema>;
export type Field<T> = { valor: T | null; confianza: number; fuente: string };
export type FieldKey = Exclude<
  keyof Contract,
  "valor_indeterminado" | "es_otrosi" | "advertencias"
>;
export const fieldKeys: FieldKey[] = [
  "id_contrato",
  "cliente",
  "nit_cliente",
  "pais",
  "objeto",
  "valor",
  "moneda",
  "fecha_inicio",
  "fecha_fin",
  "requiere_poliza",
  "tipo_poliza",
  "estado_poliza",
  "comercial",
];
export type MasterRow = {
  id_contrato: string;
  cliente: string;
  nit_cliente: string;
  pais: z.infer<typeof countrySchema>;
  objeto: string;
  valor: number;
  moneda: z.infer<typeof currencySchema>;
  fecha_inicio: string;
  fecha_fin: string;
  requiere_poliza: boolean;
  tipo_poliza: string;
  estado_poliza: z.infer<typeof policySchema>;
  comercial: string;
  ruta_sharepoint: string;
  fecha_registro: string;
  fuente: "buzon" | "manual" | "migracion";
};
export type Message = {
  id: string;
  de: string;
  para: string;
  asunto: string;
  fecha: string;
  cuerpo: string;
  adjuntos: string[];
};
export type MessageDocument = {
  correo: Message;
  archivos: Record<string, string>;
};
export type Commercial = { email: string; nombre: string; region: string };
export type Classification =
  | "nuevo"
  | "actualizacion"
  | "duplicado"
  | "rechazado";
export type Validation = {
  clasificacion: Classification;
  id_contrato_existente?: string;
  requiere_revision: string[];
  diferencias: Record<string, { antes: unknown; despues: unknown }>;
  advertencias: string[];
  motivo?: string;
};
export type HistoryEntry = {
  ts: string;
  id_contrato: string;
  accion: string;
  cambios: Validation["diferencias"];
  mensaje_id: string;
};
export type Registration = {
  id_contrato: string;
  accion: "create" | "update" | "duplicate" | "reject";
  ruta_archivo: string;
  motivo?: string;
};
export type AuditEntry = {
  ts: string;
  herramienta: string;
  mensaje_id: string | null;
  ok: boolean;
  resumen: string;
};
export type State = {
  contratos: MasterRow[];
  procesados: Record<string, Registration>;
  historial: HistoryEntry[];
  archivos: Record<string, string>;
};
export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
export function field<T>(
  valor: T | null,
  fuente: string,
  confianza = valor === null ? 0 : 1,
): Field<T> {
  return { valor, confianza, fuente };
}
export function emptyContract(): Contract {
  return {
    id_contrato: field(null, ""),
    cliente: field(null, ""),
    nit_cliente: field(null, ""),
    pais: field(null, ""),
    objeto: field(null, ""),
    valor: field(null, ""),
    moneda: field(null, ""),
    fecha_inicio: field(null, ""),
    fecha_fin: field(null, ""),
    requiere_poliza: field(null, ""),
    tipo_poliza: field(null, ""),
    estado_poliza: field(null, ""),
    comercial: field(null, ""),
    valor_indeterminado: false,
    es_otrosi: false,
    advertencias: [],
  };
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function similarity(a: string, b: string): number {
  const x = normalize(a),
    y = normalize(b);
  if (x === y) return 1;
  if (!x || !y) return 0;
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const old = prev[j]!;
      prev[j] = Math.min(
        prev[j]! + 1,
        prev[j - 1]! + 1,
        diagonal + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return 1 - prev[y.length]! / Math.max(x.length, y.length);
}
