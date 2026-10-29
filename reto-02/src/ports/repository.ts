import type {
  AuditEntry,
  Commercial,
  MessageDocument,
  State,
} from "../domain/contracts.js";
export interface ContractRepository {
  messages(): Promise<MessageDocument[]>;
  commercials(): Promise<Commercial[]>;
  readState(): Promise<State>;
  transaction<T>(operation: (state: State) => T | Promise<T>): Promise<T>;
  audit(entry: AuditEntry): Promise<void>;
  report(markdown: string): Promise<void>;
}
export type ToolContext = {
  directory: string;
  sessionId: string;
  repository?: ContractRepository;
  hoy?: string;
  outputDirectory?: string;
  authorization?: { mensajeId: string; candidate: string };
};
