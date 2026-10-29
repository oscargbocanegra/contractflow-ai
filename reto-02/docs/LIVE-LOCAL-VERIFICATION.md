# Real local GPT-4.1 verification — sanitized durable evidence

**Verified after the user's explicit authorization to send the fictional fixtures and required context to OpenAI.** This is local API/provider/browser evidence, not a public deployment claim. No credential value, private source-document path or environment-file content is included.

## Provider observations

| Item                                   | Actual evidence                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Requested / returned model             | gpt-4.1 / gpt-4.1-2025-04-14                                                 |
| Endpoint                               | https://api.openai.com/v1/chat/completions                                   |
| Provider requests                      | 14, all HTTP200; no retry/second processing turn                             |
| Reported input / output / total tokens | 86,391 /4,472 /90,863                                                        |
| Iteration/session/global caps used     | 25 /200,000 /250,000                                                         |
| Provider timeout                       | 25 seconds                                                                   |
| Verification interval                  | 2026-10-28 19:12:20–19:12:55 Bogotá UTC−05; not the official challenge clock |
| Browser                                | Actual headless Google Chrome,1440x900                                       |
| Fixture integrity                      | 14/14 original hashes unchanged                                              |

These are provider-reported token totals, not error reservations. Actual cached-input billing details were not recorded. At listed GPT-4.1 rates, treating every input token as uncached yields$0.208558 (about$0.209) for this run; this is a rate-based upper noncached estimate, not an invoice, measured charge or per-case cost allocation. See SOLUCION for source citations and assumptions.

## Six real fixture outcomes

| Message | Observed classification/action                                         |
| ------- | ---------------------------------------------------------------------- |
| msg-001 | nuevo/create CT-2026-015, pending policy                               |
| msg-002 | nuevo/create CT-2026-016, no_aplica                                    |
| msg-003 | actualizacion/update existing CT-2026-011, with history                |
| msg-004 | duplicado/no registration/archive/history write                        |
| msg-005 | rechazado/no contractual write; actual inbox output supplies rejection |
| msg-006 | nuevo/human review; no write before later explicit approval            |

Before human confirmation the isolated local master had10 rows,3 history events and no CM-2026-03. Fourteen model-selected tool calls plus the visible deterministic alert call produced15 traces. Expiry alerts identified CT-2026-004 and CT-2026-009.

## Real browser human decision

The built React UI loaded that same actual session and displayed15 traces, configured GPT-4.1 status and the highlighted review form. Missing dates and the undecided policy choice were blank, not invented.

The operator-test then explicitly supplied **HUMAN TEST inputs**, not extracted source facts: value0COP, start2026-09-01, end2027-08-31, framework-policy=false. The actual form sent a subsequent structured candidate-bound decision to the actual API. Registrar created CM-2026-03; final state was11 master rows,4 history events and16 visible traces. Provider requests remained14 before and after approval, proving this confirmation path used no additional LLM call. Conditional policy obligations on individual orders remain a follow-up.

## Evidence boundary

An isolated ignored harness imported the actual FileRepository, OpenAiAdapter, AgentOrchestrator, MemorySessionStore and createApi, loaded the actual prompt/knowledge and privately configured environment through the standard loader, and exposed local HTTP/static assets. Chrome used the real API session/form; no successful response routing or fake adapter was injected. Screenshots before/after were rendered and visually inspected. Browser/server were stopped afterward.

Original sanitized QA records and screenshots remain ignored under out/live-gpt41-20261028/. This durable report records their observed results without copying credentials or personal filesystem paths. The parent owns the final secret scan and native delivery gates.

No public Cloudflare URL, remote D1 verification, clean-machine startup timing or mobile/tablet success follows from this local result. Historical no-key/controlled tests remain separate evidence. Current source defaults are synchronized to tested gpt-4.1; no live repeat is claimed for that mechanical default/doc alignment.
