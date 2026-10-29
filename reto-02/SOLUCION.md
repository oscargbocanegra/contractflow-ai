# ContractFlow AI — solution and contractual governance

**Readiness:** deterministic local implementation, real provider adapter, chat and optional D1 hosting adapter are implemented. Local tests are documented separately from live-provider and production evidence. Successful real local GPT-4.1 six-case orchestration and actual browser human confirmation are verified. Native review/GitHub delivery and a public URL remain pending; this is not a declaration that the challenge is complete.

## 1. Problem in one sentence

Administrative staff and management lack a complete, dependable contract master because contracts arrive through inconsistent channels and policy-only reporting; ContractFlow centralizes reception, traceable classification and controlled registration without turning ambiguity into fabricated contractual facts.

## 2. Architecture

```text
React chat / explicit review form
        |
        v
HTTP Request/Response API -> bounded agent orchestrator -> provider-neutral LLM adapter
                                   |
                          five typed Zod tools
                                   |
                    deterministic domain and services
                                   |
                         ContractRepository port
                     /                         \
       Local FileRepository              Optional D1Repository
       CSV + JSONL + text archive        atomic logical snapshot + exports
```

Behavior: agent/prompt.md. Process knowledge: src/knowledge/registro-contratos.md. Execution: src/tools/contratos.ts. Domain/extraction/policy/validation are independent of HTTP. A business-rule change does not require editing the server. Node loads prompt/knowledge from their files; Wrangler bundles those same files as Text modules.

The original PRD explicitly excludes a database and requires a local CSV master. Therefore the file adapter remains the reference implementation. D1 is an optional Cloudflare persistence adapter preserving logical CSV/history/archive behavior—not an assertion that the original PRD mandated a database. Workers serve built UI assets and never pretend to persist local filesystem files. The fixture bundle is generated from the immutable originals after checking14 hashes.

## 3. Agent cycle and human confirmation

The actual OpenAI adapter receives system/user/tool messages and generated tool schemas, then returns function calls. The orchestrator validates arguments, executes only named tools, appends results and repeats up to25 iterations by default. Every call is visible in the chat/session and audited. Provider timeout and failures preserve session evidence and are sanitized. Configurable session/output/global limits bound model spending; D1 makes deployment-wide reservations durable across isolates and restarts.

The model interprets the request and selects tools. It cannot mutate the canonical extracted candidate, invent human provenance, raise confidence or set confirmado=true. Contractual reply facts are projected from actual tool results rather than unverified model prose.

Low-confidence or conflicting fields create a pending candidate bound to session, message, turn and the master snapshot. The turn ends with an explicit question and highlighted form. Only a subsequent actual user confirmation with exact pending IDs and reviewed values can authorize registration. Missing essential values still block; a changed master invalidates the approval. This structured form is a deliberate, documented interaction difference from accepting the PRD's natural-language example sentence alone.

The Node adapter uses process-local session locks/counters. The optional D1 adapter persists sessions and pending review, uses expiring owner-fenced leases with renewal, atomically reserves global/session token allowance before provider calls and settles actual or uncertain usage without blind retries.

## 4. Model choice, actual usage and estimated cost

User-selected and now source-default model: OpenAI gpt-4.1. Actual local execution returned gpt-4.1-2025-04-14 and14 HTTP200 responses. Its official page still marks it deprecated: this is a lifecycle risk, not a denial of the observed success. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-4.1)

Checked2026-10-28: text rates per1M tokens are input$2.00, cached input$0.50 and output$8.00. Formula: `(uncached_input×2.00 + cached_input×0.50 + output×8.00) / 1,000,000`. [Official pricing](https://developers.openai.com/api/docs/pricing)

The live run reported86,391 input +4,472 output =90,863 tokens. Assuming **all input uncached**, the rate-based estimate is$0.208558, approximately$0.209 for the run—not an invoice. Cached-input details, taxes and hosting costs were not collected. No discount or precise charge is asserted.

**Hypothetical case illustration, not measured allocation:** cumulative8k–25k uncached input plus1k–4k output would cost$0.024–$0.082. Totals must include repeated context/tool schemas. Budget reservations are safety accounting, not billing. gpt-4.1-mini remains only an untested configurable alternative; no live mini success is claimed.

## 5. Extraction and confidence strategy

Deterministic P0 extraction reads actual attachment text, resolves parties/identifier/country, normalizes numeric currency values, parses Spanish written dates with numeric day markers, and extracts object/policy evidence. Amendments merge explicitly unchanged master fields with source provenance and update changed value/end dates. Final candidates always pass deterministic validation again before writing.

Confidence is an engineering review convention, **not a calibrated statistical probability**: explicit recognized source values use1; absent values are null/0; demand value0 is0.6; currency inferred from a conditional policy context is0.7; derived month-term end dates are0.7. Anything below0.8 or conflicting requires review.

The initial implementation incorrectly treated an absent guarantee clause as certain no-policy evidence. A neutral-email clone exposed this in an independent local audit. The correction requires an explicit unquoted, unconditional negative statement in the actual document/email before assigning false, retains that actual source, and otherwise leaves required/type/status unresolved. Positive/negative conflicts remain null/0. Quoted, conditional or negated assertions do not grant certainty. These bounded text patterns are not legal interpretation; unfamiliar phrasing goes to review.

msg-002's actual email explicitly says it does not require a policy, so it remains registrable. msg-004 contains no such explicit negative: extraction now reports unresolved policy fields, but RN1 still classifies the exact existing contract as duplicate and performs no contractual write. No new review authorization is needed to do nothing.

msg-006 has a demand-based value, a12-month term from signing and only an August2026 signature month. Its COP100000000 figure is an order-level policy threshold, not the contract total. Exact start/end and policy applicability require human input. Demo dates2026-09-01/2027-08-31 and a framework-policy=false choice are explicitly labeled human test decisions, never source extraction.

## 6. Proposed one-page contractual governance rule

**Proposal for approval—not existing company policy, not a currently operating mailbox/SLA, and not a claim that outbound mail integration is implemented.**

| Topic                     | Proposed operating rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single channel and owner  | Use a formally approved shared mailbox; `contratos@example.invalid` is only a non-routable illustration. The administrative analyst owns the master and policy follow-up; Finance/management sponsors escalation and backup coverage.                                                                                                                                                                                                                                                                                                                    |
| Commercial obligation     | Send the signed PDF, amendments and termination/closure acts within2 business days of signature. Proposed subject: `[CONTRACT] <client tax ID>                                                                                                                                                                                                                                                                                                                                                                                                           | <contract ID> | <new/amendment/termination>`. Include responsible commercial and relevant policy obligations. The target is a proposed process rule, not an observed SLA. |
| Acknowledgement           | Proposed automatic acknowledgement within15 minutes: message reference, received attachments, current classification and either registered ID/path or explicit unresolved fields. An acknowledgement is not legal approval. Current challenge code exposes results in chat; actual email delivery remains future integration.                                                                                                                                                                                                                            |
| Exceptions and escalation | Unsigned documents are held for a signed copy; unclear parties/value/dates or conditional policies are routed to the analyst for substantiated human decisions. A demand contract may use0 only under the explicit indeterminate-value convention. Identity warnings are resolved operationally without contradicting the PRD's nonblocking unknown-sender rule. Escalate unresolved commercial obligations to the commercial owner and management; obtain external legal advice when needed rather than pretending an internal legal department exists. |
| June–August gap campaign  | Run one proposed time-boxed collection campaign across all commercials, reconcile signed documents and amendments against billing/CRM and existing records, deduplicate by contract ID and tax ID/object, review exceptions, and publish a reconciled gap list. This campaign is designed, not executed by the challenge.                                                                                                                                                                                                                                |
| Monthly indicator         | `100 × invoiced contracts with a matched master record / distinct invoiced contracts in the month`. Finance supplies the denominator, the analyst reconciles exceptions, and management reviews the monthly trend and missing records. No actual percentage or achieved improvement is claimed.                                                                                                                                                                                                                                                          |

Operational authorization must designate real people and an approved mailbox before using the process with real contracts. Review decisions and subsequent changes remain auditable; rotating personnel must not silently reset the process.

## 7. Decisions and tradeoffs

| Decision                                                   | Rejected alternative and tradeoff                                                                                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic contractual rules plus LLM tool selection    | LLM-only classification/writes are more flexible but can hallucinate or self-authorize; deterministic guards reduce flexibility in exchange for auditable outcomes.                                     |
| Canonical extracted candidates and structured confirmation | Inferring approval from arbitrary model-interpreted prose is convenient but weakens authority binding. The form adds an explicit step and documents a difference from the literal sample sentence.      |
| Missing signature day remains null                         | Using the email receipt date would simplify msg-006, but invent a contractual date. Human review is necessary.                                                                                          |
| Explicit policy evidence instead of absence=false          | A permissive default makes more cases auto-register but fabricates an obligation determination. Conservative null/0 increases review for unfamiliar/ambiguous wording.                                  |
| CSV local reference plus optional D1 adapter               | Database-only delivery would violate the PRD's file behavior; purely in-memory Workers storage would lose state. Two adapters add code but preserve the source contract and hosting durability.         |
| D1 singleton CAS snapshot for this bounded exercise        | Normalized per-contract rows/object storage scale better but require more schema and transaction design. The snapshot makes master/history/archive atomic here, with documented contention/size limits. |
| Provider-neutral adapter using direct fetch                | A large agent framework adds conventions/dependencies; direct fetch keeps the real tool protocol inspectable, at the cost of maintaining a small response schema and error handling.                    |

## 8. Assumptions and interpretation

- PRD and supplied PDF instructions govern requirements; the PDF reiterates the independent app/prompt/backend/tools/demo/docs/public-link deliverables and adds no conflicting functional rule in the reviewed evidence.
- Fixtures are immutable text attachments. OCR, actual Exchange/SharePoint connectivity, legal review and historical reconstruction execution are outside the exercise.
- RN1's same-ID/value/start/end duplicate condition takes precedence over wording variations; a duplicate never updates the master merely because extracted policy data is unresolved.
- Unknown sender is a warning, not a blocker by itself. Master inheritance is explicit for amendments, not a license to invent absent document values.
- All six fixture outcomes are tested using original data. Extra unsafe-policy cases are in-memory clones, never edits to fixtures.
- Proposed governance timings, mailbox and responsibilities are proposals—not asserted company practices.
- The official challenge-start timestamp was not supplied; compliance with the120-minute official window is not certified from an invented start time.
- Local-first verification now precedes all further Cloudflare work per the user's explicit instruction.

## 9. Coverage and evidence boundaries

| Requirement                            | Status and proof                                                                                | Remaining                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| HU1 mailbox                            | Done locally; six originals, processed exclusion, quotation rejected                            | Real inbox integration intentionally out of scope                   |
| HU2 extraction                         | Done deterministic P0; provenance/confidence/nulls and policy regressions                       | General arbitrary legal-language extraction/OCR not claimed         |
| HU3 validation                         | Done; new/update/duplicate/rejected, similarity boundary, unknown sender warning                | Verified locally with real GPT-4.1; remote deployment pending       |
| HU4 registration/archive               | Done locally and actual local D1; revalidation, explicit confirmation, history, idempotency/CAS | Remote provider/environment verification pending                    |
| HU5 alerts                             | Done; three sections, explicit date and day0/day60 boundaries                                   | No measured operational reduction in risk                           |
| HU6 errors                             | Done; bad text/date/currency/tool/provider errors tested                                        | Production fault injection/operations not completed                 |
| CA1–CA5/backend/UI                     | Implemented; controlled-adapter and actual desktop-browser tests                                | Real local GPT-4.1 plus browser HITL verified; public proof pending |
| Mandatory docs                         | README/SOLUCION supplied, including this governance proposal and Codex disclosure               | Update actual commit/push/public URL only after execution           |
| Public test link                       | Pending; no deployment URL fabricated                                                           | Cloudflare explicitly LAST                                          |
| Clean-machine launch<2min              | Unmeasured                                                                                      | Fresh-machine timing required                                       |
| Tablet/mobile                          | CSS included, not executed                                                                      | Only1440x900 desktop evidence exists                                |
| Optional PDF/OCR/reusable module bonus | Not implemented                                                                                 | Not a mandatory P0 completion claim                                 |

Latest executed counts/results are in docs/LOCAL-VERIFICATION.md and sanitized real-provider evidence is in docs/LIVE-LOCAL-VERIFICATION.md. Historical gate reports are snapshots at their original time; later evidence and this correction supersede their policy-default assumptions. Local D1/Worker tests do not equal production proof, and controlled model responses do not equal a live LLM test.

## 10. Use of AI

OpenAI Codex was used as the construction assistant for source analysis, scaffold, TypeScript implementation, deterministic extraction/tools, backend/provider protocol, React UI, optional D1 adapter, tests, debugging and documentation. Fresh delegated workers/audits compressed tasks and checked evidence; the human remains responsible for scope, contractual decisions, credentials and explainability of the submitted code.

An initial AI-generated absence-of-guarantee=false implementation was discarded after the neutral-email audit demonstrated unsupported certainty. Other rejected approaches included substituting demo human dates for missing source facts, permitting model-written human provenance/confirmation, treating simulated provider success as live evidence, and inventing a deployment URL or measured cost. Tests and source checks—not an assistant's assurance—support the recorded outcomes. No AI coauthor trailer is added to commits; disclosure belongs here as required by the PRD.

## 11. Production risks and mitigation

- **Provider availability:** gpt-4.1 is live-verified locally but marked deprecated; retain evidence and re-run acceptance after any explicit model/account change.
- **Sensitive contracts and authorization:** PRD excludes authentication/roles; a real deployment needs authenticated reviewers, access control, retention/consent and data-handling review before processing confidential documents. A public demo is not that production security model.
- **Prompt injection and hallucination:** tools/documents are data, not instructions; keep canonical candidate checks, deterministic validation and independent human authority. Extend adversarial cases before broader input support.
- **Confidence quality:** rule-based scores are not calibrated probabilities; monitor review outcomes, broaden recognized patterns with real approved evidence and do not silently increase confidence to boost automation.
- **State/durability:** local files have in-process serialization and per-file atomic replacement, not distributed/all-files crash atomicity. D1 CAS avoids lost updates but the bounded singleton snapshot has size/contention limits. Normalize storage and separate larger archives before scaling.
- **Uncertain provider/DB outcomes:** reserve before spend, retain uncertain usage and inspect preserved state; never blindly repeat a possibly committed write or paid provider request.
- **Abuse/operations:** durable global/session budgets and session-count limits reduce spend, but production still needs account-level caps, request controls, monitoring and authorized cleanup/recovery procedures. No public reset exists.
- **Process adoption:** automation cannot register documents commercials never send. Approve and operate the proposed governance campaign/indicator; do not claim the campaign or business impact already happened.

**Completion gate:** real local LLM/HITL acceptance is closed by the recorded live evidence. Finish native review and actual GitHub delivery through normal hooks, and only then deploy/verify Cloudflare per the user's local-first order. Until those actual proofs exist, the challenge remains incomplete.
