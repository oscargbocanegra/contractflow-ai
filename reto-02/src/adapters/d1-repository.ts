import type { ContractRepository } from "../ports/repository.js";
import type {
  AuditEntry,
  Commercial,
  MessageDocument,
  State,
} from "../domain/contracts.js";
import { parseMaster, serializeCsv } from "../domain/csv.js";
import {
  leaseArgs,
  leaseCondition,
  type D1Db,
  type Lease,
} from "./d1-types.js";
export type FixtureBundle = {
  masterCsv: string;
  commercials: Commercial[];
  documents: MessageDocument[];
};
export class D1Repository implements ContractRepository {
  constructor(
    readonly db: D1Db,
    readonly bundle: FixtureBundle,
    readonly lease?: Lease,
  ) {}
  async messages() {
    return structuredClone(this.bundle.documents);
  }
  async commercials() {
    return structuredClone(this.bundle.commercials);
  }
  private async snapshot() {
    const initial: State = {
      contratos: parseMaster(this.bundle.masterCsv),
      procesados: {},
      historial: [],
      archivos: {},
    };
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO contract_state(id,version,payload) VALUES(1,0,?)",
      )
      .bind(JSON.stringify(initial))
      .run();
    const row = await this.db
      .prepare("SELECT version,payload FROM contract_state WHERE id=1")
      .first<{ version: number; payload: string }>();
    if (!row) throw new Error("Contract state unavailable");
    return row;
  }
  async readState() {
    return JSON.parse((await this.snapshot()).payload) as State;
  }
  async transaction<T>(
    operation: (state: State) => T | Promise<T>,
  ): Promise<T> {
    const snapshot = await this.snapshot();
    const state = JSON.parse(snapshot.payload) as State;
    const result = await operation(state);
    const payload = JSON.stringify(state);
    if (payload !== snapshot.payload) {
      const condition = this.lease ? " AND " + leaseCondition : "";
      const statement = this.db
        .prepare(
          "UPDATE contract_state SET payload=?,version=version+1 WHERE id=1 AND version=?" +
            condition,
        )
        .bind(
          payload,
          snapshot.version,
          ...(this.lease ? leaseArgs(this.lease) : []),
        );
      const write = await statement.run();
      if (write.meta.changes !== 1)
        throw new Error(
          "Contract state conflict or expired session authority; inspect current state before retrying",
        );
    }
    return result;
  }
  async audit(entry: AuditEntry) {
    await this.db
      .prepare("INSERT INTO audit_log(payload) VALUES(?)")
      .bind(JSON.stringify(entry))
      .run();
  }
  async report(markdown: string) {
    const gate = this.lease ? " WHERE " + leaseCondition : " WHERE 1=1";
    const result = await this.db
      .prepare(
        "INSERT INTO reports(path,content) SELECT ?,?" +
          gate +
          " ON CONFLICT(path) DO UPDATE SET content=excluded.content",
      )
      .bind(
        "alertas.md",
        markdown,
        ...(this.lease ? leaseArgs(this.lease) : []),
      )
      .run();
    if (result.meta.changes !== 1)
      throw new Error("Report write rejected by expired session authority");
  }
  async exported(
    name: string,
  ): Promise<{ content: string; type: string } | null> {
    const state = await this.readState();
    if (name === "maestro-contratos.csv")
      return {
        content: serializeCsv(state.contratos),
        type: "text/csv; charset=utf-8",
      };
    if (name === "historial.jsonl")
      return {
        content: state.historial.map((row) => JSON.stringify(row)).join("\n"),
        type: "application/x-ndjson",
      };
    if (name === "procesados.json")
      return {
        content: JSON.stringify(state.procesados, null, 2),
        type: "application/json",
      };
    if (name === "log.jsonl") {
      const rows = await this.db
        .prepare("SELECT payload FROM audit_log ORDER BY id")
        .all<{ payload: string }>();
      return {
        content: rows.results.map((row) => row.payload).join("\n"),
        type: "application/x-ndjson",
      };
    }
    if (name === "alertas.md") {
      const row = await this.db
        .prepare("SELECT content FROM reports WHERE path=?")
        .bind(name)
        .first<{ content: string }>();
      return row
        ? { content: row.content, type: "text/markdown; charset=utf-8" }
        : null;
    }
    if (
      name.startsWith("Contratos/") &&
      !name.split("/").includes("..") &&
      Object.hasOwn(state.archivos, name)
    )
      return {
        content: state.archivos[name]!,
        type: "text/plain; charset=utf-8",
      };
    return null;
  }
}
