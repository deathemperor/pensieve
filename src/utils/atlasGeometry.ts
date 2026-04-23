/**
 * Pure math for the Atlas panel — equirectangular projection with a fixed
 * viewport. No tile provider; positions are plain SVG coordinates.
 *
 * Used by the Chronicle page to render pins for entries that carry a
 * location JSON blob (name, city, country, lat, lng).
 */

export interface LatLng {
	lat: number;
	lng: number;
}

export interface ViewportPx {
	widthPx: number;
	heightPx: number;
}

export interface AtlasBounds {
	/** min/max latitude drawn in the viewport (north positive) */
	latMin: number;
	latMax: number;
	/** min/max longitude drawn in the viewport (east positive) */
	lngMin: number;
	lngMax: number;
}

/**
 * Equirectangular mapping: latitude → y (pixel, top-down), longitude → x
 * (pixel, left-to-right). Points outside `bounds` return a clamped
 * position at the viewport edge; the caller is responsible for hiding or
 * flagging them if that's the desired behavior.
 */
export function projectLatLng(
	ll: LatLng,
	bounds: AtlasBounds,
	viewport: ViewportPx,
): { x: number; y: number } {
	const lngSpan = bounds.lngMax - bounds.lngMin;
	const latSpan = bounds.latMax - bounds.latMin;
	if (lngSpan <= 0 || latSpan <= 0) {
		throw new Error("Invalid bounds: longitude and latitude spans must be positive");
	}
	const xFrac = (ll.lng - bounds.lngMin) / lngSpan;
	const yFrac = 1 - (ll.lat - bounds.latMin) / latSpan;
	return {
		x: Math.max(0, Math.min(viewport.widthPx, xFrac * viewport.widthPx)),
		y: Math.max(0, Math.min(viewport.heightPx, yFrac * viewport.heightPx)),
	};
}

/**
 * Bounds for the default Atlas panel — a world-scale view covering the
 * Americas (eastern half), Europe, Africa, and most of Asia + Oceania.
 * Wide enough to catch travel outliers from Google Timeline aggregation
 * (the author's data hits Michigan US through Vietnam / Japan).
 */
export const DEFAULT_ATLAS_BOUNDS: AtlasBounds = {
	latMin: -10,
	latMax: 65,
	lngMin: -130,
	lngMax: 150,
};

/**
 * Graticule lines to draw for context — every 30 degrees. Lines that
 * fall outside the viewport are still returned so callers can decide
 * whether to clip; projection puts them on the viewport edge anyway.
 */
/** Normalize JS signed zero so deep-equal comparisons succeed. */
const normZero = (n: number): number => (n === 0 ? 0 : n);

export function graticuleLngs(bounds: AtlasBounds, stepDeg = 30): number[] {
	const out: number[] = [];
	const start = Math.ceil(bounds.lngMin / stepDeg) * stepDeg;
	for (let v = start; v <= bounds.lngMax; v += stepDeg) out.push(normZero(v));
	return out;
}

export function graticuleLats(bounds: AtlasBounds, stepDeg = 30): number[] {
	const out: number[] = [];
	const start = Math.ceil(bounds.latMin / stepDeg) * stepDeg;
	for (let v = start; v <= bounds.latMax; v += stepDeg) out.push(normZero(v));
	return out;
}
