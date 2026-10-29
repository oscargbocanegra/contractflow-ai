# G4 — React chat verification

G4 is complete locally. This does not establish a live LLM response or public deployment.

## Actual checks

| Check | Result |
|---|---|
| npm run typecheck | PASS, backend and frontend |
| npm test | PASS:45 tests /2 files |
| npm run build | PASS: TypeScript backend + Vite production frontend |
| npm run test:browser | PASS:4 actual headless Google Chrome tests,1440x900 |
| npm audit |0 vulnerabilities after React/Playwright installation |
| Source fixture hashes |14 files unchanged |

The four browser tests prove:
1. **Controlled HTTP fixture, explicitly not live LLM:** history, thinking/disabled-send state, visible tool name/arguments/result, missing dates and undecided policy blank, pending review survives reload, explicit human form posts exact bound fields, only session ID stored in browser.
2. **Controlled malformed API response:** fail closed with visible error and require history refresh before resubmission.
3. **Controlled hostile text:** HTML-like content is rendered as escaped text; no executable image is created.
4. **Actual local backend, no mocked API:** configuration banner honestly reports missing key; sending a message returns the actual no-key provider error; session history remains readable.

No successful live-provider response was obtained. Browser cases1–3 isolate UI behavior using test-only HTTP routing; they are not presented as successful provider integrations. Case4 executes the real API on the locally running backend without a key.

## Run commands and URLs

From the application root:

```text
npm ci --legacy-peer-deps
npm run dev
```

One command starts both backend and UI:
- Chat: http://127.0.0.1:5173
- API: http://127.0.0.1:3000/api/health

These are loopback development addresses, not public deployment URLs. Default backend PORT3000 is required by the current Vite proxy target; if changing it, update the proxy target too. `npm run dev:api` starts just the backend.

```text
npm run typecheck
npm test
npm run build
npm run test:browser
```

Browser tests default to the installed Google Chrome channel. On another machine install Chrome or install Playwright Chromium and set PLAYWRIGHT_CHANNEL=chromium. Tests start/stop their own local dev stack and deliberately supply an empty OPENAI_API_KEY; they do not consume a provider key.

## User-visible behavior

- English chat/history, labeled message input, thinking state, visible errors and token-budget counter.
- Every tool trace is retained with its exact name and expandable arguments/result JSON, rendered as text.
- Pending review is highlighted and shows only actual pending values. Null dates stay blank; unresolved policy boolean starts with an explicit choice placeholder, never false by default.
- Human form sends a subsequent explicit Confirm message with server pendingId/message ID/decisions. The server retains exclusive authority to bind and execute it.
- Policy status is displayed as derived from the user's explicit policy decision, not editable invented coverage.
- Browser localStorage retains only an unpredictable session identifier. Neither provider credentials nor source records are stored there.
- Refresh history restores pending server state after reload. Network timeout/invalid-response failures block blind retries; recovery checks processing status before enabling another send.
- No dangerouslySetInnerHTML or raw HTML rendering is used.

## Source map

- web/App.tsx: conversation, tool traces, highlighted review form and recovery states.
- web/client.ts: runtime validation of API/history/health plus timeout handling.
- web/main.tsx, web/index.html, web/styles.css, web/vite-env.d.ts: minimal React entry and accessible responsive layout.
- scripts/dev.mjs: starts backend+Vite without shell-built user commands.
- vite.config.ts: frontend root/proxy/build target.
- playwright.config.ts, tests/browser/chat.spec.ts: actual browser verification.
- src/agent/orchestrator.ts: exposes processing flag for safe recovery; missing-key budget correction.
- src/llm/adapter.ts and openai.ts: distinguish failures with known zero provider usage from uncertain billing.

Built frontend: dist/web/index.html and dist/web/assets/. The Node server currently serves the API, while Vite serves the local chat; Cloudflare Workers assets should serve dist/web in the deployment adapter. No public hosting configured by G4.

## Bugs caught by actual execution

1. **Build passed but dev page blank:** naming the client module web/api.ts made its browser URL /api.ts match Vite's /api proxy. Chrome network evidence showed a backend404. Renamed to web/client.ts. All4 browser tests then passed.
2. **Missing key displayed fictitious budget use:** the generic unknown-provider-failure reservation charged a call that never reached the network. Added an explicit zero-billing-known provider error flag and a regression test. The test first failed with18682 versus0, then passed; no-key usage now stays0. Unknown-billing network failures still reserve a conservative cap, so the label says token budget used rather than claiming precise billed tokens.

## Visual evidence and limitations

out/g4-chat-local.png is an actual desktop browser screenshot of the real missing-key state. It was visually inspected: conversation, warning, composer and tool area are readable without clipping. It is a generated QA artifact, ignored by Git.

Only1440x900 desktop browser behavior was executed in this gate. The CSS includes a small-screen layout rule, but tablet/mobile success is not claimed without running those viewports. No cosmetic work displaced P0 behavior.

## Remaining work / rollback

G5 optional D1/Workers adaptation, G6 credentials/live-provider/public URL checks and G7 final documentation remain. G3 process-local counter/session risks still apply. No commit or native review was started by this worker.

Rollback G4 by removing web/, scripts/dev.mjs, Vite/Playwright configuration/browser tests and this evidence document, restoring package/config script changes and the processing flag. The missing-key zero-usage bugfix should be retained independently because it corrects inaccurate accounting. Original fixtures and G2/G3 logic remain unchanged otherwise.