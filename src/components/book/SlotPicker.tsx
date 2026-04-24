import { useEffect, useMemo, useState } from "react";

interface Question {
	id: string;
	label_en: string;
	label_vi: string;
	required?: boolean;
	type?: "text" | "textarea";
}

interface Props {
	meetingTypeId: string;
	durationMin: number;
	lang: "vi" | "en";
	title: string;
	questions: Question[];
}

interface Slot {
	start_iso: string;
	end_iso: string;
}

export default function SlotPicker({ meetingTypeId, durationMin, lang, title, questions }: Props) {
	const [anchor, setAnchor] = useState<Date>(() => new Date());
	const [slots, setSlots] = useState<Slot[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
	const [guestName, setGuestName] = useState("");
	const [guestEmail, setGuestEmail] = useState("");
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const guestTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
	const isVi = lang === "vi";

	useEffect(() => {
		const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59);
		setLoading(true);
		setError(null);
		fetch("/api/weasley-clock/bookings/slots", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				meeting_type_id: meetingTypeId,
				range_start_iso: first.toISOString(),
				range_end_iso: last.toISOString(),
				guest_timezone: guestTz,
			}),
		})
			.then((r) => r.json() as Promise<{ slots?: Slot[]; error?: string }>)
			.then((d) => {
				if (d.error) setError(String(d.error));
				else setSlots(d.slots ?? []);
			})
			.catch((e) => setError(e?.message ?? (isVi ? "Không thể tải khung giờ trống." : "Failed to load slots.")))
			.finally(() => setLoading(false));
	}, [anchor, meetingTypeId, guestTz]);

	const slotsByDate = useMemo(() => {
		const m: Record<string, Slot[]> = {};
		const fmt = new Intl.DateTimeFormat("en-CA", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			timeZone: guestTz,
		});
		for (const s of slots) {
			const ymd = fmt.format(new Date(s.start_iso));
			(m[ymd] ??= []).push(s);
		}
		return m;
	}, [slots, guestTz]);

	const grid = useMemo(() => buildGrid(anchor), [anchor]);

	const todayYmd = new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone: guestTz,
	}).format(new Date());

	function shiftMonth(n: -1 | 1) {
		setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
		setSelectedDate(null);
		setSelectedSlot(null);
	}

	const t = {
		loading: isVi ? "Đang tải…" : "Loading…",
		noSlots: isVi ? "Không còn khung giờ trống trong tháng này." : "No available slots this month.",
		pickDate: isVi
			? "Chọn một ngày có khung giờ trống (các ngày in đậm)."
			: "Pick a day with available slots (shown in bold).",
		availableAt: (ymd: string) => (isVi ? `Khung giờ trống ngày ${ymd}` : `Available times on ${ymd}`),
		nameLabel: isVi ? "Tên của bạn" : "Your name",
		emailLabel: isVi ? "Email" : "Email",
		tzLabel: isVi ? "Múi giờ" : "Timezone",
		submit: isVi ? "Xác nhận đặt lịch" : "Confirm booking",
		submitting: isVi ? "Đang xử lý…" : "Booking…",
		errorPrefix: isVi ? "Lỗi: " : "Error: ",
		networkError: isVi ? "Không thể kết nối. Vui lòng thử lại." : "Network error. Please try again.",
		bookingFor: (s: Slot) =>
			`${formatLocal(s.start_iso, guestTz, lang)} – ${formatLocalTimeOnly(s.end_iso, guestTz, lang)}`,
		back: isVi ? "← Chọn khung giờ khác" : "← Pick another time",
		monthLabel: new Intl.DateTimeFormat(isVi ? "vi-VN" : "en-GB", { month: "long", year: "numeric" }).format(anchor),
		dow: isVi ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
		prevMonth: isVi ? "Tháng trước" : "Previous month",
		nextMonth: isVi ? "Tháng sau" : "Next month",
		dayLabel: (ymd: string) => isVi ? `Ngày ${ymd}` : `Day ${ymd}`,
	};

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedSlot) return;
		setSubmitting(true);
		setError(null);
		try {
			const res = await fetch("/api/weasley-clock/bookings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					meeting_type_id: meetingTypeId,
					slot_start_iso: selectedSlot.start_iso,
					guest_name: guestName.trim(),
					guest_email: guestEmail.trim(),
					guest_answers: answers,
					guest_timezone: guestTz,
					lang,
				}),
			});
			const data = (await res.json()) as { confirmed_url?: string; error?: string };
			if (!res.ok) {
				setError(data.error ?? `HTTP ${res.status}`);
				setSubmitting(false);
				return;
			}
			window.location.href = data.confirmed_url ?? "/book";
		} catch (err: any) {
			setError(err?.message ?? t.networkError);
			setSubmitting(false);
		}
	}

	const monthHasSlots = slots.length > 0;

	return (
		<div className="slot-picker">
			<div className="slot-picker__calendar">
				<div className="slot-picker__monthnav">
					<button type="button" onClick={() => shiftMonth(-1)} aria-label={t.prevMonth}>
						←
					</button>
					<span>{t.monthLabel}</span>
					<button type="button" onClick={() => shiftMonth(1)} aria-label={t.nextMonth}>
						→
					</button>
				</div>
				<div className="slot-picker__headings">
					{t.dow.map((d) => (
						<div key={d} className="slot-picker__dow">
							{d}
						</div>
					))}
				</div>
				<div className="slot-picker__grid">
					{grid.map((cell, idx) => {
						const hasSlots = (slotsByDate[cell.ymd] ?? []).length > 0;
						const isPastOrDisabled = cell.ymd < todayYmd;
						const inMonth = cell.inMonth;
						const isSelected = cell.ymd === selectedDate;
						return (
							<button
								key={`${cell.ymd}-${idx}`}
								type="button"
								className={`slot-picker__day ${inMonth ? "" : "slot-picker__day--dim"} ${isSelected ? "slot-picker__day--sel" : ""}`}
								disabled={isPastOrDisabled || !hasSlots}
								onClick={() => {
									setSelectedDate(cell.ymd);
									setSelectedSlot(null);
								}}
								style={{ fontWeight: hasSlots ? 600 : 400 }}
								aria-label={t.dayLabel(cell.ymd)}
							>
								{cell.day}
								{hasSlots && <span className="slot-picker__dot" />}
							</button>
						);
					})}
				</div>
				{!loading && !error && !monthHasSlots && <p className="slot-picker__nomonth">{t.noSlots}</p>}
			</div>

			<div className="slot-picker__right">
				{loading && <p>{t.loading}</p>}
				{error && (
					<p style={{ color: "#ff6b6b" }}>
						{t.errorPrefix}
						{error}
					</p>
				)}
				{!loading && !error && !selectedDate && <p>{t.pickDate}</p>}
				{!loading && !selectedSlot && selectedDate && (
					<>
						<h3>{t.availableAt(selectedDate)}</h3>
						<ul className="slot-picker__times">
							{(slotsByDate[selectedDate] ?? []).map((s) => (
								<li key={s.start_iso}>
									<button type="button" onClick={() => setSelectedSlot(s)}>
										{formatLocalTimeOnly(s.start_iso, guestTz, lang)}
									</button>
								</li>
							))}
						</ul>
					</>
				)}
				{selectedSlot && (
					<form onSubmit={submit} className="slot-picker__form">
						<button type="button" onClick={() => setSelectedSlot(null)} className="slot-picker__back">
							{t.back}
						</button>
						<div className="slot-picker__summary">
							<div>{title}</div>
							<div>{t.bookingFor(selectedSlot)}</div>
							<div style={{ fontSize: 11, color: "#8b6914" }}>
								{t.tzLabel}: {guestTz}
							</div>
							<div style={{ fontSize: 11, color: "#8b6914" }}>
								{durationMin} {isVi ? "phút" : "min"}
							</div>
						</div>
						<label>
							<span>{t.nameLabel}</span>
							<input
								type="text"
								required
								value={guestName}
								onChange={(e) => setGuestName(e.target.value)}
							/>
						</label>
						<label>
							<span>{t.emailLabel}</span>
							<input
								type="email"
								required
								value={guestEmail}
								onChange={(e) => setGuestEmail(e.target.value)}
							/>
						</label>
						{questions.map((q) => (
							<label key={q.id}>
								<span>{isVi ? q.label_vi : q.label_en}</span>
								{q.type === "textarea" ? (
									<textarea
										required={q.required}
										value={answers[q.id] ?? ""}
										onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
									/>
								) : (
									<input
										type="text"
										required={q.required}
										value={answers[q.id] ?? ""}
										onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
									/>
								)}
							</label>
						))}
						<button type="submit" disabled={submitting}>
							{submitting ? t.submitting : t.submit}
						</button>
						{error && (
							<p style={{ color: "#ff6b6b" }}>
								{t.errorPrefix}
								{error}
							</p>
						)}
					</form>
				)}
			</div>
		</div>
	);
}

// ---------- helpers ----------

function buildGrid(anchor: Date): Array<{ ymd: string; day: number; inMonth: boolean }> {
	const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
	const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
	const firstDow = first.getDay();
	const offset = (firstDow + 6) % 7;
	const gridStart = new Date(first);
	gridStart.setDate(first.getDate() - offset);
	const lastDow = last.getDay();
	const tailOffset = (7 - lastDow) % 7;
	const gridEnd = new Date(last);
	gridEnd.setDate(last.getDate() + tailOffset);
	const cells: Array<{ ymd: string; day: number; inMonth: boolean }> = [];
	const fmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
	for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
		cells.push({
			ymd: fmt.format(d),
			day: d.getDate(),
			inMonth: d.getMonth() === anchor.getMonth(),
		});
	}
	return cells;
}

function formatLocal(iso: string, tz: string, lang: "vi" | "en"): string {
	const locale = lang === "vi" ? "vi-VN" : "en-GB";
	return new Intl.DateTimeFormat(locale, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: tz,
	}).format(new Date(iso));
}

function formatLocalTimeOnly(iso: string, tz: string, lang: "vi" | "en"): string {
	const locale = lang === "vi" ? "vi-VN" : "en-GB";
	return new Intl.DateTimeFormat(locale, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: tz,
	}).format(new Date(iso));
}
