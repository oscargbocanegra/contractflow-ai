import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

let runtime: Miniflare;
let intercepted = 0;
beforeAll(async () => {
  const compiled = await build({
    stdin: {
      contents: `import { OpenAiAdapter } from './src/llm/openai.ts';
export default { async fetch(request) {
  const mode = new URL(request.url).pathname.slice(1);
  try {
    const adapter = mode === 'default'
      ? new OpenAiAdapter('TEST-ONLY-NOT-A-REAL-KEY')
      : new OpenAiAdapter('TEST-ONLY-NOT-A-REAL-KEY', 'gpt-4.1', fetch);
    const result = await adapter.enviar([{role:'user',content:'Controlled runtime regression'}], [], 10);
    return Response.json({ok:true,result});
  } catch(error) { return Response.json({ok:false,error:error.message}); }
}};`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  });
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: compiled.outputFiles[0]!.text,
      compatibilityDate: "2026-10-28",
      compatibilityFlags: ["nodejs_compat"],
      // All outbound traffic is intercepted locally; never contact OpenAI.
      outboundService: async (request) => {
        intercepted++;
        expect(new URL(request.url).hostname).toBe("api.openai.com");
        return Response.json({
          choices: [{ message: { content: "LOCAL STUB", tool_calls: [] } }],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        });
      },
    }),
  );
}, 30000);
afterAll(async () => {
  await runtime?.dispose();
});
describe("actual Workers fetch receiver regression, all outbound locally mocked", () => {
  it.each(["default", "explicit"])(
    "%s ambient fetch reaches the local stub without Illegal invocation",
    async (mode) => {
      const before = intercepted;
      const response = await runtime.dispatchFetch(
        "http://runtime.test/" + mode,
      );
      expect(await response.json()).toEqual({
        ok: true,
        result: {
          content: "LOCAL STUB",
          toolCalls: [],
          usage: { inputTokens: 3, outputTokens: 2 },
        },
      });
      expect(intercepted - before).toBe(1);
    },
  );
});
