# G3 — Real integration and human authority verification

G3 implementation is complete. Live-provider execution is **pending credentials**, not simulated success.

## Verification performed

| Check | Actual result |
|---|---|
| npm run typecheck | PASS |
| npm test | PASS:44 tests,2 files (24 G2 +20 G3) |
| npm run build | PASS |
| Real local Node HTTP socket | GET /api/health200; POST /api/chat200 with provider_error for an explicitly absent key; GET /api/sessions/socket-check-session200 |
| Provider adapter HTTP contract | Controlled injected fetch verifies actual OpenAI payload/tool calls/usage parsing and timeout/error handling; not a live provider response |
| Human boundary | Forged confidence/values/provenance rejected; model confirmado=true rejected; review alone writes nothing; only subsequent explicitly bound human decision writes |
| Original fixtures |14 SHA256 hashes unchanged |
| npm audit |0 vulnerabilities |

Source normalization preceded final typecheck/tests/build. The socket check intentionally sets an empty key inside its child process: health reports configured=false, and no LLM was consumed. No public deployment has been tested or claimed.

## Integration map

- agent/prompt.md: loaded by the backend as the actual system prompt, not an embedded copy.
- src/knowledge/registro-contratos.md: process knowledge, separately loaded.
- src/llm/adapter.ts: provider-neutral enviar(messages,tools,maxOutputTokens) contract.
- src/llm/openai.ts: real HTTPS POST to OpenAI Chat Completions using server-only OPENAI_API_KEY; default gpt-4.1-mini; validated provider output; no automatic retries; AbortController timeout; store=false.
- src/agent/sessions.ts: SessionStore abstraction and bounded in-memory implementation.
- src/agent/orchestrator.ts: generated tool schemas, tool loop, independent candidate authority, explicit human confirmation and deterministic factual reply projection.
- src/http/api.ts: portable Request/Response handler for later Workers use.
- src/server.ts / src/main.ts: local loopback Node backend, environment loading and body limits.
- tests/agent.test.ts:20 adapter/orchestrator/HTTP tests.
- .env.example: non-secret backend configuration.

## Exact local commands

```text
npm ci --legacy-peer-deps
npm run dev
npm run typecheck
npm test
npm run build
```

Run from the application root. Optional .env is loaded only in the backend. Put OPENAI_API_KEY there or in the backend process environment; do not commit it. At this gate dev starts the backend only; the React UI is G4.

## API contract for G4

GET /api/health returns {ok,provider,model,configured}; configured=false honestly means no live model access.

POST /api/chat accepts {sessionId,message}; sessionId is8–100 alphanumeric/underscore/hyphen characters; message is1–8000 characters. Response includes {sessionId,reply,toolCalls,needsConfirmation,pendingReview?,tokensUsed,error?}. Tool traces contain {id,name,arguments,result}. No provider credential is returned.

GET /api/sessions/:id returns the visible conversation/tool history and pending review; excludes the system prompt and internal canonical/master bindings.

When needsConfirmation=true, pendingReview contains {id,mensajeId,fields,values}. G4 must show the fields and actual existing/null values, let the user supply missing decisions, and require an explicit confirmation button. It must not prefill invented dates or policy applicability.

The subsequent POST /api/chat must carry an explicit message beginning Confirm, Confirmo or Approve and:

```json
{
  "confirmation": {
    "pendingId": "ID returned by the preceding turn",
    "mensajeId": "msg-006",
    "values": {
      "valor": 0,
      "moneda": "COP",
      "fecha_inicio": "<actual human-provided YYYY-MM-DD>",
      "fecha_fin": "<actual human-provided YYYY-MM-DD>",
      "requiere_poliza": false
    }
  }
}
```

The above date placeholders are documentation, not valid request values or defaults. A human must decide conditional policy applicability; false here illustrates payload shape, not an instruction to choose false. Allowed editable fields are value/currency/start/end/policy-required/client/tax-ID/country/object/policy-type. Server derives policy status from the explicit policy decision. The confirmation cannot move to another session/message/candidate, cannot run in the original review turn, and is invalidated if the master changes before execution. Incomplete essential values still block even when confirmed=true.

Plain text alone does not grant authority; the UI carries this structured candidate-bound decision. This deliberately avoids asking an LLM whether a user intended legal authorization.

## Cost and abuse boundaries

Defaults:25 model iterations per turn,4000 output tokens per call,200000 cumulative billed tokens per session,1000000 cumulative tokens per backend process,100 sessions,25-second provider timeout. All configurable in backend environment within validation bounds. Input preflight uses UTF-8 serialized message/tool bytes plus1024 as a conservative token upper estimate, then reserves output room before calling. Actual prompt+completion usage accumulates after each call; returned over-budget responses do not execute tools. Failed calls reserve the bounded estimated input/output charge because billing usage is unknown. Session history caps at500 messages or400 tool traces; per-session concurrent turns are rejected.

These process-local caps do not constitute a multi-instance distributed quota. Workers deployment should persist sessions/counters or configure provider/account spend limits; process restart resets in-memory aggregate counters. No pricing estimate is claimed here; G7 must cite current official rates and label assumptions separately from measured usage.

## Grounding and audit decisions

The model interprets requests and selects real tools; extraction remains the required deterministic P0 path. It may not mutate extracted contractual candidates or forge human provenance. The server accepts only canonical tool-produced candidates for model-initiated validation/registration. A separate subsequent user path alone can amend and authorize the pending candidate.

Free-form model factual prose is not exposed as contractual truth. The reply is projected deterministically from actual tool results, and every trace is retained visibly/in session. Guard-rejected calls also receive JSONL audit entries. Internal registration revalidation uses the domain service rather than silently executing an untraced additional tool.

A review pauses the turn with an explicit question. When a reference date was supplied, a visible real alertas call runs before returning the review question. Unknown/noncontract inbox entries are deterministically classified rechazado with a reason by leer_buzon, avoiding invented quotation data.

## Official documentation checked

- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Chat Completions request contract](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [GPT-4.1 mini model](https://developers.openai.com/api/docs/models/gpt-4.1-mini)

Checked2026-10-28. Changing provider only changes the adapter; real account/model access remains unverified until credentials are supplied.

## Remaining work / rollback boundary

G4 React chat, G5 D1 adapter and authorization, G6 live-model/public URL verification and G7 final README/SOLUCION remain. Local filesystem limitations from G2 still apply. No commit has been created.

Rollback G3 by removing its llm/agent/http/server/main files, prompt/knowledge, agent tests and this evidence file, restoring the package dev script and the small inbox classification extension. Keep G2 domain/tools/demo and immutable source fixtures.