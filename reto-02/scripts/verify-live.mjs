import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const base = new URL(process.env.LOCAL_BASE_URL ?? "http://127.0.0.1:3000");
if (
  base.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
  base.username ||
  base.password ||
  base.pathname !== "/"
)
  throw new Error(
    "Live verification is restricted to a local backend root URL",
  );
try {
  const healthResponse = await fetch(new URL("/api/health", base), {
    signal: AbortSignal.timeout(5000),
  });
  const health = await healthResponse.json();
  if (!healthResponse.ok || health.configured !== true) {
    console.error(
      "Live verification blocked: configure the local backend provider key privately; no model request was sent.",
    );
    process.exitCode = 1;
  } else {
    const sessionId = "live-" + randomUUID();
    const response = await fetch(new URL("/api/chat", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        sessionId,
        message:
          "Procesa el buzón de contratos con fecha de hoy 2026-09-03. Registra lo que esté limpio, muéstrame lo que requiere revisión campo por campo y termina con el reporte de alertas. No registres nada dudoso sin preguntarme.",
      }),
    });
    const result = await response.json();
    await mkdir("out", { recursive: true });
    await writeFile(
      "out/live-smoke.json",
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          sessionId,
          httpStatus: response.status,
          result,
        },
        null,
        2,
      ),
    );
    console.log("Session:", sessionId);
    console.log(
      "Tool calls:",
      Array.isArray(result.toolCalls)
        ? result.toolCalls.map((call) => call.name).join(", ")
        : "none",
    );
    console.log(
      "Reply:",
      typeof result.reply === "string" ? result.reply : "No valid chat reply",
    );
    console.log(
      "Evidence saved to ignored out/live-smoke.json. This is a smoke check, not proof of all six cases or completed human confirmation.",
    );
    if (
      !response.ok ||
      result.error ||
      !Array.isArray(result.toolCalls) ||
      !result.toolCalls.some((call) => call?.result?.ok === true)
    )
      process.exitCode = 1;
  }
} catch {
  console.error(
    "Live verification could not complete. Start the local backend, inspect preserved session history and do not retry ambiguous writes blindly.",
  );
  process.exitCode = 1;
}
