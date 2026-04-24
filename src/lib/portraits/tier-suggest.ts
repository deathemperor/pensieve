import Anthropic from "@anthropic-ai/sdk";
import type { TierCode } from "./types";

export type TierSuggestion =
  | { ok: true; tier: TierCode; reason: string }
  | { ok: false; error: string };

const SYSTEM = `You assign a prestige tier to a business contact based on their public profile. Respond with a single JSON object: {"tier":"S"|"A"|"B"|"C"|"D","reason":"one sentence"}.

Tier guide:
- S: billionaire founder / head-of-state-level / globally iconic CEO
- A: C-suite at public or unicorn company / top-tier VC
- B: director / partner / notable operator
- C: senior IC / promising builder
- D: general / unclassified

Respond with ONLY the JSON.`;

export async function suggestTier(
  apiKey: string,
  input: { full_name: string; title?: string; company?: string; bio?: string },
): Promise<TierSuggestion> {
  const client = new Anthropic({ apiKey });
  const profile = [
    `Name: ${input.full_name}`,
    input.title ? `Title: ${input.title}` : null,
    input.company ? `Company: ${input.company}` : null,
    input.bio ? `Bio: ${input.bio}` : null,
  ].filter(Boolean).join("\n");

  let text: string;
  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: profile }],
    });
    const first = res.content.find((c) => c.type === "text");
    if (!first || first.type !== "text") return { ok: false, error: "no_text_response" };
    text = first.text;
  } catch (e) {
    return { ok: false, error: `api_error: ${e instanceof Error ? e.message : String(e)}` };
  }

  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); }
  catch { return { ok: false, error: "invalid_json", }; }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "not_object" };
  const o = parsed as { tier?: string; reason?: string };
  if (!["S", "A", "B", "C", "D"].includes(o.tier ?? "")) return { ok: false, error: "bad_tier" };
  if (typeof o.reason !== "string") return { ok: false, error: "bad_reason" };
  return { ok: true, tier: o.tier as TierCode, reason: o.reason };
}
