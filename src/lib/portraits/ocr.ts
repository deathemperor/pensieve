import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedCard {
  name: string | null;
  title: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
  websites: string[];
  socials: Record<string, string>;
}

export type OcrResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; raw?: string };

const SYSTEM_PROMPT = `You are a business-card OCR assistant. Given an image of a business card, extract the contact details and respond with a single JSON object matching this exact shape:

{
  "name": string | null,
  "title": string | null,
  "company": string | null,
  "emails": string[],
  "phones": string[],
  "websites": string[],
  "socials": { [platform: string]: string }
}

Respond with ONLY the JSON — no prose, no markdown fences. Use null for fields you cannot read.`;

export function parseOcrResponse(raw: string): OcrResult<ExtractedCard> {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "invalid_json", raw };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "not_object", raw };
  }
  const o = parsed as Record<string, unknown>;
  const requiredKeys = ["name", "title", "company", "emails", "phones", "websites", "socials"];
  for (const k of requiredKeys) {
    if (!(k in o)) return { ok: false, error: `missing_${k}`, raw };
  }

  return {
    ok: true,
    value: {
      name: stringOrNull(o.name),
      title: stringOrNull(o.title),
      company: stringOrNull(o.company),
      emails: stringArray(o.emails),
      phones: stringArray(o.phones),
      websites: stringArray(o.websites),
      socials: stringRecord(o.socials),
    },
  };
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}
function stringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && val.trim()) out[k] = val.trim();
  }
  return out;
}

/**
 * Create an Anthropic SDK client using either:
 *   - `sk-ant-api*` API key  → x-api-key header
 *   - `sk-ant-oat*` OAuth token (from `claude setup-token`) → Bearer header
 * Auto-detected by prefix. Caller passes whichever secret is configured.
 */
function buildClient(keyOrToken: string): Anthropic {
  const isOAuth = keyOrToken.startsWith("sk-ant-oat");
  if (isOAuth) {
    return new Anthropic({
      authToken: keyOrToken,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    });
  }
  return new Anthropic({ apiKey: keyOrToken });
}

export async function extractContactFromCard(
  apiKey: string,
  imageBytes: Uint8Array,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
): Promise<OcrResult<ExtractedCard>> {
  const client = buildClient(apiKey);
  // Chunked base64 encode — spreading a Uint8Array with >~64K elements
  // into String.fromCharCode hits V8's argument-count limit (RangeError).
  let binary = "";
  const CHUNK = 8192;
  for (let off = 0; off < imageBytes.length; off += CHUNK) {
    binary += String.fromCharCode(...imageBytes.subarray(off, off + CHUNK));
  }
  const b64 = btoa(binary);

  let text: string;
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: b64 } },
            { type: "text", text: "Extract the contact details from this business card." },
          ],
        },
      ],
    });
    const first = res.content.find((c) => c.type === "text");
    if (!first || first.type !== "text") {
      return { ok: false, error: "no_text_response" };
    }
    text = first.text;
  } catch (e) {
    return { ok: false, error: `api_error: ${e instanceof Error ? e.message : String(e)}` };
  }

  return parseOcrResponse(text);
}
