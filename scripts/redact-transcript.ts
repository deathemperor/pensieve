export interface RedactionOptions {
  repoRoot: string;
  allowlistPrefixes: string[];
  allowlistExtensions: string[];
}

export type RawEntry =
  | { cursor: number; ts: string; kind: "prompt"; content: string }
  | { cursor: number; ts: string; kind: "assistant"; content: string }
  | {
      cursor: number;
      ts: string;
      kind: "tool";
      tool: string;
      input: unknown;
      output: unknown;
    };

const TOKEN_PATTERNS: RegExp[] = [
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bghs_[A-Za-z0-9]{20,}\b/g,
  /\bsk-[A-Za-z0-9-_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\baws_secret_access_key\s*=\s*[A-Za-z0-9/+=]+/gi,
];

const ENV_ASSIGN_PATTERN = /\b[A-Z_]*(TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL)[A-Z_]*\s*=\s*[^\s"''`]+/g;

function scrubString(s: string): string {
  let out = s;
  for (const pat of TOKEN_PATTERNS) out = out.replace(pat, "[REDACTED:token]");
  out = out.replace(ENV_ASSIGN_PATTERN, (m) => {
    const eqIdx = m.indexOf("=");
    return `${m.slice(0, eqIdx)}=[REDACTED:token]`;
  });
  return out;
}

function normalizePath(s: string, repoRoot: string): string {
  if (!repoRoot) return s;
  const escaped = repoRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return s.replace(new RegExp(escaped, "g"), "<repo>");
}

function isAllowlisted(filePath: string, opts: RedactionOptions): boolean {
  const relative = filePath.startsWith(opts.repoRoot)
    ? filePath.slice(opts.repoRoot.length).replace(/^\/+/, "")
    : filePath;
  if (opts.allowlistPrefixes.some((p) => relative.startsWith(p))) return true;
  return opts.allowlistExtensions.some((ext) => relative.endsWith(ext));
}

function redactValue(v: unknown, opts: RedactionOptions): unknown {
  if (typeof v === "string") return scrubString(normalizePath(v, opts.repoRoot));
  if (Array.isArray(v)) return v.map((item) => redactValue(item, opts));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = redactValue(val, opts);
    }
    return out;
  }
  return v;
}

export function redactEntry(entry: RawEntry, opts: RedactionOptions): RawEntry {
  if (entry.kind === "prompt" || entry.kind === "assistant") {
    return { ...entry, content: scrubString(normalizePath(entry.content, opts.repoRoot)) };
  }

  const input = entry.input as Record<string, unknown>;
  const output = entry.output as Record<string, unknown>;

  let safeOutput: unknown = redactValue(output, opts);

  const filePath =
    typeof input?.file_path === "string" ? (input.file_path as string) : undefined;
  if (filePath) {
    const absolute = filePath.startsWith("/")
      ? filePath
      : `${opts.repoRoot}/${filePath}`;
    if (!isAllowlisted(absolute, opts)) {
      if (output && typeof output === "object") {
        const cloned: Record<string, unknown> = { ...(safeOutput as Record<string, unknown>) };
        if ("content" in cloned) cloned.content = "[REDACTED:env-contents]";
        safeOutput = cloned;
      }
    }
  }

  return {
    ...entry,
    input: redactValue(input, opts),
    output: safeOutput,
  };
}

export function redactAll(entries: RawEntry[], opts: RedactionOptions): RawEntry[] {
  return entries.map((e) => redactEntry(e, opts));
}
