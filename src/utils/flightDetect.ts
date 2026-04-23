// Best-effort IATA flight-code detector. Looks for an uppercase 2-letter
// airline code followed by 1–4 digits at the start of the string.
// Misses ICAO (3-letter) codes, which rarely appear in consumer booking
// confirmations.
const FLIGHT_RE = /^([A-Z]{2})\s?(\d{1,4})\b\s*(.*)$/;

export interface FlightMatch {
	code: string; // e.g. "SQ186"
	rest: string; // title remainder after the code
}

export function detectFlight(title: string): FlightMatch | null {
	if (!title) return null;
	const m = title.match(FLIGHT_RE);
	if (!m) return null;
	return { code: m[1] + m[2], rest: m[3].trim() };
}
