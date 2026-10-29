import { useEffect, useState, type FormEvent } from "react";
import {
  decode,
  healthSchema,
  historySchema,
  requestJson,
  responseSchema,
  type Health,
  type PendingReview,
  type ToolTrace,
} from "./client.js";
type VisibleMessage = { role: string; content: string };
const storageKey = "contractflow-session-id";
function freshSession() {
  return crypto.randomUUID();
}
function storedSession() {
  try {
    const id = localStorage.getItem(storageKey);
    return id && /^[a-zA-Z0-9_-]{8,100}$/.test(id) ? id : freshSession();
  } catch {
    return freshSession();
  }
}
function ToolTraceView({ trace }: { trace: ToolTrace }) {
  const result = trace.result as { ok?: boolean; error?: unknown };
  return (
    <details className="tool-trace">
      <summary>
        <strong>{trace.name}</strong> —{" "}
        {result?.ok ? "Completed" : String(result?.error ?? "Result available")}
      </summary>
      <h4>Arguments</h4>
      <pre>{JSON.stringify(trace.arguments, null, 2)}</pre>
      <h4>Result</h4>
      <pre>{JSON.stringify(trace.result, null, 2)}</pre>
    </details>
  );
}
function ConfirmationForm({
  pending,
  disabled,
  onConfirm,
}: {
  pending: PendingReview;
  disabled: boolean;
  onConfirm: (
    values: Record<string, string | number | boolean>,
  ) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    setValues(
      Object.fromEntries(
        pending.fields.map((key) => [
          key,
          pending.values[key] === null || pending.values[key] === undefined
            ? ""
            : String(pending.values[key]),
        ]),
      ),
    );
    setError("");
  }, [pending.id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const decision: Record<string, string | number | boolean> = {};
    for (const key of pending.fields) {
      if (key === "estado_poliza") continue;
      const value = values[key] ?? "";
      if (key === "requiere_poliza") {
        if (value !== "true" && value !== "false") {
          setError("Choose whether this contract requires a policy.");
          return;
        }
        decision[key] = value === "true";
      } else if (key === "valor") {
        if (
          !value.trim() ||
          !Number.isFinite(Number(value)) ||
          Number(value) < 0
        ) {
          setError("Provide a valid non-negative contract value.");
          return;
        }
        decision[key] = Number(value);
      } else if (value.trim()) {
        decision[key] = value.trim();
      } else if (key !== "tipo_poliza") {
        setError(`Provide ${key}; no value will be invented.`);
        return;
      }
    }
    await onConfirm(decision);
  }
  return (
    <section className="review" aria-label="Human confirmation required">
      <h2>Human confirmation required</h2>
      <p>
        Message <strong>{pending.mensajeId}</strong> has unresolved or
        low-confidence fields. Nothing ambiguous is registered until you provide
        an explicit decision. Dates and policy applicability are not guessed.
      </p>
      <form onSubmit={submit}>
        {pending.fields.map((key) => (
          <label key={key}>
            {key}
            {key === "estado_poliza" ? (
              <span className="derived">
                Derived from your explicit policy decision.
              </span>
            ) : key === "requiere_poliza" ? (
              <select
                aria-label={key}
                required
                disabled={disabled}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value })
                }
              >
                <option value="">Choose explicitly…</option>
                <option value="true">Policy required</option>
                <option value="false">No policy on this contract</option>
              </select>
            ) : key === "moneda" || key === "pais" ? (
              <select
                aria-label={key}
                required
                disabled={disabled}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value })
                }
              >
                <option value="">Choose…</option>
                {(key === "moneda"
                  ? ["COP", "USD", "PEN", "PAB", "HNL"]
                  : ["CO", "EC", "PE", "PA", "HN"]
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={key}
                type={
                  key.startsWith("fecha_")
                    ? "date"
                    : key === "valor"
                      ? "number"
                      : "text"
                }
                min={key === "valor" ? 0 : undefined}
                step={key === "valor" ? "any" : undefined}
                required={key !== "tipo_poliza"}
                disabled={disabled}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value })
                }
              />
            )}
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        <p>
          Confirm only values you can substantiate. Policy obligations on
          individual service orders remain a separate follow-up.
        </p>
        <button type="submit" disabled={disabled}>
          Confirm these values and register
        </button>
      </form>
    </section>
  );
}
export default function App() {
  const [sessionId, setSessionId] = useState(storedSession);
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [traces, setTraces] = useState<ToolTrace[]>([]);
  const [pending, setPending] = useState<PendingReview>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<Health>();
  const [tokens, setTokens] = useState(0);
  useEffect(() => {
    let active = true;
    try {
      localStorage.setItem(storageKey, sessionId);
    } catch {
      /* Session remains usable without browser storage. */
    }
    setLoading(true);
    setMessages([]);
    setTraces([]);
    setPending(undefined);
    setError("");
    setRecovery(false);
    setTokens(0);
    void requestJson("/api/health")
      .then((value) => {
        if (active) setHealth(decode(healthSchema, value));
      })
      .catch(() => {
        if (active) setHealth(undefined);
      });
    void requestJson(`/api/sessions/${sessionId}`)
      .then((value) => {
        if (!active || value === null) return;
        const history = decode(historySchema, value);
        setMessages(
          history.messages
            .filter(
              (item) =>
                (item.role === "user" || item.role === "assistant") &&
                item.content !== null,
            )
            .map((item) => ({ role: item.role, content: item.content! })),
        );
        setTraces(history.toolCalls);
        setPending(history.pendingReview);
        setTokens(history.tokensUsed);
        setRecovery(!!history.processing);
      })
      .catch((failure) => {
        if (active) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to restore history",
          );
          setRecovery(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);
  async function refreshHistory() {
    setLoading(true);
    setError("");
    try {
      const value = await requestJson(`/api/sessions/${sessionId}`);
      if (value === null) {
        setRecovery(false);
        return;
      }
      const history = decode(historySchema, value);
      setMessages(
        history.messages
          .filter(
            (item) =>
              (item.role === "user" || item.role === "assistant") &&
              item.content !== null,
          )
          .map((item) => ({ role: item.role, content: item.content! })),
      );
      setTraces(history.toolCalls);
      setPending(history.pendingReview);
      setTokens(history.tokensUsed);
      setRecovery(!!history.processing);
      if (history.processing)
        setError(
          "The server is still processing this session. Refresh history again before retrying.",
        );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to restore history",
      );
      setRecovery(true);
    } finally {
      setLoading(false);
    }
  }
  async function send(
    text: string,
    confirmation?: {
      pendingId: string;
      mensajeId: string;
      values: Record<string, string | number | boolean>;
    },
  ) {
    if (busy || loading || recovery) return;
    setBusy(true);
    setError("");
    setMessages((previous) => [...previous, { role: "user", content: text }]);
    try {
      const value = await requestJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          ...(confirmation ? { confirmation } : {}),
        }),
      });
      const response = decode(responseSchema, value);
      if (response.sessionId !== sessionId)
        throw new Error(
          "The server returned a different session. Refresh history before retrying.",
        );
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: response.reply },
      ]);
      setTraces((previous) => [...previous, ...response.toolCalls]);
      setPending(response.pendingReview);
      setTokens(response.tokensUsed);
      if (response.error) setError(response.reply);
      setMessage("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to send the request. Refresh history before retrying.",
      );
      setRecovery(true);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim()) void send(message.trim());
  }
  return (
    <main>
      <header>
        <div>
          <h1>ContractFlow AI</h1>
          <p>
            Contract registration with visible tools and explicit human
            decisions.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSessionId(freshSession())}
        >
          New session
        </button>
      </header>
      <section className="status" aria-label="Service status">
        <span>
          {health
            ? `${health.provider} / ${health.model} — ${health.configured ? "configured" : "not configured: backend API key required"}`
            : "Checking backend status…"}
        </span>
        <span>Session token budget used: {tokens}</span>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void refreshHistory()}
        >
          Refresh history
        </button>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Restoring session…</p>}
      <section
        aria-label="Conversation"
        aria-live="polite"
        className="conversation"
      >
        {messages.length === 0 && !loading && (
          <p>
            No messages yet. Ask to process the mailbox with an explicit
            reference date.
          </p>
        )}
        {messages.map((item, index) => (
          <article
            className={
              item.role === "user" ? "message user" : "message assistant"
            }
            key={index}
          >
            <h3>{item.role === "user" ? "You" : "ContractFlow"}</h3>
            <pre>{item.content}</pre>
          </article>
        ))}
        {busy && <p role="status">Thinking and checking tools…</p>}
      </section>
      {pending && (
        <ConfirmationForm
          key={pending.id}
          pending={pending}
          disabled={busy || loading || recovery}
          onConfirm={(values) =>
            send("Confirm these explicit human decisions", {
              pendingId: pending.id,
              mensajeId: pending.mensajeId,
              values,
            })
          }
        />
      )}
      <form onSubmit={submit} className="composer">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          value={message}
          disabled={busy || loading || recovery}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          maxLength={8000}
          placeholder="Process the mailbox with reference date 2026-09-03…"
        />
        <div>
          <button
            type="submit"
            disabled={busy || loading || recovery || !message.trim()}
          >
            Send
          </button>
          <button
            type="button"
            disabled={busy || loading || recovery}
            onClick={() =>
              setMessage(
                "Process the contract mailbox with reference date 2026-09-03. Register clean contracts, ask me about doubtful fields, and generate alerts.",
              )
            }
          >
            Use PRD example
          </button>
        </div>
      </form>
      <section aria-label="Tool calls">
        <h2>Tool calls ({traces.length})</h2>
        {traces.length === 0 ? (
          <p>No tools called in this session.</p>
        ) : (
          traces.map((trace, index) => (
            <ToolTraceView key={`${trace.id}-${index}`} trace={trace} />
          ))
        )}
      </section>
      <footer>
        Session: {sessionId}. Only this identifier is stored in your browser.
        Provider credentials stay on the backend.
      </footer>
    </main>
  );
}
