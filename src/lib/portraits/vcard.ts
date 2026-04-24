export interface VCardContact {
  full_name: string;
  title: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
}

export function parseVCard(input: string): VCardContact[] {
  const contacts: VCardContact[] = [];
  // Normalize line folding: a line starting with space/tab continues the previous line.
  const normalized = input.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const blocks = normalized.split(/BEGIN:VCARD/i).slice(1);

  for (const block of blocks) {
    const end = block.search(/END:VCARD/i);
    if (end === -1) continue;
    const body = block.slice(0, end);

    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    let full_name: string | null = null;
    let title: string | null = null;
    let company: string | null = null;
    const emails: string[] = [];
    const phones: string[] = [];

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const rawKey = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1).trim();
      const key = rawKey.split(";")[0].toUpperCase();

      if (!value) continue;

      if (key === "FN" && !full_name) full_name = value;
      else if (key === "TITLE" && !title) title = value;
      else if (key === "ORG" && !company) {
        // ORG may include ; separators — take the first segment
        company = value.split(";")[0] || value;
      }
      else if (key === "EMAIL") emails.push(value);
      else if (key === "TEL") phones.push(value);
    }

    if (full_name) {
      contacts.push({ full_name, title, company, emails, phones });
    }
  }

  return contacts;
}
