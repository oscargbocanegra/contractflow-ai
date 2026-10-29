import type { MasterRow } from "./contracts.js";
export const columns = [
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
  "ruta_sharepoint",
  "fecha_registro",
  "fuente",
] as const;
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (quoted) throw new Error("Invalid quoted CSV");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((key, i) => [key, values[i] ?? ""])),
  );
}
export function serializeCsv(rows: MasterRow[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return (
    columns.join(",") +
    "\n" +
    rows
      .map((row) => columns.map((key) => escape(row[key])).join(","))
      .join("\n") +
    "\n"
  );
}
export function parseMaster(text: string): MasterRow[] {
  return parseCsv(text).map(
    (row) =>
      ({
        ...row,
        valor: Number(row.valor),
        requiere_poliza: row.requiere_poliza === "true",
      }) as MasterRow,
  );
}
