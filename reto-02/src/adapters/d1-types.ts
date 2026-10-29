export type SqlValue = string | number | null;
export type SqlResult<T = Record<string, unknown>> = {
  success: boolean;
  results: T[];
  meta: { changes: number };
};
export interface PreparedStatement {
  bind(...values: SqlValue[]): PreparedStatement;
  run(): Promise<SqlResult>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
}
export interface D1Db {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<SqlResult[]>;
}
export type Lease = { sessionId: string; owner: string };
export const leaseCondition =
  "EXISTS (SELECT 1 FROM session_leases WHERE session_id=? AND owner=? AND expires_at>?)";
export function leaseArgs(lease: Lease): SqlValue[] {
  return [lease.sessionId, lease.owner, Date.now()];
}
