import type { Session, SessionStore } from "../agent/sessions.js";
import {
  leaseArgs,
  leaseCondition,
  type D1Db,
  type Lease,
} from "./d1-types.js";
export class D1SessionStore implements SessionStore {
  constructor(
    readonly db: D1Db,
    readonly lease?: Lease,
    readonly limit = 100,
  ) {}
  async get(id: string) {
    const row = await this.db
      .prepare("SELECT payload FROM sessions WHERE id=?")
      .bind(id)
      .first<{ payload: string }>();
    return row ? (JSON.parse(row.payload) as Session) : undefined;
  }
  async count() {
    return (
      (
        await this.db
          .prepare("SELECT COUNT(*) AS count FROM sessions")
          .first<{ count: number }>()
      )?.count ?? 0
    );
  }
  async set(session: Session) {
    if (this.lease && session.id !== this.lease.sessionId)
      throw new Error("Session lease identity mismatch");
    const gate = this.lease ? " AND " + leaseCondition : "";
    const insertGate = this.lease ? " AND " + leaseCondition : "";
    const result = await this.db
      .prepare(
        `INSERT INTO sessions(id,payload,updated_at) SELECT ?,?,? WHERE ((SELECT COUNT(*) FROM sessions)<? OR EXISTS(SELECT 1 FROM sessions WHERE id=?))${insertGate} ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE 1=1${gate}`,
      )
      .bind(
        session.id,
        JSON.stringify(session),
        Date.now(),
        this.limit,
        session.id,
        ...(this.lease ? leaseArgs(this.lease) : []),
        ...(this.lease ? leaseArgs(this.lease) : []),
      )
      .run();
    if (result.meta.changes !== 1)
      throw new Error(
        "Session capacity or durable lease authority unavailable",
      );
  }
  async acquire(sessionId: string, owner: string, ttlMs = 120000) {
    const result = await this.db
      .prepare(
        "INSERT INTO session_leases(session_id,owner,expires_at) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE session_leases.expires_at<=?",
      )
      .bind(sessionId, owner, Date.now() + ttlMs, Date.now())
      .run();
    return result.meta.changes === 1;
  }
  async renew(lease: Lease, ttlMs = 120000) {
    const result = await this.db
      .prepare(
        "UPDATE session_leases SET expires_at=? WHERE session_id=? AND owner=? AND expires_at>?",
      )
      .bind(Date.now() + ttlMs, ...leaseArgs(lease))
      .run();
    return result.meta.changes === 1;
  }
  async release(lease: Lease) {
    await this.db
      .prepare("DELETE FROM session_leases WHERE session_id=? AND owner=?")
      .bind(lease.sessionId, lease.owner)
      .run();
  }
  async processing(id: string) {
    const row = await this.db
      .prepare(
        "SELECT owner FROM session_leases WHERE session_id=? AND expires_at>?",
      )
      .bind(id, Date.now())
      .first();
    return row !== null;
  }
}
