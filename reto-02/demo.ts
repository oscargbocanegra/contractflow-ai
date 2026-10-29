import { rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScenario } from "./src/services/demo-scenario.js";
const directory = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(directory, process.env.DEMO_OUT ?? "out");
const allowed = path.join(directory, "out");
if (output !== allowed && !output.startsWith(allowed + path.sep))
  throw new Error("Demo cleanup is confined to project out/");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const result = await runScenario({
  directory,
  sessionId: "deterministic-demo",
  hoy: "2026-09-03",
  outputDirectory: output,
});
console.table(
  result.outcomes.map((item) => ({
    ...item,
    requiere_revision: item.requiere_revision.join(", "),
  })),
);
console.log(
  "Explicit HUMAN DEMO INPUT (not extracted): start=2026-09-01, end=2027-08-31, value=0 COP, framework policy=false; individual order policies remain a follow-up.",
);
console.log(
  "Confirmed second registrar call:",
  JSON.stringify(result.confirmation),
);
console.log("Expiring <=60 days:", result.alertIds.join(", "));
await writeFile(
  path.join(output, "demo-summary.json"),
  JSON.stringify(result, null, 2),
  "utf8",
);
