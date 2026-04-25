export interface CancellationEmailInput {
	apiKey: string;
	guestEmail: string;
	guestName: string;
	meetingTitle: string;
	slotStartIso: string;
	guestTimezone: string;
	lang: "vi" | "en";
}

export interface ConfirmationEmailInput {
	apiKey: string;
	guestEmail: string;
	guestName: string;
	meetingTitle: string;
	slotStartIso: string;
	slotEndIso: string;
	guestTimezone: string;
	lang: "vi" | "en";
	cancelUrl: string;
	rescheduleUrl: string;
}

export interface RescheduledEmailInput {
	apiKey: string;
	guestEmail: string;
	guestName: string;
	meetingTitle: string;
	oldSlotStartIso: string;
	newSlotStartIso: string;
	newSlotEndIso: string;
	guestTimezone: string;
	lang: "vi" | "en";
	newCancelUrl: string;
	newRescheduleUrl: string;
}

const FROM = "Loc <bookings@huuloc.com>";
const REPLY_TO = "me@huuloc.com";

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function formatSlot(iso: string, tz: string, lang: "vi" | "en"): string {
	const d = new Date(iso);
	const locale = lang === "vi" ? "vi-VN" : "en-US";
	try {
		return new Intl.DateTimeFormat(locale, {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZone: tz,
			timeZoneName: "short",
		}).format(d);
	} catch {
		// Fallback if tz is invalid.
		return d.toISOString();
	}
}

export async function sendConfirmationEmail(input: ConfirmationEmailInput): Promise<void> {
	if (!input.apiKey) {
		console.error("[wc/email] Missing RESEND_API_KEY — skipping confirmation email");
		return;
	}

	const startFmt = formatSlot(input.slotStartIso, input.guestTimezone, input.lang);
	const endFmt = formatSlot(input.slotEndIso, input.guestTimezone, input.lang);

	const subject =
		input.lang === "vi"
			? `Lịch hẹn đã được xác nhận · ${input.meetingTitle}`
			: `Booking confirmed · ${input.meetingTitle}`;

	const greeting =
		input.lang === "vi"
			? `Chào ${input.guestName},`
			: `Hi ${input.guestName},`;

	const confirmLine =
		input.lang === "vi"
			? `Lịch hẹn "${input.meetingTitle}" đã được xác nhận.`
			: `Your booking "${input.meetingTitle}" is confirmed.`;

	const whenLabel = input.lang === "vi" ? "Thời gian" : "When";
	const tzLabel = input.lang === "vi" ? "Múi giờ" : "Timezone";
	const cancelLabel = input.lang === "vi" ? "Huỷ lịch hẹn" : "Cancel booking";
	const rescheduleLabel = input.lang === "vi" ? "Đổi giờ" : "Reschedule";
	const signoff = input.lang === "vi" ? "Hẹn gặp bạn,\nLộc" : "See you soon,\nLoc";

	const text = [
		greeting,
		"",
		confirmLine,
		"",
		`${whenLabel}: ${startFmt} — ${endFmt}`,
		`${tzLabel}: ${input.guestTimezone}`,
		"",
		`${cancelLabel}: ${input.cancelUrl}`,
		`${rescheduleLabel}: ${input.rescheduleUrl}`,
		"",
		signoff,
	].join("\n");

	const html = `<!DOCTYPE html>
<html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(confirmLine)}</p>
<p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px;">
<strong>${escapeHtml(whenLabel)}:</strong> ${escapeHtml(startFmt)} — ${escapeHtml(endFmt)}<br/>
<strong>${escapeHtml(tzLabel)}:</strong> ${escapeHtml(input.guestTimezone)}
</p>
<p>
<a href="${escapeHtml(input.cancelUrl)}" style="color: #b33;">${escapeHtml(cancelLabel)}</a>
&nbsp;·&nbsp;
<a href="${escapeHtml(input.rescheduleUrl)}" style="color: #36c;">${escapeHtml(rescheduleLabel)}</a>
</p>
<p style="white-space: pre-line;">${escapeHtml(signoff)}</p>
</body></html>`;

	try {
		const r = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: FROM,
				reply_to: REPLY_TO,
				to: [input.guestEmail],
				subject,
				html,
				text,
			}),
		});
		if (!r.ok) {
			const body = await r.text();
			console.error(`[wc/email] Resend non-2xx: ${r.status} ${body}`);
		}
	} catch (e) {
		// Non-fatal: booking is already persisted + GCal invite sent.
		console.error("[wc/email] Resend network error:", e instanceof Error ? e.message : String(e));
	}
}

export async function sendCancellationEmail(input: CancellationEmailInput): Promise<void> {
	if (!input.apiKey) {
		console.error("[wc/email] Missing RESEND_API_KEY — skipping cancellation email");
		return;
	}

	const startFmt = formatSlot(input.slotStartIso, input.guestTimezone, input.lang);

	const subject =
		input.lang === "vi"
			? `Lịch hẹn đã hủy · ${input.meetingTitle}`
			: `Booking cancelled · ${input.meetingTitle}`;

	const greeting =
		input.lang === "vi"
			? `Chào ${input.guestName},`
			: `Hi ${input.guestName},`;

	const cancelLine =
		input.lang === "vi"
			? `Lịch hẹn "${input.meetingTitle}" đã được hủy thành công.`
			: `Your booking "${input.meetingTitle}" has been cancelled.`;

	const whenLabel = input.lang === "vi" ? "Thời gian" : "When";
	const rebookLabel = input.lang === "vi" ? "Đặt lịch mới" : "Book again";
	const rebookUrl = "https://huuloc.com/book";
	const signoff = input.lang === "vi" ? "Hẹn gặp lại,\nLộc" : "Hope to connect soon,\nLoc";

	const text = [
		greeting,
		"",
		cancelLine,
		"",
		`${whenLabel}: ${startFmt}`,
		"",
		`${rebookLabel}: ${rebookUrl}`,
		"",
		signoff,
	].join("\n");

	const html = `<!DOCTYPE html>
<html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(cancelLine)}</p>
<p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px;">
<strong>${escapeHtml(whenLabel)}:</strong> ${escapeHtml(startFmt)}
</p>
<p>
<a href="${escapeHtml(rebookUrl)}" style="color: #36c;">${escapeHtml(rebookLabel)}</a>
</p>
<p style="white-space: pre-line;">${escapeHtml(signoff)}</p>
</body></html>`;

	try {
		const r = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: FROM,
				reply_to: REPLY_TO,
				to: [input.guestEmail],
				subject,
				html,
				text,
			}),
		});
		if (!r.ok) {
			const body = await r.text();
			console.error(`[wc/email] Resend non-2xx (cancellation): ${r.status} ${body}`);
		}
	} catch (e) {
		// Non-fatal: booking cancellation is already persisted.
		console.error("[wc/email] Resend network error (cancellation):", e instanceof Error ? e.message : String(e));
	}
}

export interface ReminderEmailInput {
	apiKey: string;
	guestEmail: string;
	guestName: string;
	meetingTitleVi: string;
	meetingTitleEn: string;
	slotStartIso: string;
	guestTimezone: string;
	cancelUrl: string;
	rescheduleUrl: string;
}

export async function sendReminderEmail(input: ReminderEmailInput): Promise<void> {
	if (!input.apiKey) {
		console.error("[wc/email] Missing RESEND_API_KEY — skipping reminder email");
		return;
	}

	const startFmtVi = formatSlot(input.slotStartIso, input.guestTimezone, "vi");
	const startFmtEn = formatSlot(input.slotStartIso, input.guestTimezone, "en");

	const subject = `Nhắc lịch hẹn ngày mai · Reminder: tomorrow's meeting · ${input.meetingTitleVi}`;

	const text = [
		`Chào ${input.guestName},`,
		"",
		`Nhắc lịch hẹn ngày mai`,
		"",
		`Cuộc hẹn: ${input.meetingTitleVi}`,
		`Thời gian: ${startFmtVi}`,
		`Múi giờ: ${input.guestTimezone}`,
		"",
		`Huỷ lịch hẹn: ${input.cancelUrl}`,
		`Đổi giờ: ${input.rescheduleUrl}`,
		"",
		"Hẹn gặp bạn,\nLộc",
		"",
		"---",
		"",
		`Hi ${input.guestName},`,
		"",
		`Reminder: tomorrow's meeting`,
		"",
		`Meeting: ${input.meetingTitleEn}`,
		`When: ${startFmtEn}`,
		`Timezone: ${input.guestTimezone}`,
		"",
		`Cancel booking: ${input.cancelUrl}`,
		`Reschedule: ${input.rescheduleUrl}`,
		"",
		"See you soon,\nLoc",
	].join("\n");

	const html = `<!DOCTYPE html>
<html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
<p>${escapeHtml(`Chào ${input.guestName},`)}</p>
<h2 style="font-size: 1.1rem; margin: 0 0 8px;">Nhắc lịch hẹn ngày mai</h2>
<p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px;">
<strong>Cuộc hẹn:</strong> ${escapeHtml(input.meetingTitleVi)}<br/>
<strong>Thời gian:</strong> ${escapeHtml(startFmtVi)}<br/>
<strong>Múi giờ:</strong> ${escapeHtml(input.guestTimezone)}
</p>
<p>
<a href="${escapeHtml(input.cancelUrl)}" style="color: #b33;">Huỷ lịch hẹn</a>
&nbsp;·&nbsp;
<a href="${escapeHtml(input.rescheduleUrl)}" style="color: #36c;">Đổi giờ</a>
</p>
<p style="white-space: pre-line;">${escapeHtml("Hẹn gặp bạn,\nLộc")}</p>
<hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;"/>
<p>${escapeHtml(`Hi ${input.guestName},`)}</p>
<h2 style="font-size: 1.1rem; margin: 0 0 8px;">Reminder: tomorrow&#39;s meeting</h2>
<p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px;">
<strong>Meeting:</strong> ${escapeHtml(input.meetingTitleEn)}<br/>
<strong>When:</strong> ${escapeHtml(startFmtEn)}<br/>
<strong>Timezone:</strong> ${escapeHtml(input.guestTimezone)}
</p>
<p>
<a href="${escapeHtml(input.cancelUrl)}" style="color: #b33;">Cancel booking</a>
&nbsp;·&nbsp;
<a href="${escapeHtml(input.rescheduleUrl)}" style="color: #36c;">Reschedule</a>
</p>
<p style="white-space: pre-line;">${escapeHtml("See you soon,\nLoc")}</p>
</body></html>`;

	try {
		const r = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: FROM,
				reply_to: REPLY_TO,
				to: [input.guestEmail],
				subject,
				html,
				text,
			}),
		});
		if (!r.ok) {
			const body = await r.text();
			console.error(`[wc/email] Resend non-2xx (reminder): ${r.status} ${body}`);
		}
	} catch (e) {
		// Non-fatal: booking is already persisted.
		console.error("[wc/email] Resend network error (reminder):", e instanceof Error ? e.message : String(e));
	}
}

export async function sendRescheduledEmail(input: RescheduledEmailInput): Promise<void> {
	if (!input.apiKey) {
		console.error("[wc/email] Missing RESEND_API_KEY — skipping reschedule email");
		return;
	}

	const oldFmt = formatSlot(input.oldSlotStartIso, input.guestTimezone, input.lang);
	const newStartFmt = formatSlot(input.newSlotStartIso, input.guestTimezone, input.lang);
	const newEndFmt = formatSlot(input.newSlotEndIso, input.guestTimezone, input.lang);

	const subject =
		input.lang === "vi"
			? `Lịch hẹn đã được dời · ${input.meetingTitle}`
			: `Booking rescheduled · ${input.meetingTitle}`;

	const greeting =
		input.lang === "vi"
			? `Chào ${input.guestName},`
			: `Hi ${input.guestName},`;

	const reschedLine =
		input.lang === "vi"
			? `Lịch hẹn "${input.meetingTitle}" đã được dời sang giờ mới.`
			: `Your booking "${input.meetingTitle}" has been rescheduled.`;

	const oldLabel = input.lang === "vi" ? "Giờ cũ" : "Previous time";
	const newLabel = input.lang === "vi" ? "Giờ mới" : "New time";
	const tzLabel = input.lang === "vi" ? "Múi giờ" : "Timezone";
	const oldLinksNote =
		input.lang === "vi"
			? "Các đường dẫn huỷ và đổi giờ trước đây đã không còn hiệu lực. Vui lòng dùng các đường dẫn mới bên dưới."
			: "The previous cancel and reschedule links are no longer valid. Use the new links below.";
	const cancelLabel = input.lang === "vi" ? "Huỷ lịch hẹn" : "Cancel booking";
	const rescheduleLabel = input.lang === "vi" ? "Đổi giờ" : "Reschedule";
	const signoff = input.lang === "vi" ? "Hẹn gặp bạn,\nLộc" : "See you soon,\nLoc";

	const text = [
		greeting,
		"",
		reschedLine,
		"",
		`${oldLabel}: ${oldFmt}`,
		`${newLabel}: ${newStartFmt} — ${newEndFmt}`,
		`${tzLabel}: ${input.guestTimezone}`,
		"",
		oldLinksNote,
		"",
		`${cancelLabel}: ${input.newCancelUrl}`,
		`${rescheduleLabel}: ${input.newRescheduleUrl}`,
		"",
		signoff,
	].join("\n");

	const html = `<!DOCTYPE html>
<html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(reschedLine)}</p>
<p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px;">
<strong>${escapeHtml(oldLabel)}:</strong> <span style="text-decoration: line-through; color: #777;">${escapeHtml(oldFmt)}</span><br/>
<strong>${escapeHtml(newLabel)}:</strong> ${escapeHtml(newStartFmt)} — ${escapeHtml(newEndFmt)}<br/>
<strong>${escapeHtml(tzLabel)}:</strong> ${escapeHtml(input.guestTimezone)}
</p>
<p style="font-size: 12px; color: #555;">${escapeHtml(oldLinksNote)}</p>
<p>
<a href="${escapeHtml(input.newCancelUrl)}" style="color: #b33;">${escapeHtml(cancelLabel)}</a>
&nbsp;·&nbsp;
<a href="${escapeHtml(input.newRescheduleUrl)}" style="color: #36c;">${escapeHtml(rescheduleLabel)}</a>
</p>
<p style="white-space: pre-line;">${escapeHtml(signoff)}</p>
</body></html>`;

	try {
		const r = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: FROM,
				reply_to: REPLY_TO,
				to: [input.guestEmail],
				subject,
				html,
				text,
			}),
		});
		if (!r.ok) {
			const body = await r.text();
			console.error(`[wc/email] Resend non-2xx (reschedule): ${r.status} ${body}`);
		}
	} catch (e) {
		// Non-fatal: booking reschedule is already persisted + GCal event patched.
		console.error("[wc/email] Resend network error (reschedule):", e instanceof Error ? e.message : String(e));
	}
}
