import { extractPolicy } from "./policy.js";
import {
  countrySchema,
  currencySchema,
  emptyContract,
  field,
  normalize,
  validDate,
  type Commercial,
  type Contract,
  type MasterRow,
  type MessageDocument,
} from "./contracts.js";
const months: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
export function parseSpanishDates(text: string): string[] {
  const found: string[] = [];
  const rx =
    /(?:\((\d{1,2})\)|(\d{1,2}))\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/gi;
  for (const m of text.matchAll(rx)) {
    const date = `${m[4]}-${String(months[m[3]!.toLowerCase()]).padStart(2, "0")}-${String(m[1] ?? m[2]).padStart(2, "0")}`;
    if (!validDate(date)) throw new Error("Invalid date in contract text");
    found.push(date);
  }
  return found;
}
export function contractAttachment(
  doc: MessageDocument,
): { name: string; text: string } | null {
  for (const name of doc.correo.adjuntos) {
    const text = doc.archivos[name];
    if (
      text !== undefined &&
      /\b(?:CONTRATO|OTROS[IÍ])\b/i.test(text) &&
      !/^\s*COTIZACI[OÓ]N/i.test(text)
    )
      return { name, text };
  }
  return null;
}
export function extract(
  doc: MessageDocument,
  master: MasterRow[],
  commercials: Commercial[],
): Contract {
  const attachment = contractAttachment(doc);
  if (!attachment) throw new Error("No contract attachment");
  const text = attachment.text;
  if (!text.trim()) throw new Error("Empty contract text");
  const source = `fixtures/reto-02/buzon/${doc.correo.id}/${attachment.name}`;
  const result = emptyContract();
  const id =
    text.match(/(?:CONTRATO[\s\S]{0,70}?No\.\s*)([A-Z]+-\d{4}-\d+)/i)?.[1] ??
    null;
  result.id_contrato = field(id, source);
  result.es_otrosi = /^\s*OTROS[IÍ]/i.test(text);
  const base = result.es_otrosi
    ? master.find((row) => row.id_contrato === id)
    : undefined;
  if (base) {
    for (const key of [
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
    ] as const) {
      Object.assign(
        result[key],
        field(
          base[key],
          `out/sharepoint/maestro-contratos.csv#${base.id_contrato}.${key}`,
        ),
      );
    }
    result.advertencias.push(
      "Policy extension required by amendment; existing vigente status is inherited, not proof of extended coverage.",
    );
  }
  const parties = text.match(
    /Entre\s+(?:los suscritos,\s*)?(.+?),\s*(?:identificad[ao]\s+con\s+)?(NIT|RUC)\s+([\d.\-]+)/i,
  );
  if (parties) {
    result.cliente = field(parties[1]!.trim(), source);
    let tax = parties[3]!.replace(/\./g, "");
    if (parties[2]!.toUpperCase() === "NIT") tax = tax.split("-")[0]!;
    result.nit_cliente = field(tax, source);
  }
  if (!result.es_otrosi || !base) {
    const location = parties
      ? text.slice(
          parties.index! + parties[0].length,
          text.indexOf("PERIFERIA"),
        )
      : "";
    const countries: Array<[RegExp, "CO" | "EC" | "PE" | "PA" | "HN"]> = [
      [/ecuador|quito/i, "EC"],
      [/per[uú]|lima/i, "PE"],
      [/panam[aá]/i, "PA"],
      [/honduras/i, "HN"],
      [/colombia|bogot[aá]|medell[ií]n|barranquilla/i, "CO"],
    ];
    result.pais = field(
      countries.find(([rx]) => rx.test(location))?.[1] ?? null,
      source,
    );
    const object =
      text
        .match(/PRIMERA\.\s*OBJETO\.\s*([\s\S]*?)(?=\n\s*SEGUNDA\.)/i)?.[1]
        ?.replace(/\s+/g, " ")
        .trim() ?? null;
    result.objeto = field(object?.slice(0, 200) ?? null, source);
  }
  const valueClause = result.es_otrosi
    ? text.match(/SEGUNDA\.\s*Modificar[\s\S]*?(?=\n\s*TERCERA\.)/i)?.[0]
    : text.match(/SEGUNDA\.\s*VALOR\.[\s\S]*?(?=\n\s*TERCERA\.)/i)?.[0];
  if (valueClause) {
    result.valor_indeterminado =
      /no tiene un valor determinado|por demanda|valor indeterminado/i.test(
        valueClause,
      );
    if (result.valor_indeterminado) {
      result.valor = field(0, source + "#demand-value", 0.6);
      result.moneda = field(
        /\bCOP\b/.test(text) ? "COP" : null,
        source + "#conditional-policy-currency",
        0.7,
      );
    } else {
      const amount = valueClause.match(/\b([A-Z]{3})\s*\$?([\d.,]+)/);
      if (amount) {
        const parsed = currencySchema.safeParse(amount[1]);
        if (!parsed.success) throw new Error("Unknown currency");
        let number = amount[2]!;
        if (/,\d{3}(?:,|\.)/.test(number) || /,\d{3}$/.test(number))
          number = number.replace(/,/g, "");
        else if (/\.\d{3}(?:\.|$)/.test(number))
          number = number.replace(/\./g, "");
        else number = number.replace(",", ".");
        result.valor = field(Number(number), source);
        result.moneda = field(parsed.data, source);
      }
    }
  }
  const term = result.es_otrosi
    ? text.match(/PRIMERA\.[\s\S]*?(?=\n\s*SEGUNDA\.)/i)?.[0]
    : text.match(/TERCERA\.\s*PLAZO\.[\s\S]*?(?=\n\s*CUARTA\.)/i)?.[0];
  const dates = parseSpanishDates(term ?? "");
  if (result.es_otrosi) {
    if (dates[0]) result.fecha_fin = field(dates[0], source);
  } else {
    if (dates[0]) result.fecha_inicio = field(dates[0], source);
    if (dates[1]) result.fecha_fin = field(dates[1], source);
    else if (dates[0]) {
      const duration = term?.match(/\((\d+)\)\s*meses/i)?.[1];
      if (duration) {
        const date = new Date(dates[0] + "T00:00:00Z");
        date.setUTCMonth(date.getUTCMonth() + Number(duration));
        date.setUTCDate(date.getUTCDate() - 1);
        result.fecha_fin = field(
          date.toISOString().slice(0, 10),
          source + "#derived-month-term",
          0.7,
        );
      }
    }
  }
  if (!result.es_otrosi) extractPolicy(result, doc, text, source);
  const commercial = commercials.find(
    (item) => item.email.toLowerCase() === doc.correo.de.toLowerCase(),
  );
  result.comercial = field(
    commercial?.nombre ?? null,
    commercial
      ? "fixtures/reto-02/comerciales.json"
      : `correo.json#${doc.correo.de}`,
  );
  if (!commercial) result.advertencias.push(`Unknown sender: ${doc.correo.de}`);
  countrySchema.nullable().parse(result.pais.valor);
  return result;
}
export function identifiable(
  doc: MessageDocument,
  candidate: Contract,
): boolean {
  return (
    contractAttachment(doc) !== null &&
    candidate.cliente.valor !== null &&
    candidate.nit_cliente.valor !== null &&
    candidate.objeto.valor !== null &&
    normalize(candidate.objeto.valor).length > 0
  );
}
