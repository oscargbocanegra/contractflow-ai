import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const children = [
  spawn(
    process.execPath,
    [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/main.ts"],
    { cwd: root, stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [path.join(root, "node_modules", "vite", "bin", "vite.js")],
    { cwd: root, stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 150).unref();
}
for (const child of children) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
