import { useEffect, useState } from "react";

interface ExtractedCard {
  name: string | null;
  title: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
  websites: string[];
  socials: Record<string, string>;
}

interface CardResponse {
  card: {
    id: string;
    ocr_status: "pending" | "parsing" | "parsed" | "failed";
    extracted: ExtractedCard | null;
    error: string | null;
  };
}

interface MatchResponse {
  matches: Array<{ id: string; full_name: string; company: string | null; reason: string }>;
}

export default function CardStatusPoller({ cardId }: { cardId: string }) {
  const [status, setStatus] = useState<"pending" | "parsing" | "parsed" | "failed">("pending");
  const [extracted, setExtracted] = useState<ExtractedCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResponse["matches"]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch(`/api/portraits/cards/${cardId}`);
      if (!res.ok) { setError(`status ${res.status}`); return; }
      const data = (await res.json()) as CardResponse;
      if (cancelled) return;
      setStatus(data.card.ocr_status);
      if (data.card.ocr_status === "parsed" && data.card.extracted) {
        setExtracted(data.card.extracted);
        const email = data.card.extracted.emails[0];
        const phone = data.card.extracted.phones[0];
        const q = new URLSearchParams();
        if (email) q.set("email", email);
        if (phone) q.set("phone", phone);
        if (Array.from(q).length > 0) {
          const m = await fetch(`/api/portraits/cards/${cardId}/matches?${q}`);
          if (m.ok) {
            const mData = (await m.json()) as MatchResponse;
            setMatches(mData.matches);
          }
        }
        return;
      }
      if (data.card.ocr_status === "failed") {
        setError(data.card.error ?? "unknown_error");
        return;
      }
      setTimeout(poll, 1500);
    }
    poll();
    return () => { cancelled = true; };
  }, [cardId]);

  async function attachTo(contactId: string) {
    const res = await fetch(`/api/portraits/cards/${cardId}/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId }),
    });
    if (res.ok) window.location.href = `/room-of-requirement/portraits/${contactId}`;
  }

  async function createNew() {
    if (!extracted) return;
    const payload = {
      create: {
        full_name: extracted.name ?? "Unknown",
        title: extracted.title ?? undefined,
        company: extracted.company ?? undefined,
        prestige_tier: "C",
        channels: [
          ...extracted.emails.map((v, i) => ({ kind: "email" as const, value: v, is_primary: i === 0 })),
          ...extracted.phones.map((v) => ({ kind: "phone" as const, value: v, is_primary: false })),
        ],
      },
    };
    const res = await fetch(`/api/portraits/cards/${cardId}/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const { contact_id } = (await res.json()) as { contact_id: string };
      window.location.href = `/room-of-requirement/portraits/${contact_id}`;
    }
  }

  if (error) return (
    <div className="poller err">
      OCR failed: {error} —{" "}
      <button onClick={async () => {
        const r = await fetch(`/api/portraits/cards/${cardId}/parse`, { method: "POST" });
        if (r.ok) window.location.reload();
      }}>retry</button>
    </div>
  );

  if (status !== "parsed" || !extracted) {
    return <div className="poller loading">Reading card… ({status})</div>;
  }

  return (
    <div className="poller parsed">
      <h3>Extracted</h3>
      <dl>
        <dt>Name</dt><dd>{extracted.name ?? "—"}</dd>
        <dt>Title</dt><dd>{extracted.title ?? "—"}</dd>
        <dt>Company</dt><dd>{extracted.company ?? "—"}</dd>
        <dt>Emails</dt><dd>{extracted.emails.join(", ") || "—"}</dd>
        <dt>Phones</dt><dd>{extracted.phones.join(", ") || "—"}</dd>
      </dl>
      {matches.length > 0 && (
        <div className="matches">
          <h4>Possible matches</h4>
          <ul>
            {matches.map((m) => (
              <li key={m.id}>
                {m.full_name} — {m.company ?? "—"} <span className="reason">({m.reason})</span>
                <button onClick={() => attachTo(m.id)}>attach</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={createNew} className="primary">Create new contact</button>
    </div>
  );
}
