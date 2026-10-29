# G5 — Optional Cloudflare Workers / D1 adapter

G5 is implemented and verified **locally**. Remote Cloudflare authentication, a real remote D1 database, backend LLM credentials and public deployment are still pending. The PRD-required CSV/local-folder implementation remains intact and is the reference adapter; D1 is an optional hosting adapter, not a claim that the PRD required a database.

## Executed evidence

| Check | Actual result |
|---|---|
| npm run fixtures:bundle |6 original messages bundled;14 SHA256 fixture hashes verified |
| npm run db:migrate:local |0001_contractflow.sql applied;9 SQL commands succeeded; local only |
| npm run typecheck |PASS |
| npm test |PASS:55 tests /3 files, including10 actual Miniflare D1 SQLite cases |
| npm run build |PASS: backend + frontend |
| npm run worker:dry-run |PASS; DB/ASSETS/Text imports bundled; no remote deployment |
| npm run test:browser |PASS:4 actual Chrome tests retained |
| Actual local Worker page/API in Chrome |Page200; health databaseReady=true/configured=false; chat reports missing key; session history200; master CSV export200 with8 original rows; no page errors |
| Worker stopped/restarted |Prior D1 session still200,2 visible messages, token budget0, processing=false |
| npm audit |0 vulnerabilities |
| npx wrangler whoami |Not authenticated; login not attempted |
| node scripts/deploy.mjs without remote ID |Intentionally blocked before running Wrangler deployment |

Final local SQL readback after two actual no-key chat sessions:

```text
quota_budget.used = 0
durable_sessions = 2
unreleased_leases = 0
contract_state.version = 0
contracts = 8
```

No contracts were registered by those no-key HTTP checks. Their zero budget is verified, not estimated. The six-case D1 scenario runs in a separate isolated actual SQLite test database: create/create/update/duplicate/reject/human_review, then explicit human test confirmation creates msg-006;11 final master rows and4 history events. Those test inputs are not presented as extracted fixture dates.

## Architecture and preservation of the PRD

- The original local FileRepository still copies and writes CSV/JSONL/archives in out/ and never modifies fixtures.
- src/domain/csv.ts now contains portable CSV functions; the existing file adapter re-exports them for compatibility.
- scripts/bundle-fixtures.mjs verifies all14 immutable hashes and generates src/generated/fixture-bundle.ts from actual source contents, not hand-entered contract values.
- Worker imports actual agent/prompt.md and src/knowledge/registro-contratos.md as Text modules through Wrangler rules.
- Worker ASSETS serves the production React bundle in dist/web/. No local-disk persistence is claimed on Workers.
- D1 stores a versioned logical master/processed/history/archive snapshot. Safe export routes reproduce CSV, JSONL, markdown and actual text attachments.

## Atomicity, leases and quotas

### Contract state

A single contract_state row holds the entire logical transactional state. The adapter reads its version, applies deterministic operations, then performs one conditional UPDATE against that version. A concurrent change produces a typed conflict, not a blind retry or overwrite. Master, processed markers, history and archive contents therefore commit together in D1. Initial seeding uses INSERT OR IGNORE on the stable singleton key and never resets an existing master.

Audit entries and report snapshots are separate logical files/tables. An unavailable audit can report an uncertain already-committed operation; inspect state rather than retrying blindly. Session-bound report writes also require a live lease.

### Persistent session authority

D1SessionStore serializes full sessions, including pending canonical candidates, tool history, reference date and token totals. Each POST /api/chat acquires a120-second database lease with a random owner. Concurrent owners are excluded; a15-second heartbeat renews only the current unexpired owner. Release is owner-conditional. A stale owner cannot update session state, contract state or reports after takeover. Session identity must match the lease. Expired authority never silently authorizes a write.

Tests prove pending review survives a fresh orchestrator/store instance, does not register by itself, and only the later explicitly bound human turn registers. That confirmation path calls no LLM.

### Durable spending

D1BudgetAdapter reserves a bounded input/output allowance in a transactional D1 batch before invoking the real provider. The same batch atomically enforces deployment-wide and per-session caps and records a reservation ID. Actual reported usage refunds excess allowance; known missing-key failures settle to0; uncertain provider/network outcomes retain the allowance. Settlement is idempotently guarded. An ambiguous reservation/settlement outcome stops without another provider call or model-requested action.

Counters and reservations survive fresh adapters and Worker restarts. Tests use actual D1 SQL to prove global-cap enforcement across different sessions and exclusion of competing concurrent reservations. There is no public reset endpoint. These caps complement—not replace—provider/account spend controls. Input reservation uses the existing conservative UTF-8-byte bound plus overhead and configured output maximum, not a billing measurement.

## Local commands

Use Node22.12+ for the complete current Cloudflare toolchain; Node24.6.0 was actually tested. Core Node/FileRepository code remains compatible with the earlier Node20.19+ baseline, but Wrangler4.155.0 requires Node22+, so package engines now truthfully declares22.12+ for the full repository.

```text
npm ci --legacy-peer-deps
npm run fixtures:bundle
npm run build
npm run db:migrate:local
npm run worker:dev
```

Local Worker: http://127.0.0.1:8787. This is not a public URL. Local state persists in ignored .wrangler/. The normal npm run dev still runs Node API + Vite chat independently.

```text
npm run typecheck
npm test
npm run test:browser
npm run worker:dry-run
```

Wrangler telemetry is disabled in this project's config with send_metrics=false. No global settings changed. The installed Miniflare package exposes the current constructor shape; tests use its official convertV4MiniflareOptions compatibility helper instead of trusting the stale README's old direct options.

## Safe exports

GET /api/exports/maestro-contratos.csv
GET /api/exports/historial.jsonl
GET /api/exports/procesados.json
GET /api/exports/log.jsonl
GET /api/exports/alertas.md
GET /api/exports/<exact URL-encoded Contratos/... archive key>

Exports return only known logical records; no arbitrary filesystem path reads. Production access control remains a future requirement for real confidential contracts; the supplied demo fixtures are fictional and the PRD excludes multiuser authentication.

## Configuration and pending external actions

wrangler.toml deliberately contains **no fabricated database_id**. Local Wrangler resolves the DB binding without one; dry-run succeeds. The deploy script refuses to launch remote deployment until a UUID has been configured.

After the user supplies Cloudflare authorization and an LLM key, an authorized operator must:

1. Authenticate Cloudflare (wrangler login or an appropriately scoped backend environment token).
2. Create or explicitly select the real D1 database and place its confirmed database_id in wrangler.toml.
3. Apply migrations to that exact remote binding: npx wrangler d1 migrations apply DB --remote.
4. Store OPENAI_API_KEY using npx wrangler secret put OPENAI_API_KEY; never put it in frontend variables, source, logs or chat.
5. Build and run npm run deploy. Record only the actual returned public URL.
6. Verify the public page, D1 readiness, a real model tool cycle, human confirmation, session persistence, exports and no secret exposure.

No login, temporary preview account, remote creation/migration, secret installation or deployment was performed by this gate. No public URL exists to report yet. A dry run and local D1 execution are not production proof.

## Source map and rollback

- migrations/0001_contractflow.sql
- src/adapters/d1-types.ts, d1-repository.ts, d1-sessions.ts, d1-budget.ts
- src/domain/csv.ts
- src/generated/fixture-bundle.ts and scripts/bundle-fixtures.mjs
- src/config.ts, src/worker.ts, src/cloudflare.d.ts
- wrangler.toml and scripts/deploy.mjs
- tests/d1.test.ts
- docs/G5-verification.md

Generated evidence: out/g5-worker-smoke.json, out/g5-restart-check.json, out/g5-worker-local.png. These and .wrangler state are ignored, not deliverable source. Both local Worker sessions were stopped after verification.

Rollback the optional deployment adapter/config/migration/bundle/tests and restore the CSV/config imports and dependency/script changes; leave the required local implementation and original fixtures intact. No commit or native review was started by this worker. G6 credentialed/public verification and G7 final documentation remain.