# ContractFlow AI — local-first contract registration

**Locally implemented and verified; challenge not yet complete.** Real local GPT-4.1 orchestration and browser human confirmation are verified. Native review/GitHub delivery and public Cloudflare deployment remain separate gates. See [sanitized live evidence](docs/LIVE-LOCAL-VERIFICATION.md). Start with the original [PRD](PRD.md), then [solution/governance](SOLUCION.md) and [current local evidence](docs/LOCAL-VERIFICATION.md).

## Run locally

Requirements: Node22.12+ (tested24.6.0), npm, and a private backend OpenAI API key for a real conversation. The current Cloudflare tooling needs Node22+; the source stack remains TypeScript/Node/React/Zod/Vitest.

From the repository root, in PowerShell:

```powershell
cd reto-02
npm ci --legacy-peer-deps
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env privately and set OPENAI_API_KEY. Do not paste the key into chat or source.
npm run dev
```

One command starts the chat at **http://127.0.0.1:5173** and backend at **http://127.0.0.1:3000**. These are local addresses, not deployment URLs. An empty key allows the application to start but the real agent reports `configured:false` and refuses provider execution. Do not mistake that failure test for a working live-model conversation.

`npm ci --legacy-peer-deps` is the tested workaround for npm11's internal optional-peer resolver failure; it does not bypass Git hooks, application tests or type checking. Clean-machine startup under two minutes has **not** been measured.

## Environment

All variables belong to the backend .env/process environment. Never create a VITE-prefixed provider-key variable.

| Variable           | Default / purpose                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| OPENAI_API_KEY     | Empty; real model access requires a private key                                                     |
| OPENAI_MODEL       | gpt-4.1; user-selected and live-tested locally; official deprecation label remains a lifecycle risk |
| PORT               | 3000; changing it also requires updating the Vite proxy target                                      |
| MAX_ITERATIONS     | 25 model/tool iterations per turn                                                                   |
| MAX_SESSION_TOKENS | 200000 cumulative token-budget units per session                                                    |
| MAX_OUTPUT_TOKENS  | 4000 per model call                                                                                 |
| MAX_SESSIONS       | 100                                                                                                 |
| MAX_TOTAL_TOKENS   | 1000000 deployment/process aggregate budget                                                         |
| LLM_TIMEOUT_MS     | 25000                                                                                               |

Exact meanings and cost assumptions are in SOLUCION. Known missing-key failures use0 units; uncertain network billing reserves a conservative bound. .env, .dev.vars, generated state and outputs are ignored by Git.

## Chat and human decisions

Use the PRD-example button or submit the original PRD prompt with explicit reference date2026-09-03. Inspect every tool call, its arguments and result. For msg-006, supply actual reviewed values in the highlighted form; unresolved dates and policy applicability start blank. The sample contract contains only a signature month, so the software does **not** invent a signature day from the email date.

The form is the authorization mechanism. The literal PRD example sentence alone does not bypass it: a subsequent explicit user message plus exact pending/message IDs and structured values is required. Merely reviewing or validating never authorizes a write. The server rejects model self-confirmation, altered canonical candidates, stale master state and cross-session approvals.

Only the random session identifier is stored in browser localStorage. The Node adapter keeps sessions in process memory; restarting it loses conversation state, not persisted contract files. The optional D1 adapter persists sessions and pending reviews. On timeout or malformed response, refresh history before retrying—an aborted browser request does not prove that the backend did nothing.

## No-model demo and verification

```powershell
npm run typecheck
npm test
npm run build
npm run test:browser
npm run fixtures:check
$env:DEMO_OUT='out/demo-check-a'; npm run demo
$env:DEMO_OUT='out/demo-check-b'; npm run demo
Remove-Item Env:\DEMO_OUT
(Get-Content out/demo-check-a/demo-summary.json -Raw) -ceq (Get-Content out/demo-check-b/demo-summary.json -Raw)
```

The comparison must return True. `demo.ts` calls the actual tools without a model and cleans only its selected output directory. The default `npm run demo` cleans out/; do not run that default against a running Node backend. Use the isolated directories above for independent checks.

Both the no-model demo and the live operator test use explicitly labeled human decisions; the demo's second msg-006 registration supplies **explicit human test inputs**, not extracted facts: start2026-09-01, end2027-08-31, value0 COP, framework-policy=false. Real reviewers must supply their own substantiated decision.

Browser tests use installed Chrome by default. Alternatively install Playwright Chromium and set PLAYWRIGHT_CHANNEL=chromium. Cases1–3 explicitly control HTTP fixtures; case4 runs the actual local missing-key API. Only desktop1440x900 was executed; mobile/tablet success is not claimed.

## Real local provider smoke — before Cloudflare

The independent live verification succeeded with returned model gpt-4.1-2025-04-14:14 HTTP200 provider calls,90,863 reported tokens and a subsequent real browser confirmation without another model call. The source/default example now matches the tested gpt-4.1 configuration. No credential is stored in source. For a later explicitly authorized repeat, privately configure the backend and start it:

```powershell
npm run verify:live
```

This sends a real local request, records actual returned tools/results in ignored out/live-smoke.json and fails if the backend is unconfigured or the turn has no successful tool cycle. It does not simulate provider success. It is only a smoke check: complete the six-case conversation and human form in the UI, inspect resulting records and alerts, and retain that evidence before considering Cloudflare. Existing processed messages are intentionally excluded; use a deliberately prepared fresh local output before the full acceptance run, with the backend stopped during any cleanup.

## API

| Method | Route             | Contract                                                                                                |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------- |
| GET    | /api/health       | {ok,provider,model,configured}; Worker adds persistence/databaseReady                                   |
| POST   | /api/chat         | {sessionId,message,confirmation?} -> reply,toolCalls,needsConfirmation,pendingReview?,tokensUsed,error? |
| GET    | /api/sessions/:id | Visible history/tools/pending review; no system prompt or credential                                    |

sessionId:8–100 alphanumeric/underscore/hyphen characters. message:1–8000 characters. JSON request body <=65536 bytes. Cross-origin browser requests are denied. Authentication/multiuser roles are outside the PRD; do not use this public-demo design for real confidential contracts.

A confirmation request uses the same session and the prior pending IDs:

```json
{
  "sessionId": "existing-session-id",
  "message": "Confirm these explicit human decisions",
  "confirmation": {
    "pendingId": "exact-prior-pending-id",
    "mensajeId": "msg-006",
    "values": {
      "valor": 0,
      "moneda": "COP",
      "fecha_inicio": "<human-reviewed YYYY-MM-DD>",
      "fecha_fin": "<human-reviewed YYYY-MM-DD>",
      "requiere_poliza": false
    }
  }
}
```

Placeholders are documentation, not valid defaults. `false` illustrates payload shape, not a prescribed policy decision. The server derives policy status from the explicit decision. Missing essential fields still block confirmed writes.

## Output storage

Local reference: out/sharepoint/maestro-contratos.csv, Contratos/<year>/<client-slug>/<id>.txt, historial.jsonl; out/procesados.json, out/log.jsonl and out/alertas.md. Original attachments are text, not fabricated PDFs.

Optional Worker exports: GET /api/exports/maestro-contratos.csv, historial.jsonl, procesados.json, log.jsonl, alertas.md or an exact URL-encoded Contratos/... archive key. These are logical D1 exports—not Workers disk files. The Node API currently has no export HTTP routes; inspect its local files directly.

## Cloudflare — LAST, after local acceptance

Local preparation already has evidence, but no remote database or public URL exists.

```powershell
npm run build
npm run db:migrate:local
npm run worker:dry-run
npm run worker:dev
```

Local Worker: http://127.0.0.1:8787. D1 migration and actual local Worker checks do not prove remote deployment. Do not repeat Cloudflare work before closing local real-provider acceptance.

For later authorized deployment: authenticate Cloudflare; create/select a real D1 database; place its confirmed database_id in wrangler.toml; apply `npx wrangler d1 migrations apply DB --remote`; install the backend key with `npx wrangler secret put OPENAI_API_KEY`; build; then `npm run deploy`. The script blocks a missing database ID. Verify the actual returned public page/API, real provider, human decision and D1 persistence before recording a public URL.

**Public test URL: pending—not deployed.** No fabricated URL or access password is supplied.

## Documentation and delivery

- SOLUCION.md: required11 sections, proposed one-page governance, model costs, tradeoffs and Codex disclosure.
- docs/G1-acceptance.md: literal RN1–RN7 and source criteria.
- docs/G2-verification.md through docs/G5-verification.md: historical gate snapshots.
- docs/LOCAL-VERIFICATION.md: latest authoritative local checks and remaining gaps.

The supplied instruction PDF was reviewed for alignment with the PRD; it was not copied into this repository. Commits/push are parent-owned delivery steps; no AI coauthor trailers or secret-bearing files should be committed. GitHub delivery and all completion claims require actual commit/push verification.
