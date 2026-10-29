import { z } from "zod";
import {
  contractSchema,
  field,
  type Contract,
  type FieldKey,
  type Validation,
} from "../domain/contracts.js";
import type { ContractRepository, ToolContext } from "../ports/repository.js";
import {
  ProviderError,
  type LlmAdapter,
  type ToolCall,
  type ToolDefinition,
} from "../llm/adapter.js";
import * as tools from "../tools/contratos.js";
import { ContractService } from "../services/contracts.js";
import { validDate } from "../domain/contracts.js";
import {
  canonical,
  type PendingReview,
  type Session,
  type SessionStore,
  type ToolTrace,
} from "./sessions.js";
const registry = {
  contratos_leer_buzon: tools.leer_buzon,
  contratos_extraer: tools.extraer,
  contratos_validar: tools.validar,
  contratos_registrar: tools.registrar,
  contratos_alertas: tools.alertas,
};
export const toolDefinitions: ToolDefinition[] = Object.entries(registry).map(
  ([name, tool]) => ({
    name,
    description: tool.description,
    parameters: z.toJSONSchema(z.object(tool.args).strict()) as Record<
      string,
      unknown
    >,
  }),
);
export const confirmationValuesSchema = z
  .object({
    id_contrato: z.string().min(1).optional(),
    valor: z.number().nonnegative().optional(),
    moneda: z.enum(["COP", "USD", "PEN", "PAB", "HNL"]).optional(),
    fecha_inicio: z.string().optional(),
    fecha_fin: z.string().optional(),
    requiere_poliza: z.boolean().optional(),
    cliente: z.string().optional(),
    nit_cliente: z.string().optional(),
    pais: z.enum(["CO", "EC", "PE", "PA", "HN"]).optional(),
    objeto: z.string().max(200).optional(),
    tipo_poliza: z.string().optional(),
  })
  .strict();
export const chatRequestSchema = z
  .object({
    sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),
    message: z.string().trim().min(1).max(8000),
    confirmation: z
      .object({
        pendingId: z.string(),
        mensajeId: z.string(),
        values: confirmationValuesSchema,
      })
      .strict()
      .optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = {
  sessionId: string;
  reply: string;
  toolCalls: ToolTrace[];
  needsConfirmation: boolean;
  pendingReview?: {
    id: string;
    mensajeId: string;
    fields: string[];
    values: Record<string, unknown>;
  };
  tokensUsed: number;
  error?: string;
};
export type AgentOptions = {
  directory: string;
  prompt: string;
  knowledge: string;
  repository: ContractRepository;
  adapter: LlmAdapter;
  sessions: SessionStore;
  maxIterations?: number;
  maxSessionTokens?: number;
  maxOutputTokens?: number;
  maxSessions?: number;
  maxTotalTokens?: number;
};
function parsedResult(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : { ok: false, error: "Invalid tool result" };
}
function argsObject(call: ToolCall): Record<string, unknown> {
  const parsed: unknown = JSON.parse(call.arguments);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Arguments must be an object");
  return parsed as Record<string, unknown>;
}
export class AgentOrchestrator {
  private readonly active = new Set<string>();
  private totalTokensUsed = 0;
  constructor(readonly options: AgentOptions) {}
  private async session(id: string): Promise<Session> {
    let session = await this.options.sessions.get(id);
    if (!session) {
      if (
        (await this.options.sessions.count()) >=
        (this.options.maxSessions ?? 100)
      )
        throw new Error("Session capacity reached");
      session = {
        id,
        messages: [
          {
            role: "system",
            content:
              this.options.prompt +
              "\n\nProcess knowledge:\n" +
              this.options.knowledge,
          },
        ],
        toolCalls: [],
        candidates: {},
        tokensUsed: 0,
        turn: 0,
        busy: false,
        updatedAt: new Date().toISOString(),
      };
      await this.options.sessions.set(session);
    }
    return session;
  }
  async history(id: string) {
    const session = await this.options.sessions.get(id);
    if (!session) return null;
    return {
      sessionId: id,
      processing: this.active.has(id),
      messages: session.messages.filter((item) => item.role !== "system"),
      toolCalls: session.toolCalls,
      tokensUsed: session.tokensUsed,
      needsConfirmation: !!session.pending,
      pendingReview: this.publicPending(session.pending),
    };
  }
  private publicPending(pending?: PendingReview) {
    if (!pending) return undefined;
    return {
      id: pending.id,
      mensajeId: pending.mensajeId,
      fields: pending.fields,
      values: Object.fromEntries(
        pending.fields.map((key) => [
          key,
          (pending.contract[key as FieldKey] as { valor: unknown } | undefined)
            ?.valor ?? null,
        ]),
      ),
    };
  }
  private response(
    session: Session,
    traces: ToolTrace[],
    fallback: string,
    error?: string,
  ): ChatResponse {
    const summaries = traces.map((trace) => {
      const result = trace.result as {
        ok?: boolean;
        error?: string;
        data?: Record<string, unknown>;
      };
      if (!result.ok) return `${trace.name}: ${result.error ?? "Tool failed"}`;
      const data = result.data ?? {};
      const message =
        (trace.arguments as { mensaje_id?: string })?.mensaje_id ?? "";
      if (typeof data.clasificacion === "string")
        return `${message}: ${data.clasificacion}${Array.isArray(data.requiere_revision) && data.requiere_revision.length ? " — human review required" : ""}`;
      if (typeof data.accion === "string")
        return `${message}: ${data.accion} ${String(data.id_contrato ?? "")}`;
      if (Array.isArray(data.vencen))
        return `Expiry alerts: ${data.vencen.map((row) => String((row as { id_contrato: string }).id_contrato)).join(", ") || "none"}; pending policies: ${Array.isArray(data.polizas_pendientes) ? data.polizas_pendientes.length : 0}.`;
      if (Array.isArray(data.mensajes))
        return `Mailbox: ${data.mensajes.length} unprocessed messages. ${data.mensajes
          .filter(
            (row) =>
              (row as { clasificacion?: string }).clasificacion === "rechazado",
          )
          .map(
            (row) =>
              String((row as { id: string }).id) +
              ": rechazado (no contract attachment)",
          )
          .join("; ")}`;
      return `${trace.name}: completed.`;
    });
    let reply = summaries.length
      ? `Tool-backed results:\n${summaries.join("\n")}\n\n${fallback}`
      : fallback;
    if (session.pending)
      reply += `\n\nHuman confirmation required for ${session.pending.mensajeId}: ${session.pending.fields.join(", ")}. Please provide the missing values. Do you explicitly confirm this exact candidate? No ambiguous contract has been registered.`;
    session.messages.push({ role: "assistant", content: reply });
    return {
      sessionId: session.id,
      reply,
      toolCalls: traces,
      needsConfirmation: !!session.pending,
      pendingReview: this.publicPending(session.pending),
      tokensUsed: session.tokensUsed,
      ...(error ? { error } : {}),
    };
  }
  private async trace(
    session: Session,
    call: ToolCall,
    args: unknown,
    result: Record<string, unknown>,
    traces: ToolTrace[],
    guarded = false,
  ) {
    const trace = { id: call.id, name: call.name, arguments: args, result };
    session.toolCalls.push(trace);
    traces.push(trace);
    session.messages.push({
      role: "tool",
      toolCallId: call.id,
      content: JSON.stringify(result),
    });
    if (guarded)
      await this.options.repository.audit({
        ts: new Date().toISOString(),
        herramienta: call.name,
        mensaje_id:
          typeof (args as { mensaje_id?: unknown })?.mensaje_id === "string"
            ? String((args as { mensaje_id: string }).mensaje_id)
            : null,
        ok: false,
        resumen: "Orchestrator rejected unauthorized or invalid tool call",
      });
  }
  private async dispatch(
    call: ToolCall,
    args: Record<string, unknown>,
    session: Session,
    ctx: ToolContext,
  ): Promise<string> {
    const name = call.name;
    if (name === "contratos_extraer") {
      const input = z.object(tools.extraer.args).strict().parse(args);
      const result = await tools.extraer.execute(input, ctx);
      const value = parsedResult(result);
      if (value.ok) {
        session.candidates[input.mensaje_id] = contractSchema.parse(value.data);
        if (session.pending?.mensajeId === input.mensaje_id)
          session.pending = undefined;
      }
      return result;
    }
    if (name === "contratos_validar" || name === "contratos_registrar") {
      const schema =
        name === "contratos_validar"
          ? z.object(tools.validar.args).strict()
          : z.object(tools.registrar.args).strict();
      const input = schema.parse(args);
      const candidate = session.candidates[input.mensaje_id];
      if (!candidate || canonical(candidate) !== canonical(input.contrato))
        throw new Error(
          "Only unchanged tool-produced candidates are accepted; request human edits through confirmation.",
        );
      if (name === "contratos_registrar" && args.confirmado === true)
        throw new Error("The model cannot authorize human confirmation.");
      const result =
        name === "contratos_validar"
          ? await tools.validar.execute(
              { mensaje_id: input.mensaje_id, contrato: candidate },
              ctx,
            )
          : await tools.registrar.execute(
              {
                mensaje_id: input.mensaje_id,
                contrato: candidate,
                confirmado: false,
              },
              ctx,
            );
      let validation: Validation | undefined;
      if (name === "contratos_validar") {
        const parsed = parsedResult(result);
        if (parsed.ok) validation = parsed.data as Validation;
      } else {
        validation = await new ContractService(
          this.options.repository,
          ctx.hoy,
        ).validate(input.mensaje_id, candidate);
      }
      if (
        validation?.requiere_revision.length &&
        validation.clasificacion !== "duplicado" &&
        validation.clasificacion !== "rechazado"
      )
        session.pending = {
          id: crypto.randomUUID(),
          mensajeId: input.mensaje_id,
          contract: structuredClone(candidate),
          fields: validation.requiere_revision,
          turn: session.turn,
          masterBinding: canonical(
            (await this.options.repository.readState()).contratos,
          ),
        };
      return result;
    }
    if (name === "contratos_leer_buzon")
      return tools.leer_buzon.execute(
        z.object(tools.leer_buzon.args).strict().parse(args),
        ctx,
      );
    if (name === "contratos_alertas")
      return tools.alertas.execute(
        z.object(tools.alertas.args).strict().parse(args),
        ctx,
      );
    throw new Error("Unknown tool");
  }
  private async confirm(
    request: ChatRequest,
    session: Session,
    ctx: ToolContext,
    traces: ToolTrace[],
  ): Promise<ChatResponse> {
    const pending = session.pending;
    const approval = request.confirmation;
    if (!pending || pending.turn >= session.turn)
      return this.response(
        session,
        traces,
        "No previous pending review exists for this session.",
        "confirmation_missing",
      );
    if (!/^\s*(confirmo|confirm|approve)\b/i.test(request.message))
      return this.response(
        session,
        traces,
        "An explicit human confirmation message is required.",
        "confirmation_required",
      );
    if (
      !approval ||
      approval.pendingId !== pending.id ||
      approval.mensajeId !== pending.mensajeId
    )
      return this.response(
        session,
        traces,
        "Confirmation must identify the exact pending candidate.",
        "confirmation_mismatch",
      );
    if (
      canonical((await this.options.repository.readState()).contratos) !==
      pending.masterBinding
    ) {
      session.pending = undefined;
      return this.response(
        session,
        traces,
        "The master changed after this review. Extract and review a new candidate.",
        "stale_confirmation",
      );
    }
    const candidate = structuredClone(pending.contract);
    for (const [key, value] of Object.entries(approval.values)) {
      const fieldKey = key as FieldKey;
      Object.assign(
        candidate[fieldKey],
        field(value, `human:${session.id}:${pending.id}`),
      );
    }
    if (approval.values.requiere_poliza !== undefined) {
      candidate.estado_poliza = field(
        approval.values.requiere_poliza ? "pendiente" : "no_aplica",
        `human:${session.id}:${pending.id}:policy-rule`,
      );
      if (!approval.values.requiere_poliza)
        candidate.tipo_poliza = field(
          "",
          `human:${session.id}:${pending.id}:policy-rule`,
        );
    }
    const call = {
      id: crypto.randomUUID(),
      name: "contratos_registrar",
      arguments: JSON.stringify({
        mensaje_id: pending.mensajeId,
        contrato: candidate,
        confirmado: true,
      }),
    };
    const args = argsObject(call);
    session.messages.push({
      role: "assistant",
      content: null,
      toolCalls: [call],
    });
    const result = parsedResult(
      await tools.registrar.execute(
        {
          mensaje_id: pending.mensajeId,
          contrato: candidate,
          confirmado: true,
        },
        {
          ...ctx,
          authorization: {
            mensajeId: pending.mensajeId,
            candidate: JSON.stringify(candidate),
          },
        },
      ),
    );
    await this.trace(session, call, args, result, traces);
    if (result.ok) {
      session.candidates[pending.mensajeId] = candidate;
      session.pending = undefined;
      return this.response(
        session,
        traces,
        "The explicitly confirmed candidate was processed.",
      );
    }
    return this.response(
      session,
      traces,
      "Confirmation was not applied. Supply all missing essential values.",
    );
  }
  async chat(input: ChatRequest): Promise<ChatResponse> {
    const request = chatRequestSchema.parse(input);
    if (this.active.has(request.sessionId))
      throw new Error("Session already has an active request");
    this.active.add(request.sessionId);
    let session: Session | undefined;
    const traces: ToolTrace[] = [];
    try {
      session = await this.session(request.sessionId);
      if (session.messages.length >= 500 || session.toolCalls.length >= 400)
        throw new Error("Session history capacity reached");
      session.turn++;
      session.messages.push({ role: "user", content: request.message });
      session.updatedAt = new Date().toISOString();
      const suppliedDate = request.message.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
      if (suppliedDate && validDate(suppliedDate))
        session.referenceDate = suppliedDate;
      const ctx: ToolContext = {
        directory: this.options.directory,
        sessionId: session.id,
        repository: this.options.repository,
        hoy: session.referenceDate ?? new Date().toISOString().slice(0, 10),
      };
      if (request.confirmation)
        return await this.confirm(request, session, ctx, traces);
      if (session.pending)
        return this.response(
          session,
          traces,
          "A pending candidate still needs your explicit values and confirmation; no new write was authorized.",
        );
      const cap = this.options.maxSessionTokens ?? 200000;
      const globalCap = this.options.maxTotalTokens ?? 1000000;
      for (
        let iteration = 0;
        iteration < (this.options.maxIterations ?? 25);
        iteration++
      ) {
        const inputUpperBound =
          new TextEncoder().encode(
            JSON.stringify(session.messages) + JSON.stringify(toolDefinitions),
          ).length + 1024;
        const remaining = Math.min(
          cap - session.tokensUsed,
          globalCap - this.totalTokensUsed,
        );
        const outputLimit = Math.min(
          this.options.maxOutputTokens ?? 4000,
          remaining - inputUpperBound,
        );
        if (outputLimit < 1)
          return this.response(
            session,
            traces,
            "Token budget reached. Completed actions are shown above; no further model call was made.",
            "token_budget",
          );
        let answer;
        try {
          answer = await this.options.adapter.enviar(
            session.messages,
            toolDefinitions,
            outputLimit,
          );
        } catch (error) {
          const reserved =
            error instanceof ProviderError && !error.billingUnknown
              ? 0
              : inputUpperBound + outputLimit;
          session.tokensUsed += reserved;
          this.totalTokensUsed += reserved;
          return this.response(
            session,
            traces,
            error instanceof ProviderError
              ? error.message
              : "Model provider failed. The session is preserved; retry later.",
            "provider_error",
          );
        }
        const used = answer.usage.inputTokens + answer.usage.outputTokens;
        session.tokensUsed += used;
        this.totalTokensUsed += used;
        if (session.tokensUsed > cap || this.totalTokensUsed > globalCap)
          return this.response(
            session,
            traces,
            "Token budget exhausted. Model-requested actions were not executed.",
            "token_budget",
          );
        if (answer.toolCalls.length === 0)
          return this.response(
            session,
            traces,
            traces.length
              ? "Processing finished for this turn."
              : "No contractual facts were returned by tools. Ask me to process the mailbox or request alerts with a reference date.",
          );
        if (answer.toolCalls.length > 16)
          return this.response(
            session,
            traces,
            "Provider returned too many tool calls. No actions from this response were executed.",
            "tool_call_limit",
          );
        session.messages.push({
          role: "assistant",
          content: null,
          toolCalls: answer.toolCalls,
        });
        for (const call of answer.toolCalls) {
          let args: Record<string, unknown> = {};
          let result: Record<string, unknown>;
          let guarded = false;
          try {
            args = argsObject(call);
            if (session.pending)
              throw new Error(
                "Human review is pending; later actions from this response are cancelled.",
              );
            result = parsedResult(
              await this.dispatch(call, args, session, ctx),
            );
          } catch (error) {
            guarded = true;
            result = {
              ok: false,
              ...(error instanceof z.ZodError
                ? {
                    code: "schema_validation_error",
                    issues: error.issues.map((issue) => ({
                      path: issue.path.join("."),
                      code: issue.code,
                      message: issue.message,
                    })),
                  }
                : {}),
              error:
                error instanceof z.ZodError
                  ? "Invalid tool arguments"
                  : error instanceof SyntaxError
                    ? "Tool arguments are not valid JSON"
                    : error instanceof Error
                      ? error.message
                      : "Tool execution failed",
            };
          }
          await this.trace(session, call, args, result, traces, guarded);
        }
        if (session.pending) {
          if (session.referenceDate) {
            const reportCall = {
              id: crypto.randomUUID(),
              name: "contratos_alertas",
              arguments: JSON.stringify({ hoy: session.referenceDate }),
            };
            session.messages.push({
              role: "assistant",
              content: null,
              toolCalls: [reportCall],
            });
            await this.trace(
              session,
              reportCall,
              { hoy: session.referenceDate },
              parsedResult(
                await tools.alertas.execute(
                  { hoy: session.referenceDate },
                  ctx,
                ),
              ),
              traces,
            );
          }
          return this.response(
            session,
            traces,
            "Processing paused for an explicit human decision.",
          );
        }
      }
      return this.response(
        session,
        traces,
        "Iteration limit reached. Completed actions are shown above; ask to continue the remaining work.",
        "iteration_limit",
      );
    } finally {
      try {
        if (session) await this.options.sessions.set(session);
      } finally {
        this.active.delete(request.sessionId);
      }
    }
  }
}
