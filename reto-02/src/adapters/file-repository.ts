import {
  mkdir,
  readFile,
  writeFile,
  appendFile,
  rename,
} from "node:fs/promises";
import path from "node:path";
import type { ContractRepository } from "../ports/repository.js";
import type {
  AuditEntry,
  Commercial,
  MasterRow,
  MessageDocument,
  State,
} from "../domain/contracts.js";
const locks = new Map<string, Promise<void>>();
export { columns, parseCsv, serializeCsv, parseMaster } from "../domain/csv.js";
import { parseMaster, serializeCsv } from "../domain/csv.js";
async function optionalRead(file: string, fallback: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}
export class FileRepository implements ContractRepository {
  readonly root: string;
  readonly output: string;
  constructor(directory: string, outputDirectory?: string) {
    this.root = path.resolve(directory);
    const allowed = path.join(this.root, "out");
    this.output = path.resolve(outputDirectory ?? allowed);
    if (this.output !== allowed && !this.output.startsWith(allowed + path.sep))
      throw new Error("Output directory must remain inside project out/");
  }
  private target(relative: string): string {
    const target = path.resolve(this.output, relative);
    if (target !== this.output && !target.startsWith(this.output + path.sep))
      throw new Error("Unsafe output path");
    return target;
  }
  private async atomic(relative: string, text: string): Promise<void> {
    const target = this.target(relative);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = target + ".tmp";
    await writeFile(temp, text, "utf8");
    await rename(temp, target);
  }
  async messages(): Promise<MessageDocument[]> {
    const { readdir } = await import("node:fs/promises");
    const root = path.join(this.root, "fixtures", "reto-02", "buzon");
    const entries = await readdir(root, { withFileTypes: true });
    const docs: MessageDocument[] = [];
    for (const entry of entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const folder = path.join(root, entry.name);
      const correo = JSON.parse(
        await readFile(path.join(folder, "correo.json"), "utf8"),
      ) as MessageDocument["correo"];
      const archivos: Record<string, string> = {};
      for (const attachment of correo.adjuntos) {
        if (path.basename(attachment) !== attachment)
          throw new Error("Unsafe fixture attachment path");
        archivos[attachment] = await optionalRead(
          path.join(folder, attachment),
          "",
        );
      }
      docs.push({ correo, archivos });
    }
    return docs;
  }
  async commercials(): Promise<Commercial[]> {
    return JSON.parse(
      await readFile(
        path.join(this.root, "fixtures", "reto-02", "comerciales.json"),
        "utf8",
      ),
    ) as Commercial[];
  }
  private async initialize(): Promise<void> {
    const target = this.target("sharepoint/maestro-contratos.csv");
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await writeFile(
        target,
        await readFile(
          path.join(this.root, "fixtures", "reto-02", "maestro-contratos.csv"),
        ),
        { flag: "wx" },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  async readState(): Promise<State> {
    await this.initialize();
    return {
      contratos: parseMaster(
        await readFile(this.target("sharepoint/maestro-contratos.csv"), "utf8"),
      ),
      procesados: JSON.parse(
        await optionalRead(this.target("procesados.json"), "{}"),
      ) as State["procesados"],
      historial: (
        await optionalRead(this.target("sharepoint/historial.jsonl"), "")
      )
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as State["historial"][number]),
      archivos: JSON.parse(
        await optionalRead(this.target("archive-index.json"), "{}"),
      ) as Record<string, string>,
    };
  }
  async transaction<T>(
    operation: (state: State) => T | Promise<T>,
  ): Promise<T> {
    const previous = locks.get(this.output) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks.set(
      this.output,
      previous.then(() => next),
    );
    await previous;
    try {
      const state = await this.readState();
      const before = structuredClone(state);
      const result = await operation(state);
      if (JSON.stringify(state.contratos) !== JSON.stringify(before.contratos))
        await this.atomic(
          "sharepoint/maestro-contratos.csv",
          serializeCsv(state.contratos),
        );
      if (
        JSON.stringify(state.procesados) !== JSON.stringify(before.procesados)
      )
        await this.atomic(
          "procesados.json",
          JSON.stringify(state.procesados, null, 2),
        );
      if (JSON.stringify(state.historial) !== JSON.stringify(before.historial))
        await this.atomic(
          "sharepoint/historial.jsonl",
          state.historial.map((item) => JSON.stringify(item)).join("\n") + "\n",
        );
      if (JSON.stringify(state.archivos) !== JSON.stringify(before.archivos)) {
        for (const [name, text] of Object.entries(state.archivos))
          if (text !== before.archivos[name])
            await this.atomic("sharepoint/" + name, text);
        await this.atomic("archive-index.json", JSON.stringify(state.archivos));
      }
      return result;
    } finally {
      release();
    }
  }
  async audit(entry: AuditEntry): Promise<void> {
    await mkdir(this.output, { recursive: true });
    await appendFile(
      this.target("log.jsonl"),
      JSON.stringify(entry) + "\n",
      "utf8",
    );
  }
  async report(markdown: string): Promise<void> {
    await this.atomic("alertas.md", markdown);
  }
}
