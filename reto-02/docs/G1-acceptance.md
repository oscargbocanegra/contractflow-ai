# G1 — Acceptance criteria and scaffold validation

Status: source review complete; implementation not started. The original PRD is authoritative. Expected fixture outcomes below are requirements and source observations, not executed test results.

## Literal business rules

The following seven rows are copied verbatim from PRD section 7.3.

| # | Rule (literal Spanish source) |
|---|---|
| RN1 | **Duplicado**: mismo `id_contrato` y mismos `valor`, `fecha_inicio`, `fecha_fin`. No se escribe nada; se reporta. |
| RN2 | **Actualización**: mismo `id_contrato` (o mismo `nit_cliente` + `objeto` con similitud ≥ 0.9) y algún campo distinto, o el documento se identifica como otrosí. Se actualiza la fila y se registra el cambio en `historial.jsonl`. |
| RN3 | **Nuevo**: no hay coincidencia. Se inserta. |
| RN4 | **Rechazado**: sin adjunto de contrato, o texto que no contiene partes ni objeto identificables. Se reporta con motivo. |
| RN5 | Campos con confianza < 0.8 → `requiere_revision`. `contratos_registrar` sin `confirmado = true` los rechaza. |
| RN6 | El fixture `maestro-contratos.csv` es de solo lectura. La primera ejecución lo copia a `out/sharepoint/`. |
| RN7 | Toda ejecución deja `out/log.jsonl` con `{ ts, herramienta, mensaje_id, ok, resumen }`. |

## Acceptance test matrix

| ID | Required evidence / planned assertion | Gate |
|---|---|---|
| RN1 / msg-004 | CT-2026-012 + COP 210000000 + 2026-05-15 / 2026-11-14 -> duplicado; master/archive/history unchanged (audit log still required). Repeat calls remain no-ops. | G2 |
| RN2 / msg-003 | CT-2026-011 -> actualizacion; value PEN 350000 -> 520000 and end 2027-05-01 -> 2027-11-01; preserve inherited original fields with master provenance; record before/after history, not a second row. Cover same NIT + object similarity >=0.9. | G2 |
| RN3 / msg-001 | New CT-2026-015; COP 265000000; 2026-08-01 / 2027-07-31; pending compliance policy. | G2 |
| RN3 / msg-002 | New CT-2026-016; USD 120000; 2026-08-15 / 2027-08-14; no_aplica policy, supported by sender email. | G2 |
| RN4 / msg-005 | Quotation, no contract attachment -> rechazado with reason; no master/archive/history write. Also reject missing identifiable parties/object. | G2 |
| RN5 / msg-006 | Demand value 0 + valor_indeterminado=true must be reviewed; unresolved date fields remain null/0 confidence; no write before an explicit authorized confirmation with sufficient field values. Merely validating or reviewing must not grant write authority. | G2/G3 |
| RN6 | Hash fixtures before/after demo/tests; initial output CSV seeded from fixture; fixtures remain byte-identical; all writes under out/. | G2 |
| RN7 | Every tool execution, including failures, emits {ts,herramienta,mensaje_id,ok,resumen} to out/log.jsonl with no secrets. | G2 |
| HU1 | leer_buzon returns six source messages initially, required summary fields and attachment truth; registered IDs excluded on replay. | G2 |
| HU2 | Every extracted field carries confidence in [0,1] and source provenance; absent text values null and confidence 0; no message-ID lookup of fabricated contract values. | G2 |
| HU3 | Return classification, requires-review list, differences; resolve senders using comerciales.json; unknown sender reported but not blocking by itself. | G2 |
| HU4 | Typed registrar revalidates final candidate; path Contratos/<start-year>/<client-slug>/<id>.<actual-extension>; JSONL history and processed marker; idempotent writes. | G2 |
| HU5 | alerts(hoy=2026-09-03): <=60-day future expiries, policy required and not vigente, registered since 2026-05-30; produce all three markdown sections. | G2 |
| HU6 | Empty text, impossible date and unsupported currency -> typed errors; subsequent message still processes. | G2 |
| Tool contract | Five exports with description,args Zod schemas (.describe per field), execute(args,{directory,sessionId}) returns serialized ok/data or ok/error, never throws; import without HTTP server. | G2 |
| Demo | Process messages in order, show first-pass review blocking then explicit confirmed registration; clean only intended output root; run twice in isolation and compare normalized outcomes. | G2 |
| CA1/CA5 | Provider adapter real calls; bounded iterations/tokens, timeout and friendly errors preserve session; no simulated LLM presented as real. | G3 |
| CA2/CA4 | Every tool call visible in returned/history UI trace with args/results; final factual values originate in tool output. | G3/G4 |
| CA3 | Pending review bound to session + candidate; agent ends with explicit question; only a subsequent explicit human confirmation authorizes its corresponding write. LLM cannot self-authorize by sending confirmado=true. | G3/G4 |
| API/UI | POST /api/chat, GET /api/sessions/:id, GET /api/health; React history/input/thinking/tool trace/confirmation state; no provider key in frontend or responses. | G3/G4/G6 |
| Deployment | Actual accessible Cloudflare URL verified by request and chat UI; live model interaction verified separately; no fake URL or production claim based solely on local tests. | G5/G6 |
| Documentation | README exact install/dev/demo/test/build/env/API/public URL; SOLUCION all 11 mandatory sections including model costs, 1-page governance, >=3 tradeoffs and explicit Codex use. | G7 |

## Fixture facts

The master has eight existing rows. All attachment files are `.txt`, not PDF; archive their real extension and never invent a PDF.

| Message | Sender / source document | Source facts / expected classification |
|---|---|---|
| msg-001 | Laura Gomez, contrato.txt | CT-2026-015; INDUSTRIAS DELTA S.A.S.; NIT 890900111 (remove DV 4); CO; CRM implementation/migration/training; COP 265000000; 2026-08-01 to 2027-07-31; compliance policy; nuevo. |
| msg-002 | Carlos Ruiz, contrato.txt | CT-2026-016; CORPORACION ANDINA DE SERVICIOS S.A.; RUC 1790012345001 (keep Ecuador RUC intact); EC; dedicated software team; USD 120000; 2026-08-15 to 2027-08-14; email explicitly says no policy; nuevo. |
| msg-003 | Carlos Ruiz, otrosi.txt | CT-2026-011; MINERA LOS ANDES S.A.C.; RUC 20512345678; PE; amendment changes end to 2027-11-01 and value to PEN 520000. Base master start 2026-05-02, object and policy terms inherited, not extracted from absent clauses. Existing policy vigente must not be falsely certified as extended; document change/extension follow-up. actualizacion. |
| msg-004 | Laura Gomez, contrato.txt | CT-2026-012; CLINICA SAN RAFAEL S.A.; NIT 890903456 (remove DV 1); CO; COP 210000000; 2026-05-15 to 2026-11-14; matches RN1 despite object wording variation; duplicado. |
| msg-005 | Andres Molina, cotizacion.txt | COT-2026-088; quotation only, explicitly no contract in email; Universidad proposal COP 192000000 is not contract data; rechazado. |
| msg-006 | Unknown jperez sender, contrato.txt | CM-2026-03; DISTRIBUIDORA CARIBE S.A.S.; NIT 800222333 (remove DV 9); CO; framework agreement, no determined total; 12 months from signature, signature only August 2026, no day; conditional compliance for individual orders >COP 100000000, not a fixed framework value. nuevo with human review. |

Known senders: lgomez -> Laura Gomez Restrepo; cruiz -> Carlos Ruiz Medina; amolina -> Andres Molina Pardo (use original accented names from JSON in software). Unknown sender is a warning only.

## Source conflicts and safe resolutions

1. **Persistence:** PRD 3.2 and 6.1 explicitly exclude a database and require the local CSV master. Keep file-backed CSV/JSONL as the reference implementation. Cloudflare Workers cannot persist local disk files; an optional D1 adapter may retain logical file snapshots/CSV export for deployment only, with the local PRD path preserved and the discrepancy documented. Do not replace the required local CSV with a database-only solution or claim D1 is mandated by PRD.
2. **msg-006 dates:** PRD's example confirms value 0 and end 2027-08-31, but the actual signature contains only a month. There is NO source day for fecha_inicio. Do not infer August 31 from email reception, or invent September 1. Extraction must return null/0 confidence and ask for the missing start date as well. PRD HU2's prohibition on inventing absent values wins over a convenient fixture shortcut. Only confirmed values may be recorded. A documented demo confirmation may explicitly supply start date and proposed end date, labeled human-provided test input, not source extraction.
3. **msg-003 inheritance:** Amendment lacks its original object/start date; combine unchanged master fields with document changes and retain provenance identifying the existing master row. A master difference intended by an explicit amendment is not automatically an ambiguous conflict, but must be shown/audited.
4. **RN1 versus RN2:** RN1's exact same ID/value/start/end duplicate rule takes precedence over wording differences in other fields for msg-004. Apply RN1 before generic changed-field RN2; an actual changed othersi must update.
5. **msg-006 guarantees:** Contract has a conditional policy threshold. Do not mistake the threshold amount for the contract value. Preserve the clause as source evidence and request clarification of applicability if a flat boolean cannot faithfully represent it.
6. **Official time:** No official test start timestamp was supplied. Do not invent elapsed official duration.

## Scaffold validation

- Repository root: D:/github-repos/contractflow-ai; application root: reto-02.
- Initial code: repository README only; PRD and all 14 fixture files exist; no package.json, TS source, tests, agent prompt or frontend yet.
- Runtime observed: Node v24.6.0, npm 11.5.1 (Node meets 20+ requirement).
- Git requires per-invocation `-c safe.directory=D:/github-repos/contractflow-ai` under the restricted execution identity; no global Git safety configuration changed.
- Parent initialized CodeGraph; `codegraph status` then failed with `unable to open database file`. Read-only filesystem inspection used as fallback. No reindex or destructive lifecycle action attempted.
- No project skill registry found. Loaded the supplied cognitive-doc-design and work-unit-commits skills directly.

## Implementation sequence (no SDD artifacts)

1. **G2:** Add minimal package/strict TS/Vitest scaffold, domain schemas + date/money/extraction/classification rules, repository port and local file adapter, five typed tools with safe wrappers/audit, deterministic isolated demo and acceptance tests. Execute six fixtures and two demos before advancing.
2. **G3:** Add provider-neutral adapter and real LLM implementation with environment-only credentials, tool schema validation, bounded loop/session token budget, candidate-bound human confirmation, backend routes; integration tests with controlled adapter plus separate live call when credentials exist.
3. **G4:** Add React chat with tool traces, errors/thinking state and explicit confirmation values; no cosmetic extras.
4. **G5:** Add optional D1 deployment adapter only after preserving local file behavior; migration and non-secret binding config; verify with local/remote D1 when authorized.
5. **G6:** Run typecheck/test/build/demo, deploy only with authorized credentials; verify health/API/chat page and real model interaction at actual public URL. Record local and production evidence separately.
6. **G7:** Complete exact README, mandatory SOLUCION/governance/model-cost disclosure, acceptance status and evidence checklist. Use conventional commits, no AI coauthor trailers, no secrets. Declare Codex assistance in SOLUCION as required.

## Rollback boundary

G1 adds only docs/G1-acceptance.md and docs/fixture-sha256.json. Removing those two generated files rolls back G1 documentation without altering original PRD or fixtures. No functional proof is claimed at this planning gate.