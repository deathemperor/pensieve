import type { FamilyOccurrence } from "./familyEvents";

export interface SyncedEventRecord {
	id: string;
	external_uid: string;
	title: string | null;
	starts_at: string;
	ends_at: string;
	all_day: 0 | 1;
	location: string | null;
	description: string | null;
	source_type: "gcal" | "ics";
	gcal_account_id?: string;
	gcal_calendar_id?: string;
	deleted: 0 | 1;
}

export type EventSource = "family" | "synced";

export interface RenderableEvent {
	id: string;
	source: EventSource;
	title: string;
	subtitle?: string;
	date: Date;
	endDate: Date;
	allDay: boolean;
	category: "giỗ" | "birthday" | "anniversary" | "cultural" | "milestone" | "work" | "flight" | "other";
	raw: FamilyOccurrence | SyncedEventRecord;
}

function familyCategory(occ: FamilyOccurrence): RenderableEvent["category"] {
	switch (occ.event.event_type) {
		case "death_anniv": return "giỗ";
		case "birthday": return "birthday";
		case "wedding_anniv": return "anniversary";
		case "cultural": return "cultural";
		case "milestone": return "milestone";
	}
	return "other";
}

function syncedCategory(_evt: SyncedEventRecord): RenderableEvent["category"] {
	return "work";
}

function familyTitle(occ: FamilyOccurrence): string {
	return occ.event.title_vi || occ.event.title_en || "(untitled)";
}

export function mergeEventSources(
	family: FamilyOccurrence[],
	synced: SyncedEventRecord[],
): RenderableEvent[] {
	const out: RenderableEvent[] = [];

	for (const occ of family) {
		out.push({
			id: `family_${occ.event.id}_${occ.date.toISOString().slice(0, 10)}`,
			source: "family",
			title: familyTitle(occ),
			subtitle: occ.nth != null ? `${occ.nth}th` : undefined,
			date: new Date(occ.date),
			endDate: new Date(occ.date.getTime() + 86400_000),
			allDay: true,
			category: familyCategory(occ),
			raw: occ,
		});
	}

	for (const evt of synced) {
		if (evt.deleted) continue;
		out.push({
			id: evt.id,
			source: "synced",
			title: evt.title ?? "(untitled)",
			subtitle: evt.location ?? undefined,
			date: new Date(evt.starts_at),
			endDate: new Date(evt.ends_at),
			allDay: evt.all_day === 1,
			category: syncedCategory(evt),
			raw: evt,
		});
	}

	out.sort((a, b) => a.date.getTime() - b.date.getTime());
	return out;
}
