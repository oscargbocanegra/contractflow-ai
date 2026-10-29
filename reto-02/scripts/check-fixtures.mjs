import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  await readFile(path.join(root, "docs", "fixture-sha256.json"), "utf8"),
);
if (manifest.length !== 14)
  throw new Error("Expected the original 14-file manifest");
for (const entry of manifest) {
  const bytes = await readFile(path.join(root, entry.path));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error("Original fixture integrity mismatch: " + entry.path);
}
console.log("14/14 original fixture SHA256 hashes match.");
