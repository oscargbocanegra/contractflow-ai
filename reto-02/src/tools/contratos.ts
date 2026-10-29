import { z } from "zod";
import { contractSchema, type AuditEntry } from "../domain/contracts.js";
import { ContractService } from "../services/contracts.js";
import type { ContractRepository, ToolContext } from "../ports/repository.js";
const repositories = new Map<string, ContractRepository>();
async function repository(ctx: ToolContext): Promise<ContractRepository> {
  if (ctx.repository) return ctx.repository;
  const key = ctx.directory + "|" + (ctx.outputDirectory ?? "out");
  let found = repositories.get(key);
  if (!found) {
    const { FileRepository } = await import("../adapters/file-repository.js");
    found = new FileRepository(ctx.directory, ctx.outputDirectory);
    repositories.set(key, found);
  }
  return found;
}
function tool<T extends z.ZodRawShape>(
  name: string,
  description: string,
  args: T,
  operation: (
    args: z.infer<z.ZodObject<T>>,
    service: ContractService,
    ctx: ToolContext,
  ) => Promise<unknown>,
) {
  return {
    description,
    args,
    async execute(
      input: z.infer<z.ZodObject<T>>,
      ctx: ToolContext,
    ): Promise<string> {
      let repo: ContractRepository | undefined;
      let ok = false;
      let result: unknown;
      let summary = "Tool failed";
      const raw = input as Record<string, unknown>;
      const messageId =
        typeof raw?.mensaje_id === "string" ? raw.mensaje_id : null;
      try {
        repo = await repository(ctx);
        const parsed = z.object(args).strict().safeParse(input);
        if (!parsed.success) throw parsed.error;
        const data = await operation(
          parsed.data,
          new ContractService(repo, ctx.hoy),
          ctx,
        );
        ok = true;
        summary = "Completed";
        result = { ok: true, data };
      } catch (error) {
        const issues =
          error instanceof z.ZodError
            ? error.issues.map((issue) => ({
                path: issue.path.join("."),
                code: issue.code,
                message: issue.message,
              }))
            : undefined;
        summary = issues
          ? "Invalid tool arguments: " +
            issues.map((issue) => issue.path + ": " + issue.message).join("; ")
          : error instanceof Error
            ? error.message
            : "Unexpected tool error";
        result = {
          ok: false,
          error: summary,
          ...(issues ? { code: "schema_validation_error", issues } : {}),
        };
      }
      const audit: AuditEntry = {
        ts: new Date().toISOString(),
        herramienta: name,
        mensaje_id: messageId,
        ok,
        resumen: summary,
      };
      try {
        repo ??= await repository(ctx);
        await repo.audit(audit);
      } catch {
        result = {
          ok: false,
          error:
            "Audit persistence failed; operation outcome requires inspection before retry",
        };
      }
      return JSON.stringify(result);
    },
  };
}
const messageId = z
  .string()
  .regex(/^msg-\d{3}$/)
  .describe("Mailbox message identifier from contratos_leer_buzon.");
export const leer_buzon = tool(
  "contratos_leer_buzon",
  "List unprocessed mailbox messages and whether they contain a contract.",
  {},
  async (_args, service) => service.inbox(),
);
export const extraer = tool(
  "contratos_extraer",
  "Extract contract fields with confidence and source evidence from an attachment.",
  { mensaje_id: messageId },
  async (args, service) => service.extract(args.mensaje_id),
);
export const validar = tool(
  "contratos_validar",
  "Classify a candidate against the master and list fields requiring human review without authorizing writes.",
  {
    mensaje_id: messageId,
    contrato: contractSchema.describe(
      "Candidate contract with per-field confidence and provenance.",
    ),
  },
  async (args, service) => service.validate(args.mensaje_id, args.contrato),
);
export const registrar = tool(
  "contratos_registrar",
  "Revalidate and register or update a contract only when review is resolved or explicitly human-confirmed.",
  {
    mensaje_id: messageId,
    contrato: contractSchema.describe(
      "Final contract candidate to revalidate before writing.",
    ),
    confirmado: z
      .boolean()
      .optional()
      .describe(
        "True only after explicit human confirmation of this exact candidate.",
      ),
  },
  async (args, service, ctx) => {
    if (
      ctx.authorization &&
      args.confirmado &&
      (ctx.authorization.mensajeId !== args.mensaje_id ||
        ctx.authorization.candidate !== JSON.stringify(args.contrato))
    )
      throw new Error("Human authorization does not match this candidate");
    return service.register(args.mensaje_id, args.contrato, args.confirmado);
  },
);
export const alertas = tool(
  "contratos_alertas",
  "Generate expiry, pending-policy and post-cutoff registration reports for an explicit reference date.",
  {
    hoy: z
      .string()
      .describe(
        "Reference date YYYY-MM-DD; supplied explicitly for deterministic alerts.",
      ),
  },
  async (args, service) => service.alerts(args.hoy),
);
