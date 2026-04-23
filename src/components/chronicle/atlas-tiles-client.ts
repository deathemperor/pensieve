/**
 * Leaflet-powered tile view for the Atlas.
 *
 * Opt-in — only initializes when the user clicks the "Tiles" toggle.
 * Reuses the same data model as the SVG atlas: entry pins (from
 * window.__CHRONICLE_ENTRIES__) + city circles (from the inline
 * JSON written into #cc-atlas-cities-data).
 *
 * Tiles: OpenStreetMap raster tiles. Policy-compliant for low-traffic
 * personal sites; attribution is rendered by Leaflet automatically.
 * Swap to a different provider by changing the urlTemplate.
 */

import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ChronicleEntryData {
	id: string;
	title: string;
	roman_date: string;
	location?: { name?: string; city?: string; country?: string; lat?: number; lng?: number };
}

interface VisitedCell {
	id: string;
	lat: number;
	lng: number;
	visits: number;
	city: string | null;
	country: string | null;
}

let map: L.Map | null = null;

function escape(s: string | null | undefined): string {
	if (!s) return "";
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function initAtlasTiles(container: HTMLElement): void {
	if (map) return; // already initialized

	const entries = window.__CHRONICLE_ENTRIES__ ?? {};
	const citiesRaw = document.getElementById("cc-atlas-cities-data")?.textContent ?? "[]";
	let cities: VisitedCell[] = [];
	try { cities = JSON.parse(citiesRaw); } catch { /* ignore */ }

	map = L.map(container, {
		zoomControl: true,
		scrollWheelZoom: true,
		worldCopyJump: true,
		attributionControl: true,
	}).setView([20, 50], 2);

	L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		minZoom: 2,
		maxZoom: 14,
	}).addTo(map);

	// City circles, sized by visits. Teal to match SVG version.
	for (const c of cities) {
		if (typeof c.lat !== "number" || typeof c.lng !== "number") continue;
		const r = Math.max(4, Math.min(32, Math.sqrt(c.visits) * 2));
		const circle = L.circleMarker([c.lat, c.lng], {
			radius: r,
			color: "rgba(42, 161, 152, 0.5)",
			fillColor: "rgba(42, 161, 152, 0.2)",
			fillOpacity: 0.6,
			weight: 1,
		}).addTo(map);
		const label = c.city ? `${escape(c.city)}${c.country ? ", " + escape(c.country) : ""}` : `${c.lat}, ${c.lng}`;
		circle.bindTooltip(`${label} — ${c.visits}×`, { direction: "top" });
	}

	// Event pins. Stronger color, click to open the existing modal.
	for (const [id, data] of Object.entries(entries) as [string, ChronicleEntryData][]) {
		const loc = data.location;
		if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;
		const marker = L.circleMarker([loc.lat, loc.lng], {
			radius: 7,
			color: "#d4a843",
			fillColor: "#d4a843",
			fillOpacity: 0.9,
			weight: 2,
		}).addTo(map);
		marker.bindTooltip(
			`<strong>${escape(data.title)}</strong><br/><span style="color:rgba(212,168,67,0.8);font-family:monospace;font-size:10px;">${escape(data.roman_date)}</span>`,
			{ direction: "top", className: "cc-atlas-tile-tooltip" },
		);
		marker.on("click", () => {
			// Reuse the existing modal from the SVG atlas.
			const star = document.querySelector<HTMLElement>(`.cc-star[data-id="${CSS.escape(id)}"]`);
			star?.click();
		});
	}

	// Fit the visible content: use the bounding box of all pins + cities.
	const allPoints: [number, number][] = [];
	for (const c of cities) if (typeof c.lat === "number" && typeof c.lng === "number") allPoints.push([c.lat, c.lng]);
	for (const data of Object.values(entries)) {
		const loc = (data as ChronicleEntryData).location;
		if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") allPoints.push([loc.lat, loc.lng]);
	}
	if (allPoints.length > 0) {
		map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20], maxZoom: 6 });
	}

	// Invalidate size after the container transitions in — otherwise tiles
	// only paint for the pre-transition dimensions.
	setTimeout(() => map?.invalidateSize(), 300);
}
