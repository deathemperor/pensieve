import { useEffect, useState } from "react";

interface Account {
	id: string;
	account_email: string;
	display_name: string | null;
	status: string;
	connected_at: string | null;
	last_synced_at: string | null;
	last_sync_error: string | null;
}

interface Calendar {
	id: string;
	calendar_id: string;
	summary: string;
	time_zone: string | null;
	background_color: string | null;
	synced: boolean;
}

const API_BASE = "/api/weasley-clock";

export default function FeedsPage() {
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [calByAccount, setCalByAccount] = useState<Record<string, Calendar[]>>({});
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState<Set<string>>(new Set());

	async function refresh() {
		setLoading(true);
		const res = await fetch(`${API_BASE}/accounts/list`, {
			method: "POST",
			body: "{}",
			headers: { "Content-Type": "application/json" },
		});
		const data = await res.json();
		setAccounts(data.accounts ?? []);
		setCalByAccount(data.calendarsByAccount ?? {});
		setLoading(false);
	}

	useEffect(() => {
		refresh();
	}, []);

	async function toggleCalendar(accountId: string, calendarRowId: string, next: boolean) {
		await fetch(`${API_BASE}/calendars/toggle`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ calendar_id: calendarRowId, synced: next }),
		});
		setCalByAccount((prev) => ({
			...prev,
			[accountId]: (prev[accountId] ?? []).map((c) =>
				c.id === calendarRowId ? { ...c, synced: next } : c,
			),
		}));
	}

	async function startConnect() {
		const res = await fetch(`${API_BASE}/oauth/google/initiate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ return_url: window.location.pathname }),
		});
		const data = await res.json();
		if (data.redirect) {
			window.location.href = data.redirect;
		} else {
			alert("Failed to start OAuth: " + JSON.stringify(data));
		}
	}

	async function syncAccount(accountId: string) {
		setSyncing((s) => new Set([...s, accountId]));
		try {
			const res = await fetch(`${API_BASE}/sync-now`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ account_id: accountId }),
			});
			const data = await res.json();
			if (data.error) alert(`Sync failed: ${data.error}`);
		} finally {
			setSyncing((s) => {
				const n = new Set(s);
				n.delete(accountId);
				return n;
			});
			refresh();
		}
	}

	if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

	const revokedAccounts = accounts.filter((a) => a.status === "revoked");
	const erroredAccounts = accounts.filter((a) => a.status !== "revoked" && a.last_sync_error);

	return (
		<div style={{ padding: 20, maxWidth: 820 }}>
			<h1>Calendar Feeds</h1>
			{revokedAccounts.length > 0 && (
				<div style={{ padding: 12, background: "#40191b", border: "1px solid #a04040", borderRadius: 4, marginBottom: 12, color: "#ffb6a0" }}>
					<strong>Reauth required:</strong>{" "}
					{revokedAccounts.map((a) => a.account_email).join(", ")}. Revoke access in Google settings, then click Connect again to re-grant.
				</div>
			)}
			{erroredAccounts.length > 0 && (
				<div style={{ padding: 12, background: "#3a2a1f", border: "1px solid #a67a3e", borderRadius: 4, marginBottom: 12, color: "#e8dcc4" }}>
					<strong>Sync errors on:</strong>{" "}
					{erroredAccounts.map((a) => a.account_email).join(", ")}. Try clicking <em>Sync now</em> per account; persistent errors may need reauth.
				</div>
			)}
			<section>
				<h2>Google accounts</h2>
				{accounts.length === 0 && (
					<p style={{ color: "#888" }}>No Google accounts connected yet.</p>
				)}
				{accounts.map((acc) => (
					<div
						key={acc.id}
						style={{ border: "1px solid #333", padding: 12, marginBottom: 12, borderRadius: 4 }}
					>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
							<div>
								<strong>{acc.account_email}</strong>
								{acc.display_name && (
									<span style={{ color: "#888", marginLeft: 8 }}>· {acc.display_name}</span>
								)}
								{acc.last_synced_at && (
									<div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
										Last synced: {new Date(acc.last_synced_at).toLocaleString()}
									</div>
								)}
							</div>
							<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
								<button
									onClick={() => syncAccount(acc.id)}
									disabled={syncing.has(acc.id) || acc.status === "revoked"}
									style={{ fontSize: 11, padding: "4px 8px" }}
								>
									{syncing.has(acc.id) ? "Syncing…" : "Sync now"}
								</button>
								<span style={{ fontSize: 11, color: acc.status === "active" ? "#6a6" : "#c66" }}>
									{acc.status}
								</span>
							</div>
						</div>
						<div style={{ marginTop: 10 }}>
							{(calByAccount[acc.id] ?? []).map((cal) => (
								<label
									key={cal.id}
									style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}
								>
									<input
										type="checkbox"
										checked={cal.synced}
										onChange={(e) => toggleCalendar(acc.id, cal.id, e.target.checked)}
									/>
									{cal.background_color && (
										<span
											style={{
												width: 12,
												height: 12,
												background: cal.background_color,
												borderRadius: 2,
												display: "inline-block",
											}}
										/>
									)}
									<span>{cal.summary}</span>
									{cal.time_zone && (
										<span style={{ color: "#888", fontSize: 11 }}>· {cal.time_zone}</span>
									)}
								</label>
							))}
						</div>
					</div>
				))}
			</section>
			<button
				onClick={startConnect}
				style={{
					padding: "10px 16px",
					background: "#c9a961",
					color: "#1a1410",
					border: 0,
					borderRadius: 2,
					fontWeight: "bold",
					letterSpacing: 1,
				}}
			>
				+ Connect Google account
			</button>
		</div>
	);
}
