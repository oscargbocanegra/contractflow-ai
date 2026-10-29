import {
  field,
  normalize,
  type Contract,
  type MessageDocument,
} from "./contracts.js";
type Evidence = {
  negative: boolean;
  positive: boolean;
  text: string;
  source: string;
};
function evidence(text: string, source: string): Evidence {
  const unquoted = text.replace(/"[^"\n]*"|“[^”]*”|«[^»]*»/g, " ");
  let negative = false;
  let positive = false;
  const statements: string[] = [];
  for (const sentence of unquoted.split(/[.!?;\n]+/)) {
    const value = normalize(sentence);
    if (!/\bpolizas?\b/.test(value)) continue;
    const explicitNegative =
      /^(?:(?:este(?: contrato)?|el contrato|el presente contrato) )?no (?:se )?(?:requiere|requieren|pide|piden|exige|exigen) (?:una |ninguna )?polizas?$/.test(
        value,
      );
    if (explicitNegative) {
      negative = true;
      statements.push(sentence.trim());
      continue;
    }
    if (
      /\bno\b|\bsi\b|\bcuando\b|\bsalvo\b|\bexcepto\b|\bpara cada orden\b|\bcuyo valor supere\b/.test(
        value,
      )
    )
      continue;
    if (
      /\b(?:constituira|debera constituir|debe constituir|requiere|exige|pide)\b.{0,180}\bpoliza\b/.test(
        value,
      )
    ) {
      positive = true;
      statements.push(sentence.trim());
    }
  }
  return { negative, positive, text: statements.join(" "), source };
}
export function extractPolicy(
  result: Contract,
  doc: MessageDocument,
  text: string,
  source: string,
): void {
  const guarantees = text.match(
    /(?:SEXTA|CUARTA)\.\s*GARANT[IÍ]AS\.[\s\S]*?(?=\n\s*(?:S[EÉ]PTIMA\.|Se firma|Para constancia))/i,
  )?.[0];
  if (guarantees && /Para cada orden|cuyo valor supere/i.test(guarantees)) {
    result.requiere_poliza = field(null, source + "#conditional-guarantee");
    result.tipo_poliza = field(
      /cumplimiento/i.test(guarantees) ? "cumplimiento" : null,
      source,
    );
    result.estado_poliza = field(null, source);
    result.advertencias.push(
      "Policy applies conditionally to individual service orders; applicability requires human determination.",
    );
    return;
  }
  const sources = [
    evidence(text, source),
    evidence(
      doc.correo.cuerpo,
      `fixtures/reto-02/buzon/${doc.correo.id}/correo.json#cuerpo`,
    ),
  ];
  const negative = sources.find((item) => item.negative);
  const positive = sources.find((item) => item.positive);
  if (negative && positive) {
    const provenance = negative.source + ";" + positive.source;
    result.requiere_poliza = field(null, provenance);
    result.tipo_poliza = field(null, provenance);
    result.estado_poliza = field(null, provenance);
    result.advertencias.push(
      "Conflicting policy evidence between source statements; human review required.",
    );
    return;
  }
  if (negative) {
    result.requiere_poliza = field(false, negative.source);
    result.tipo_poliza = field("", negative.source + "#rule:no-policy");
    result.estado_poliza = field(
      "no_aplica",
      negative.source + "#rule:no-policy",
    );
    return;
  }
  if (positive) {
    result.requiere_poliza = field(true, positive.source);
    result.tipo_poliza = field(
      /cumplimiento/i.test(positive.text) ? "cumplimiento" : null,
      positive.source,
    );
    result.estado_poliza = field(
      "pendiente",
      positive.source + "#rule:new-policy-status",
    );
    return;
  }
  const provenance = source + "#policy-unresolved;" + sources[1]!.source;
  result.requiere_poliza = field(null, provenance);
  result.tipo_poliza = field(null, provenance);
  result.estado_poliza = field(null, provenance);
  result.advertencias.push(
    "No explicit unambiguous policy determination in attachment or email; human review required.",
  );
}
