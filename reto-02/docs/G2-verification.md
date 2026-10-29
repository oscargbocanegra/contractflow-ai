# G2 — Deterministic tool verification

G2 complete locally. This is not evidence of a live LLM, frontend, D1 or public deployment.

## Executed checks

| Command / check | Actual result |
|---|---|
| npm run typecheck | PASS, strict TypeScript, noEmit |
| npm test | PASS, 24 tests / 1 file, Vitest 4.1.12 |
| npm run build | PASS, TypeScript compilation |
| DEMO_OUT=out/demo-run-a npm run demo | PASS, actual tool calls, no LLM |
| DEMO_OUT=out/demo-run-b npm run demo | PASS, independent output directory |
| Compare both demo-summary.json files | Identical, including classifications/review lists/actions; timestamps excluded from summary by construction |
| Verify SHA256 manifest | All 14 original fixture files match, zero mutations |
| npm audit | 0 vulnerabilities after Vitest patch update |

## Six-case actual outcomes

| Message | Classification | First action | Second action |
|---|---|---|---|
| msg-001 | nuevo | create, pendiente compliance policy | Not needed |
| msg-002 | nuevo | create, no_aplica policy | Not needed |
| msg-003 | actualizacion | update existing CT-2026-011: PEN520000 / end2027-11-01 | Not needed |
| msg-004 | duplicado | duplicate, no master/history/archive/processed writes | Not needed |
| msg-005 | rechazado | reject, no master/history/archive/processed writes | Not needed |
| msg-006 | nuevo | human_review, no write | create after explicit labeled human demo input |

msg-006 requires review of valor, moneda, fecha_inicio, fecha_fin, requiere_poliza and estado_poliza. Its unknown sender is a warning, not a blocker. Value0 is the demand-value convention, never the COP100000000 policy threshold. Exact signature day is absent, so extraction leaves start/end null with confidence0.

The second demo registrar call supplies explicitly simulated human decisions: start2026-09-01, end2027-08-31, value0 COP, framework policy=false with individual order policy obligations retained as follow-up. These are **human test inputs, not extracted source facts**. The unconfirmed call and confirmed-but-incomplete call both fail before writing.

Actual expiry report for hoy2026-09-03 lists CT-2026-004 and CT-2026-009. Boundary tests separately prove inclusion day0/day60 and exclusion expired/day61.

## Implementation map

- src/domain/contracts.ts: Zod domain schema, field confidence/provenance, typed master/state and normalization/similarity/date checks.
- src/domain/extract.ts: source-text deterministic extraction and explicit master inheritance for amendments.
- src/domain/validate.ts: RN1-RN5 classification, source-aware review flags, differences and rejection.
- src/ports/repository.ts: browser-compatible repository boundary and tool context.
- src/adapters/file-repository.ts: original CSV copy, CSV parser/serializer, local archive/history/processed/audit/report files, in-process serialization and atomic per-file replacement.
- src/services/contracts.ts: final revalidation, idempotent registration, AUTO IDs and alerts.
- src/tools/contratos.ts: five exact typed tool exports, internal Zod argument validation, JSON envelopes, never-throw execution wrappers and audit.
- src/services/demo-scenario.ts: importable actual-tool scenario plus explicitly human-labeled confirmation input.
- demo.ts: confined cleanup, deterministic scenario, printed six-case outcomes and saved normalized summary.
- tests/contracts.test.ts: 24 acceptance/boundary cases.

## Dependencies and environment

Observed runtime: Node24.6.0/npm11.5.1. Project minimum is Node20.19.0, required by pinned Vite7.3.7. Vitest4.1.12 supports Node20; Vitest5 was discarded because its runtime requires Node22+.

Zod4 validates both tool inputs and contract candidates. TypeScript is strict; tsx runs the demo; Vitest provides the tests; Vite is pinned for compatible test/frontend tooling; Prettier normalizes source before verification. No CSV dependency was added: the local adapter includes a small quoted-field parser with a round-trip test.

Exact installation on this npm11 environment: `npm ci --legacy-peer-deps`. Ordinary install hit npm's internal `Cannot read properties of null (reading edgesOut)` resolver error. This flag changes dependency-peer resolution only; it does not skip application typechecks/tests/build. Final npm audit reports zero vulnerabilities. A transient Vitest5 native-binding workaround was removed with the version correction; no Windows-only direct dependency remains.

## Remaining boundaries / risks

- G3 real provider adapter/orchestrator, G4 chat UI, G5 D1, G6 public deployment and G7 final documents are not implemented by this gate.
- Tools imported directly assume a trusted caller for confirmado=true. The forthcoming orchestrator MUST withhold untrusted model confirmation and bind a subsequent human decision to the exact session/candidate; optional ctx.authorization mismatch already fails closed.
- FileRepository serializes mutations within one Node process and replaces individual files atomically. It does not promise a cross-process distributed lock or an all-files transaction across power loss; production-grade D1 should use its own transactional/concurrency mechanism.
- Unknown commercial is retained as its sender email on confirmed registration, with the unresolved identity warning preserved in extraction.
- Existing policy vigente on an amendment is inherited state, not certification of extended insurer coverage; warning explicitly calls for extension.
- Duplicate/rejected source messages remain visible as unprocessed, honoring RN1's no-write requirement; repeated classification is safe.
- No official test-start timestamp was supplied; do not claim official elapsed duration.

## Rollback boundary

Remove only the G2-created package/config/lockfile, demo.ts, src/, tests/ and docs/G2-verification.md to roll back this implementation. Keep original PRD.md, fixtures/, G1 docs and the root README. Generated node_modules/, dist/ and out/ are ignored and not deliverables. No commit has been created.