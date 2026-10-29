import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const config = await readFile("wrangler.toml", "utf8");
if (!/^\s*database_id\s*=\s*"[0-9a-f-]{36}"\s*$/im.test(config))
  throw new Error(
    "Remote deployment blocked: configure the real D1 database_id after authorized creation.",
  );
const child = spawn(
  process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", "deploy"],
  { stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
