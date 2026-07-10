/** Today's date (YYYY-MM-DD) in Vietnam time — the daily rollover boundary. */
export function todayVN(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

/** Validate a YYYY-MM-DD string (no future dates for the daily archive). */
export function isValidDay(d: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= todayVN();
}

/** Puzzle number, counting from the launch day. Used for the share card. */
const EPOCH = "2026-07-10";
export function puzzleNumber(day: string): number {
	const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`);
	return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
