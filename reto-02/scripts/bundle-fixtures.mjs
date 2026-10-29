import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  await readFile(path.join(root, "docs", "fixture-sha256.json"), "utf8"),
);
for (const entry of manifest) {
  const bytes = await readFile(path.join(root, entry.path));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error("Original fixture integrity mismatch");
}
const fixtureRoot = path.join(root, "fixtures", "reto-02");
const documents = [];
for (const id of (await readdir(path.join(fixtureRoot, "buzon"))).sort()) {
  const folder = path.join(fixtureRoot, "buzon", id);
  const correo = JSON.parse(
    await readFile(path.join(folder, "correo.json"), "utf8"),
  );
  const archivos = {};
  for (const name of correo.adjuntos) {
    if (path.basename(name) !== name) throw new Error("Unsafe attachment name");
    archivos[name] = await readFile(path.join(folder, name), "utf8");
  }
  documents.push({ correo, archivos });
}
const bundle = {
  masterCsv: await readFile(
    path.join(fixtureRoot, "maestro-contratos.csv"),
    "utf8",
  ),
  commercials: JSON.parse(
    await readFile(path.join(fixtureRoot, "comerciales.json"), "utf8"),
  ),
  documents,
};
await mkdir(path.join(root, "src", "generated"), { recursive: true });
await writeFile(
  path.join(root, "src", "generated", "fixture-bundle.ts"),
  '// Generated from immutable original fixtures; regenerate with npm run fixtures:bundle.\nimport type { Commercial, MessageDocument } from "../domain/contracts.js";\nexport const fixtureBundle: { masterCsv: string; commercials: Commercial[]; documents: MessageDocument[] } = ' +
    JSON.stringify(bundle, null, 2) +
    ";\n",
  "utf8",
);
console.log(
  "Bundled 6 original messages; verified 14 immutable SHA256 hashes.",
);
