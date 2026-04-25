import { useEffect, useState } from "react";

interface EndpointSummary {
	id: string;
	url: string;
	events: string[];
	active: boolean;
	created_at: string;
	last_dispatched_at: string | null;
	last_status: number | null;
	last_error: string | null;
}

const API_BASE = "/api/weasley-clock/webhooks";
const ALL_EVENTS = ["booking.created", "booking.cancelled", "booking.rescheduled"];

export default function WebhooksPage() {
	const [endpoints, setEndpoints] = useState<EndpointSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [newSecretShown, setNewSecretShown] = useState<{ id: string; secret: string } | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [url, setUrl] = useState("");
	const [events, setEvents] = useState<string[]>(["booking.created"]);

	async function refresh() {
		setLoading(true);
		const res = await fetch(API_BASE, { method: "GET" });
		const data = await res.json();
		setEndpoints(data.endpoints ?? []);
		setLoading(false);
	}

	useEffect(() => { refresh(); }, []);

	async function create() {
		const res = await fetch(API_BASE, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url, events }),
		});
		const data = await res.json();
		if (data.id && data.secret) {
			setNewSecretShown({ id: data.id, secret: data.secret });
			setShowForm(false);
			setUrl("");
			setEvents(["booking.created"]);
			refresh();
		} else {
			alert("Failed: " + JSON.stringify(data));
		}
	}

	async function toggleActive(ep: EndpointSummary) {
		await fetch(`${API_BASE}/${ep.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ active: !ep.active }),
		});
		refresh();
	}

	async function rotateSecret(ep: EndpointSummary) {
		if (!confirm("Rotate secret for this endpoint? The current secret will stop working immediately.")) return;
		const res = await fetch(`${API_BASE}/${ep.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ rotate_secret: true }),
		});
		const data = await res.json();
		if (data.secret) {
			setNewSecretShown({ id: ep.id, secret: data.secret });
		} else {
			alert("Failed: " + JSON.stringify(data));
		}
	}

	async function deleteEndpoint(ep: EndpointSummary) {
		if (!confirm("Delete this webhook endpoint? This is permanent.")) return;
		await fetch(`${API_BASE}/${ep.id}`, { method: "DELETE" });
		refresh();
	}

	function toggleEvent(event: string, checked: boolean) {
		setEvents(checked ? Array.from(new Set([...events, event])) : events.filter((e) => e !== event));
	}

	if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

	return (
		<div style={{ padding: 20, maxWidth: 900 }}>
			<h1>Webhook Endpoints</h1>
			{newSecretShown && (
				<div style={{ padding: 12, background: "#1a2a1f", border: "1px solid #4a9961", borderRadius: 4, marginBottom: 16, color: "#c4e8cc" }}>
					<strong>Save this signing secret now — it will not be shown again:</strong>
					<div style={{ fontSize: 11, color: "#8b9914", marginTop: 4 }}>Endpoint: {newSecretShown.id}</div>
					<pre style={{ background: "#040a06", padding: 10, marginTop: 8, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{newSecretShown.secret}</pre>
					<button type="button" onClick={() => setNewSecretShown(null)}>Dismiss</button>
				</div>
			)}
			{!showForm && (
				<button type="button" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>+ New webhook endpoint</button>
			)}
			{showForm && (
				<div style={{ padding: 12, border: "1px solid #2a1f15", marginBottom: 16 }}>
					<label style={{ display: "block", marginBottom: 8 }}>
						<div>URL</div>
						<input
							type="text"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://example.com/webhook"
							style={{ width: "100%" }}
						/>
					</label>
					<label style={{ display: "block", marginBottom: 8 }}>
						<div>Events</div>
						<div>
							{ALL_EVENTS.map((ev) => (
								<label key={ev} style={{ display: "block" }}>
									<input
										type="checkbox"
										checked={events.includes(ev)}
										onChange={(e) => toggleEvent(ev, e.target.checked)}
									/>{" "}
									{ev}
								</label>
							))}
						</div>
					</label>
					<button type="button" onClick={create} disabled={!url.trim() || events.length === 0}>Create</button>{" "}
					<button type="button" onClick={() => setShowForm(false)}>Cancel</button>
				</div>
			)}
			<table style={{ width: "100%", borderCollapse: "collapse", color: "#e8dcc4" }}>
				<thead>
					<tr style={{ borderBottom: "1px solid #2a1f15", color: "#8b6914" }}>
						<th style={{ textAlign: "left", padding: 8 }}>URL</th>
						<th style={{ textAlign: "left", padding: 8 }}>Events</th>
						<th style={{ textAlign: "left", padding: 8 }}>Active</th>
						<th style={{ textAlign: "left", padding: 8 }}>Last status</th>
						<th style={{ textAlign: "left", padding: 8 }}>Last dispatched</th>
						<th style={{ textAlign: "left", padding: 8 }}></th>
					</tr>
				</thead>
				<tbody>
					{endpoints.map((ep) => (
						<tr key={ep.id} style={{ borderBottom: "1px solid #1a1410" }}>
							<td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }} title={ep.url}>
								{ep.url.length > 40 ? ep.url.slice(0, 40) + "…" : ep.url}
							</td>
							<td style={{ padding: 8, fontSize: 11 }}>{ep.events.join(", ")}</td>
							<td style={{ padding: 8 }}>
								<button type="button" onClick={() => toggleActive(ep)} style={{ color: ep.active ? "#88a577" : "#a04040" }}>
									{ep.active ? "active" : "inactive"}
								</button>
							</td>
							<td style={{ padding: 8, fontSize: 11 }}>{ep.last_status ?? "—"}</td>
							<td style={{ padding: 8, fontSize: 11 }}>{ep.last_dispatched_at?.slice(0, 16) ?? "—"}</td>
							<td style={{ padding: 8, display: "flex", gap: 8 }}>
								<button type="button" onClick={() => rotateSecret(ep)}>Rotate secret</button>
								<button type="button" onClick={() => deleteEndpoint(ep)}>Delete</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
