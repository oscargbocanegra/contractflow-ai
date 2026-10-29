import type { Contract } from "../domain/contracts.js";
import type { LlmMessage } from "../llm/adapter.js";
export type ToolTrace = {
  id: string;
  name: string;
  arguments: unknown;
  result: unknown;
};
export type PendingReview = {
  id: string;
  mensajeId: string;
  contract: Contract;
  fields: string[];
  turn: number;
  masterBinding: string;
};
export type Session = {
  id: string;
  messages: LlmMessage[];
  toolCalls: ToolTrace[];
  candidates: Record<string, Contract>;
  pending?: PendingReview;
  tokensUsed: number;
  referenceDate?: string;
  turn: number;
  busy: boolean;
  updatedAt: string;
};
export interface SessionStore {
  get(id: string): Promise<Session | undefined>;
  set(session: Session): Promise<void>;
  count(): Promise<number>;
}
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();
  async get(id: string) {
    return this.sessions.get(id);
  }
  async set(session: Session) {
    this.sessions.set(session.id, session);
  }
  async count() {
    return this.sessions.size;
  }
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
