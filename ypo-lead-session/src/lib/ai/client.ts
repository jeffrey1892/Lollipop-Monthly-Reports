// Thin wrapper around the Anthropic SDK: structured JSON output, refusal handling, retries.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "../env";
import { SYSTEM_PROMPT } from "./prompts";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // The SDK already retries 429/5xx with exponential backoff; we raise the retry count.
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey, maxRetries: 4 });
  return client;
}

export class AiRefusalError extends Error {}

function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

/** Ask Claude for JSON matching `schema`. Throws on refusal or invalid output. */
export async function generateJson<T>(schema: z.ZodType<T>, userPrompt: string, maxTokens = 4000): Promise<T> {
  const response = await getClient().beta.messages.create({
    model: env.anthropicModel,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // The system prompt is identical for every call, so cache it.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: jsonSchemaFor(schema) },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new AiRefusalError("Claude declined to write this. Please edit the text and try again.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude's answer was cut off");
  }
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return schema.parse(JSON.parse(text));
}
