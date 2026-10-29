import {
  ProviderError,
  type LlmAdapter,
  type LlmMessage,
  type ToolDefinition,
} from "../llm/adapter.js";
import {
  leaseArgs,
  leaseCondition,
  type D1Db,
  type Lease,
} from "./d1-types.js";
export class D1BudgetAdapter implements LlmAdapter {
  constructor(
    readonly db: D1Db,
    readonly inner: LlmAdapter,
    readonly lease: Lease,
    readonly sessionCap = 200000,
    readonly globalCap = 1000000,
  ) {}
  private path() {
    return "$." + JSON.stringify(this.lease.sessionId);
  }
  private async reserve(amount: number) {
    const id = crypto.randomUUID();
    const path = this.path();
    let results;
    try {
      results = await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO quota_reservations(id,session_id,amount) SELECT ?,?,? FROM quota_budget WHERE id=1 AND used+?<=? AND COALESCE(json_extract(session_usage,?),0)+?<=? AND ${leaseCondition}`,
          )
          .bind(
            id,
            this.lease.sessionId,
            amount,
            amount,
            this.globalCap,
            path,
            amount,
            this.sessionCap,
            ...leaseArgs(this.lease),
          ),
        this.db
          .prepare(
            "UPDATE quota_budget SET used=used+?,session_usage=json_set(session_usage,?,COALESCE(json_extract(session_usage,?),0)+?) WHERE id=1 AND EXISTS(SELECT 1 FROM quota_reservations WHERE id=? AND applied=0)",
          )
          .bind(amount, path, path, amount, id),
        this.db
          .prepare(
            "UPDATE quota_reservations SET applied=1 WHERE id=? AND applied=0",
          )
          .bind(id),
      ]);
    } catch {
      throw new ProviderError(
        "Durable usage reservation unavailable. No model call was made; inspect quota state before retrying.",
        false,
      );
    }
    if (results[0]?.meta.changes !== 1)
      throw new ProviderError(
        "Durable token budget or session lease unavailable. No model call was made.",
        false,
      );
    return id;
  }
  private async settle(id: string, reserved: number, actual: number) {
    const refund = reserved - actual;
    const path = this.path();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE quota_budget SET used=used-?,session_usage=json_set(session_usage,?,COALESCE(json_extract(session_usage,?),0)-?) WHERE id=1 AND EXISTS(SELECT 1 FROM quota_reservations WHERE id=? AND applied=1 AND settled=0)",
        )
        .bind(refund, path, path, refund, id),
      this.db
        .prepare(
          "UPDATE quota_reservations SET settled=1,actual=? WHERE id=? AND applied=1 AND settled=0",
        )
        .bind(actual, id),
    ]);
  }
  async enviar(
    messages: LlmMessage[],
    tools: ToolDefinition[],
    maxOutputTokens: number,
  ) {
    const reserved =
      new TextEncoder().encode(JSON.stringify(messages) + JSON.stringify(tools))
        .length +
      1024 +
      maxOutputTokens;
    const id = await this.reserve(reserved);
    let result;
    try {
      result = await this.inner.enviar(messages, tools, maxOutputTokens);
    } catch (error) {
      const actual =
        error instanceof ProviderError && !error.billingUnknown ? 0 : reserved;
      try {
        await this.settle(id, reserved, actual);
      } catch {
        throw new ProviderError(
          "Usage settlement is unavailable. Inspect durable state before retrying.",
        );
      }
      throw error instanceof ProviderError
        ? error
        : new ProviderError(
            "Model provider failed; uncertain usage remains reserved.",
          );
    }
    const actual = result.usage.inputTokens + result.usage.outputTokens;
    if (actual > reserved) {
      await this.settle(id, reserved, reserved);
      throw new ProviderError(
        "Provider usage exceeded its reserved bound. Further actions are blocked pending inspection.",
      );
    }
    try {
      await this.settle(id, reserved, actual);
    } catch {
      throw new ProviderError(
        "Usage settlement is unavailable. No model-requested actions were executed; inspect durable state.",
      );
    }
    return result;
  }
}
