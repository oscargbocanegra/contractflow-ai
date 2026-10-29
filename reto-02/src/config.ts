import { z } from "zod";
export const configSchema = z.object({
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9._:-]+$/)
    .default("gpt-4.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MAX_ITERATIONS: z.coerce.number().int().min(1).max(50).default(25),
  MAX_SESSION_TOKENS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(2000000)
    .default(200000),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(16000).default(4000),
  MAX_SESSIONS: z.coerce.number().int().min(1).max(1000).default(100),
  MAX_TOTAL_TOKENS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(10000000)
    .default(1000000),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(25000),
});
