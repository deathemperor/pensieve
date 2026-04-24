import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { encryptToken } from "./lib/crypto";
import { verifyGoogleIdToken } from "./lib/jwt";
import { generateState, consumeState, type OAuthStateStore } from "./lib/oauth-state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDARLIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

// Native-format plugins get a single merged RouteContext argument (see
// node_modules/emdash/src/plugins/routes.ts — createContext() returns a
// PluginContext, then dispatcher spreads {...baseContext, input, request,
// requestMeta} and invokes handler(routeContext)). The previous two-arg
// signature left `ctx` undefined and every `ctx.storage` / `ctx.env` /
// `ctx.log` call crashed with a 500 in prod.
type RouteCtx = PluginContext & {
	input?: any;
	request?: Request;
	url?: string;
	requestMeta?: any;
};

function redirectUri(origin: string): string {
	return `${origin}/_emdash/api/plugins/weasley-clock/oauth/google/callback`;
}

function getOrigin(ctx: RouteCtx): string {
	const raw = ctx.url ?? ctx.request?.url;
	if (!raw) throw new Error("Route context missing url");
	return new URL(raw).origin;
}

function stateStoreFor(ctx: RouteCtx): OAuthStateStore {
	const ns = (ctx.storage as any).oauth_state;
	return {
		async put(id, data) { await ns.put(id, data); },
		async get(id) { return ns.get(id); },
		async delete(id) { await ns.delete(id); },
	};
}

async function findAccountIdByEmail(ctx: RouteCtx, email: string): Promise<string | null> {
	const all = await (ctx.storage as any).oauth_accounts.query({});
	const items = all.items ?? all ?? [];
	const existing = items.find((r: any) => r.data?.provider === "google" && r.data?.account_email === email);
	return existing ? existing.id : null;
}

async function discoverCalendars(ctx: RouteCtx, accountRow: { id: string; access_token: string }): Promise<void> {
	const res = await fetch(GOOGLE_CALENDARLIST_URL, {
		headers: { Authorization: `Bearer ${accountRow.access_token}` },
	});
	if (!res.ok) {
		const text = await res.text();
		ctx.log.info(`discoverCalendars failed: ${res.status} ${text}`);
		return;
	}
	const data = (await res.json()) as { items: any[] };
	for (const cal of data.items ?? []) {
		const id = `cal_${accountRow.id}_${btoa(cal.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`;
		await (ctx.storage as any).oauth_calendars.put(id, {
			id,
			account_id: accountRow.id,
			calendar_id: cal.id,
			summary: cal.summary ?? cal.summaryOverride ?? cal.id,
			time_zone: cal.timeZone ?? null,
			background_color: cal.backgroundColor ?? null,
			access_role: cal.accessRole ?? null,
			synced: 0,
			sync_token: null,
			last_resynced_at: null,
			expose_titles: 1,
		});
	}
	ctx.log.info(`discoverCalendars: ${(data.items ?? []).length} calendars enumerated for ${accountRow.id}`);
}

export default definePlugin({
	id: "weasley-clock",
	version: "0.2.0",
	hooks: {
		"plugin:install": {
			handler: async (_event: unknown, ctx: PluginContext) => {
				ctx.log.info("weasley-clock: plugin installed");
			},
		},
	},

	routes: {
		"oauth/google/initiate": {
			public: false,
			handler: async (ctx: RouteCtx) => {
				const origin = getOrigin(ctx);
				const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
				if (!clientId) return { error: "GOOGLE_OAUTH_CLIENT_ID not configured" };

				const returnUrl = typeof ctx.input?.return_url === "string"
					? ctx.input.return_url
					: "/_emdash/admin/plugins/weasley-clock";
				const state = await generateState(stateStoreFor(ctx), { returnUrl });

				const params = new URLSearchParams({
					client_id: clientId,
					redirect_uri: redirectUri(origin),
					response_type: "code",
					scope: SCOPE,
					access_type: "offline",
					prompt: "consent",
					state,
				});

				return { redirect: `${GOOGLE_AUTH_URL}?${params.toString()}` };
			},
		},

		"oauth/google/callback": {
			public: true,
			handler: async (ctx: RouteCtx) => {
				const url = new URL(ctx.url ?? ctx.request!.url);
				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");
				const errorParam = url.searchParams.get("error");

				if (errorParam) {
					ctx.log.info(`oauth/callback: user denied consent (${errorParam})`);
					return { redirect: `/_emdash/admin/plugins/weasley-clock?error=${encodeURIComponent(errorParam)}` };
				}
				if (!code || !state) return { error: "Missing code or state" };

				const stateRow = await consumeState(stateStoreFor(ctx), state);
				if (!stateRow) return { error: "Invalid or expired state — please retry" };

				const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
				const clientSecret = (ctx.env as any).GOOGLE_OAUTH_CLIENT_SECRET;
				const encKey = (ctx.env as any).OAUTH_ENC_KEY;
				if (!clientId || !clientSecret || !encKey) return { error: "OAuth not fully configured" };

				const origin = getOrigin(ctx);
				const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						grant_type: "authorization_code",
						code,
						client_id: clientId,
						client_secret: clientSecret,
						redirect_uri: redirectUri(origin),
					}),
				});
				if (!tokenRes.ok) {
					const text = await tokenRes.text();
					ctx.log.info(`oauth/callback: token exchange failed ${tokenRes.status}: ${text}`);
					return { error: "Token exchange failed" };
				}
				const tokens = (await tokenRes.json()) as {
					access_token: string;
					refresh_token?: string;
					expires_in: number;
					id_token: string;
					scope: string;
				};

				if (!tokens.scope.split(/\s+/).includes(SCOPE)) {
					return { error: "Required calendar read access was not granted. Please accept all requested scopes." };
				}

				if (!tokens.refresh_token) {
					return { error: "Google did not return a refresh_token — please revoke access in your Google account settings and try again" };
				}

				const idPayload = await verifyGoogleIdToken(tokens.id_token, clientId);

				const accessEnc = await encryptToken(tokens.access_token, encKey);
				const refreshEnc = await encryptToken(tokens.refresh_token, encKey);

				const accountId = await findAccountIdByEmail(ctx, idPayload.email);
				const now = new Date().toISOString();
				const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
				const existingRow = accountId ? await (ctx.storage as any).oauth_accounts.get(accountId) : null;

				const row = {
					id: accountId ?? "acc_" + state.slice(0, 16).toLowerCase(),
					provider: "google" as const,
					account_email: idPayload.email,
					display_name: idPayload.name ?? null,
					access_token_enc: accessEnc.ciphertext_b64,
					access_token_iv: accessEnc.iv_b64,
					refresh_token_enc: refreshEnc.ciphertext_b64,
					refresh_token_iv: refreshEnc.iv_b64,
					access_token_expires_at: expiresAt,
					scope: tokens.scope,
					status: "active" as const,
					last_sync_error: null,
					connected_at: existingRow?.data?.connected_at ?? now,
					last_synced_at: existingRow?.data?.last_synced_at ?? null,
					revoked_at: null,
				};
				await (ctx.storage as any).oauth_accounts.put(row.id, row);

				await discoverCalendars(ctx, { id: row.id, access_token: tokens.access_token });

				return { redirect: stateRow.return_url || "/_emdash/admin/plugins/weasley-clock" };
			},
		},

		"calendars/toggle": {
			public: false,
			handler: async (ctx: RouteCtx) => {
				const { calendar_id, synced } = (ctx.input ?? {}) as { calendar_id?: string; synced?: boolean };
				if (!calendar_id || typeof synced !== "boolean") {
					return { error: "Expected { calendar_id, synced }" };
				}
				const row = await (ctx.storage as any).oauth_calendars.get(calendar_id);
				if (!row) return { error: "Calendar not found" };
				await (ctx.storage as any).oauth_calendars.put(calendar_id, { ...row.data, synced: synced ? 1 : 0 });
				return { ok: true };
			},
		},

		"accounts/list": {
			public: false,
			handler: async (ctx: RouteCtx) => {
				const accs = await (ctx.storage as any).oauth_accounts.query({});
				const cals = await (ctx.storage as any).oauth_calendars.query({});
				const accountsList = ((accs.items ?? accs ?? []) as any[]).map((r: any) => ({
					id: r.id,
					account_email: r.data.account_email,
					display_name: r.data.display_name,
					status: r.data.status,
					connected_at: r.data.connected_at,
					last_synced_at: r.data.last_synced_at ?? null,
					last_sync_error: r.data.last_sync_error ?? null,
				}));
				const calendarsByAccount: Record<string, any[]> = {};
				for (const r of (cals.items ?? cals ?? []) as any[]) {
					const list = calendarsByAccount[r.data.account_id] ?? (calendarsByAccount[r.data.account_id] = []);
					list.push({
						id: r.id,
						calendar_id: r.data.calendar_id,
						summary: r.data.summary,
						time_zone: r.data.time_zone,
						background_color: r.data.background_color,
						synced: !!r.data.synced,
					});
				}
				return { accounts: accountsList, calendarsByAccount };
			},
		},

		"cron/sync-all": {
			public: true,
			handler: async (ctx: RouteCtx) => {
				const provided = ctx.request?.headers?.get?.("X-Sync-Secret");
				const expected = (ctx.env as any).SYNC_SECRET;
				if (!expected || provided !== expected) return { error: "Forbidden" };

				const { syncCalendar } = await import("./lib/sync-calendar");
				const { ensureFreshAccessToken } = await import("./lib/token-refresh");

				const encKey = (ctx.env as any).OAUTH_ENC_KEY;
				const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
				const clientSecret = (ctx.env as any).GOOGLE_OAUTH_CLIENT_SECRET;
				if (!encKey || !clientId || !clientSecret) return { error: "OAuth env not configured" };

				const accs = await (ctx.storage as any).oauth_accounts.query({});
				const cals = await (ctx.storage as any).oauth_calendars.query({});
				const accountsById = new Map<string, any>();
				for (const r of (accs.items ?? accs ?? [])) accountsById.set(r.id, r.data);

				const summary: Array<{ calendarId: string; status: string; events: number }> = [];

				for (const cr of (cals.items ?? cals ?? [])) {
					const cal = cr.data;
					if (!cal.synced) continue;
					const acc = accountsById.get(cal.account_id);
					if (!acc || acc.status !== "active") {
						summary.push({ calendarId: cal.id, status: "skipped_inactive_account", events: 0 });
						continue;
					}
					try {
						const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(acc, {
							encKey, clientId, clientSecret,
						});
						if (refreshed && updatedRow) {
							await (ctx.storage as any).oauth_accounts.put(updatedRow.id, updatedRow);
						}
						const result = await syncCalendar(cal, {
							storage: ctx.storage as any,
							getAccessToken: async () => access_token,
						});
						summary.push({ calendarId: cal.id, status: result.status, events: result.eventsProcessed });
					} catch (err: any) {
						const msg = String(err?.message ?? err);
						if (/invalid_grant/i.test(msg)) {
							await (ctx.storage as any).oauth_accounts.put(acc.id, {
								...acc,
								status: "revoked",
								last_sync_error: msg,
								revoked_at: new Date().toISOString(),
							});
							summary.push({ calendarId: cal.id, status: "account_revoked", events: 0 });
						} else {
							await (ctx.storage as any).oauth_accounts.put(acc.id, {
								...acc,
								last_sync_error: msg,
							});
							summary.push({ calendarId: cal.id, status: "error", events: 0 });
						}
						ctx.log.info(`sync-all: ${cal.id} failed: ${msg}`);
					}
				}
				return { ok: true, summary };
			},
		},

		"sync-now": {
			public: false,
			handler: async (ctx: RouteCtx) => {
				const { account_id } = (ctx.input ?? {}) as { account_id?: string };
				if (!account_id) return { error: "Expected { account_id }" };
				const { syncCalendar } = await import("./lib/sync-calendar");
				const { ensureFreshAccessToken } = await import("./lib/token-refresh");
				const encKey = (ctx.env as any).OAUTH_ENC_KEY;
				const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
				const clientSecret = (ctx.env as any).GOOGLE_OAUTH_CLIENT_SECRET;
				const accRow = await (ctx.storage as any).oauth_accounts.get(account_id);
				if (!accRow) return { error: "Account not found" };
				const acc = accRow.data;
				const cals = await (ctx.storage as any).oauth_calendars.query({});
				const matching = ((cals.items ?? cals ?? []) as any[]).filter(
					(r: any) => r.data.account_id === account_id && r.data.synced,
				);
				let total = 0;
				try {
					const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(acc, {
						encKey, clientId, clientSecret,
					});
					if (refreshed && updatedRow) await (ctx.storage as any).oauth_accounts.put(updatedRow.id, updatedRow);
					for (const cr of matching) {
						const result = await syncCalendar(cr.data, {
							storage: ctx.storage as any,
							getAccessToken: async () => access_token,
						});
						total += result.eventsProcessed;
					}
					return { ok: true, events: total };
				} catch (err: any) {
					const msg = String(err?.message ?? err);
					if (/invalid_grant/i.test(msg)) {
						await (ctx.storage as any).oauth_accounts.put(acc.id, {
							...acc, status: "revoked", last_sync_error: msg, revoked_at: new Date().toISOString(),
						});
					}
					return { error: msg };
				}
			},
		},
	},
});
