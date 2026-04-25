import { useEffect, useState } from "react";

interface KeySummary {
	id: string;
	label: string;
	scopes: string[];
	created_at: string;
	last_used_at: string | null;
	revoked_at: string | null;
}

const API_BASE = "/api/weasley-clock/api-keys";

export default function ApiKeysPage() {
	const [keys, setKeys] = useState<KeySummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [newKeyShown, setNewKeyShown] = useState<string | null>(null); // raw key shown ONCE
	const [showForm, setShowForm] = useState(false);
	const [label, setLabel] = useState("");
	const [scopes, setScopes] = useState<string[]>(["bookings:read"]);

	async function refresh() {
		setLoading(true);
		const res = await fetch(API_BASE, { method: "GET" });
		const data = await res.json();
		setKeys(data.keys ?? []);
		setLoading(false);
	}

	useEffect(() => { refresh(); }, []);

	async function create() {
		const res = await fetch(API_BASE, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ label, scopes }),
		});
		const data = await res.json();
		if (data.raw) {
			setNewKeyShown(data.raw);
			setShowForm(false);
			setLabel("");
			refresh();
		} else {
			alert("Failed: " + JSON.stringify(data));
		}
	}

	async function revoke(id: string) {
		if (!confirm("Revoke this key? This is permanent.")) return;
		await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
		refresh();
	}

	if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

	return (
		<div style={{ padding: 20, maxWidth: 820 }}>
			<h1>API Keys</h1>
			{newKeyShown && (
				<div style={{ padding: 12, background: "#3a2a1f", border: "1px solid #c9a961", borderRadius: 4, marginBottom: 16, color: "#e8dcc4" }}>
					<strong>Save this key now — it will not be shown again:</strong>
					<pre style={{ background: "#0a0604", padding: 10, marginTop: 8, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{newKeyShown}</pre>
					<button type="button" onClick={() => setNewKeyShown(null)}>Dismiss</button>
				</div>
			)}
			{!showForm && (
				<button type="button" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>+ New API key</button>
			)}
			{showForm && (
				<div style={{ padding: 12, border: "1px solid #2a1f15", marginBottom: 16 }}>
					<label style={{ display: "block", marginBottom: 8 }}>
						<div>Label</div>
						<input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., partner-portal-readonly" style={{ width: "100%" }} />
					</label>
					<label style={{ display: "block", marginBottom: 8 }}>
						<div>Scopes</div>
						<div>
							<label><input type="checkbox" checked={scopes.includes("bookings:read")} onChange={(e) => setScopes(e.target.checked ? Array.from(new Set([...scopes, "bookings:read"])) : scopes.filter((s) => s !== "bookings:read"))} /> bookings:read</label>
						</div>
					</label>
					<button type="button" onClick={create} disabled={!label.trim() || scopes.length === 0}>Create</button>{" "}
					<button type="button" onClick={() => setShowForm(false)}>Cancel</button>
				</div>
			)}
			<table style={{ width: "100%", borderCollapse: "collapse", color: "#e8dcc4" }}>
				<thead>
					<tr style={{ borderBottom: "1px solid #2a1f15", color: "#8b6914" }}>
						<th style={{ textAlign: "left", padding: 8 }}>Label</th>
						<th style={{ textAlign: "left", padding: 8 }}>Scopes</th>
						<th style={{ textAlign: "left", padding: 8 }}>Created</th>
						<th style={{ textAlign: "left", padding: 8 }}>Last used</th>
						<th style={{ textAlign: "left", padding: 8 }}>Status</th>
						<th style={{ textAlign: "left", padding: 8 }}></th>
					</tr>
				</thead>
				<tbody>
					{keys.map((k) => (
						<tr key={k.id} style={{ borderBottom: "1px solid #1a1410" }}>
							<td style={{ padding: 8 }}>{k.label}</td>
							<td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{k.scopes.join(", ")}</td>
							<td style={{ padding: 8, fontSize: 11 }}>{k.created_at?.slice(0, 10)}</td>
							<td style={{ padding: 8, fontSize: 11 }}>{k.last_used_at?.slice(0, 10) ?? "—"}</td>
							<td style={{ padding: 8, color: k.revoked_at ? "#a04040" : "#88a577" }}>{k.revoked_at ? "revoked" : "active"}</td>
							<td style={{ padding: 8 }}>{!k.revoked_at && <button type="button" onClick={() => revoke(k.id)}>Revoke</button>}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
