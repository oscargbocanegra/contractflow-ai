# Latest local verification — policy evidence correction

**Local-first status:** the independent audit's unsupported no-policy inference is corrected and mandatory README/SOLUCION are supplied. A successful real local GPT-4.1 six-case conversation and actual browser human confirmation are now verified in [LIVE-LOCAL-VERIFICATION.md](LIVE-LOCAL-VERIFICATION.md). Cloudflare remains LAST; no remote/public success or completed challenge is declared.

## Alignment and corrected audit finding

The original PRD was read completely. The independent audit also reviewed the supplied two-page instruction PDF and found no conflicting functional rule: it reiterates source, prompt, tools, backend/chat, no-model demo, documentation and public-link requirements. The PDF itself and its private local path were not copied into this repository.

Audit reproduction: a neutral-email clone of msg-002, without a guarantee clause, had registered after falsely inferring requiere_poliza=false/confidence1. The targeted regression suite ran first and produced5 failures/1 pass. After correction all6 policy regressions pass, and the complete61-test suite passes.

The corrected extractor:

- Requires explicit unquoted, unconditional negative document/email evidence before assigning a certain false and records that actual source.
- Leaves required/type/status null/confidence0 when evidence is absent or conflicting; unconfirmed registration is blocked.
- Does not convert quoted, conditional or negated assertions into permission to register no-policy.
- Retains msg-002's actual explicit email evidence.
- Does not invent explicit negative evidence for msg-004: it has none. Its policy fields remain unresolved, but RN1 still reports duplicate and performs no contractual write.

## Fresh executed checks after normalization

| Check                                              | Actual result                       | Boundary                                                                                  |
| -------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| npm run typecheck                                  | PASS                                | Strict backend/frontend TypeScript                                                        |
| npm test                                           | 61/61 PASS,4 files                  | Includes10 actual local Miniflare SQLite cases and6 new policy regressions; no live model |
| npm run build                                      | PASS                                | Backend + production frontend; dependency annotation warnings are nonblocking             |
| npm run test:browser                               | 4/4 PASS                            | Actual Chrome1440x900; controlled-success fixtures separate from actual missing-key API   |
| DEMO_OUT=out/local-final-a npm run demo            | PASS                                | Actual tools, independent output, no LLM                                                  |
| DEMO_OUT=out/local-final-b npm run demo            | PASS                                | Second independent output, no LLM                                                         |
| Compare both demo-summary.json files               | Byte-identical                      | Summaries exclude timestamps by construction                                              |
| npm run fixtures:check before/after demos          | 14/14 hashes match                  | No original fixture changes                                                               |
| npm audit                                          | 0 vulnerabilities                   | Dependency advisory snapshot, not a universal security guarantee                          |
| verify:live against actual empty-key local backend | Expected exit1, no provider request | Correctly refuses to manufacture successful live evidence                                 |
| node --check for both new verifier scripts         | PASS                                | Syntax only; complete successful real-provider proof is recorded separately               |

No Cloudflare login, CLI deployment, remote resource creation, commit or push was performed by this writer during this correction/documentation pass. Parent-owned delivery gates remain separate.

## Six original fixture results

| Message | Classification | Review fields                                                        | First action                                 |
| ------- | -------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| msg-001 | nuevo          | None                                                                 | create, pending policy                       |
| msg-002 | nuevo          | None                                                                 | create, no_aplica from actual explicit email |
| msg-003 | actualizacion  | None                                                                 | update CT-2026-011, value/end with history   |
| msg-004 | duplicado      | Unresolved policy required/type/status, informational for this no-op | duplicate, no contractual write              |
| msg-005 | rechazado      | None                                                                 | reject, no contractual write                 |
| msg-006 | nuevo          | valor,moneda,fecha_inicio,fecha_fin,requiere_poliza,estado_poliza    | human_review, no write                       |

The demo then registers msg-006 only after explicitly labeled human test inputs: start2026-09-01, end2027-08-31, value0COP and framework-policy=false. Those are not extracted facts or prescriptions for a real review. Actual expiry alerts for reference2026-09-03 are CT-2026-004 and CT-2026-009.

## New/updated deliverables

- README.md: exact local install/start/test/demo/API/confirmation/export instructions, real-live smoke and Cloudflare-LAST boundary.
- SOLUCION.md: all11 required sections; proposed one-page governance, current official model rates, assumptions and Codex disclosure.
- src/domain/policy.ts plus extraction call site: actual policy evidence and uncertainty.
- tests/policy.test.ts: failing-then-passing in-memory variants; originals unchanged.
- scripts/check-fixtures.mjs: read-only14-file integrity check.
- scripts/verify-live.mjs: local-only actual HTTP smoke; refuses unconfigured backend; records real response evidence only after a request completes.
- Repository root README and .gitignore: useful entry links and .codegraph exclusion.

The verified exact zero-byte generated reto-02/20.19.0 artifact was removed; no original source or fixture was removed. Runtime/dependency/state directories and .env remain excluded. The original instruction PDF was not copied or published.

## Current live evidence and remaining gates

Real local GPT-4.1 returned snapshot gpt-4.1-2025-04-14 across14 HTTP200 calls, reporting86,391 input and4,472 output tokens. Before human approval:10 rows,3 history events,no msg-006 record,15 visible tool traces. The actual Chrome form showed blank unresolved dates/policy; the later explicitly labeled HUMAN TEST decision produced11 rows,4 history events and16 traces while provider requests stayed14. All14 fixture hashes remained unchanged. See the complete sanitized report.

Remaining: parent-owned native review/commit/actual GitHub push; Cloudflare authorization/remote D1/public deployment only LAST; clean-machine launch<2min and tablet/mobile checks remain unmeasured. GPT-4.1's official deprecation label is a lifecycle risk despite the successful observed run. Source defaults now match the user-selected tested model; no secret file was read, printed or copied by the documentation worker.

No official test-start timestamp was provided, so official120-minute compliance is not claimed from an assumed clock origin. Historical G1–G5 reports retain their original-time facts; this report and the corrected source supersede prior absence-based policy assumptions.
