export function nextBirthdayOccurrence(birthday: string, today: Date): string | null {
  let month: number, day: number;

  const fullMatch = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const shortMatch = birthday.match(/^--(\d{2})-(\d{2})$/);

  if (fullMatch) {
    month = parseInt(fullMatch[2], 10);
    day = parseInt(fullMatch[3], 10);
  } else if (shortMatch) {
    month = parseInt(shortMatch[1], 10);
    day = parseInt(shortMatch[2], 10);
  } else {
    return null;
  }

  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;

  const year = today.getUTCFullYear();
  const todayKey = today.toISOString().slice(0, 10);
  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (candidate >= todayKey) return candidate;
  return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface BirthdayInput { contact_id: string; birthday: string; full_name: string }

export interface UpcomingReminder {
  id: string;
  contact_id: string;
  kind: string;
  due_at: string;
  body: string | null;
}
