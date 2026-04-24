export interface Candidate {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
}

export interface MatchQuery {
  emails: string[];
  phones: string[];
}

export interface MatchResult {
  id: string;
  reason: "email_exact" | "phone_match" | "name_company_fuzzy";
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/**
 * Collapse a normalized phone to its match key: digits only, with any
 * leading country-code-ish prefix trimmed to the trailing 10 digits when
 * longer than 10. Lets `+14085551212` and `(408) 555-1212` both reduce to
 * `4085551212`.
 */
function phoneMatchKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function matchCandidates(
  candidates: Candidate[],
  query: MatchQuery,
): MatchResult[] {
  const out: MatchResult[] = [];
  const qEmails = new Set(query.emails.map(normalizeEmail));
  const qPhoneKeys = new Set(
    query.phones.map((p) => phoneMatchKey(normalizePhone(p))).filter((k) => k.length > 0),
  );

  for (const c of candidates) {
    const cEmails = c.emails.map(normalizeEmail);
    if (cEmails.some((e) => qEmails.has(e))) {
      out.push({ id: c.id, reason: "email_exact" });
      continue;
    }
    const cPhoneKeys = c.phones.map((p) => phoneMatchKey(normalizePhone(p)));
    if (cPhoneKeys.some((k) => k.length > 0 && qPhoneKeys.has(k))) {
      out.push({ id: c.id, reason: "phone_match" });
      continue;
    }
  }
  return out;
}
