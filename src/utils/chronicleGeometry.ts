export function monthToAngleDeg(month: number | null): number | null {
  if (month === null) return null;
  if (month < 1 || month > 12) throw new Error(`Bad month: ${month}`);
  return ((month - 1) / 12) * 360;
}

export interface RingScale {
  innerPx: number;
  outerPx: number;
}

/**
 * Map a year to a ring radius. Newest populated year = innermost ring.
 * Oldest = outermost. Intermediate years evenly interpolated.
 */
export function ringRadiusForYear(
  year: number,
  populatedYears: number[],
  scale: RingScale,
): number {
  const sorted = [...new Set(populatedYears)].sort((a, b) => a - b);
  const idx = sorted.indexOf(year);
  if (idx < 0) throw new Error(`Year ${year} not in populated years`);
  if (sorted.length === 1) return scale.innerPx;
  const frac = (sorted.length - 1 - idx) / (sorted.length - 1);
  return scale.innerPx + frac * (scale.outerPx - scale.innerPx);
}

export interface StarAngle { id: string; angle: number }

export interface FanOptions { thresholdDeg: number; fanDeg: number }

/**
 * If two stars fall within `thresholdDeg` of each other, fan them symmetrically
 * around their midpoint by ±fanDeg. Simple O(n²) — fine for ≤200 stars.
 */
export function fanCluster(stars: StarAngle[], opts: FanOptions): StarAngle[] {
  const out = stars.map((s) => ({ ...s }));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      if (Math.abs(a.angle - b.angle) <= opts.thresholdDeg) {
        const mid = (a.angle + b.angle) / 2;
        a.angle = mid - opts.fanDeg;
        b.angle = mid + opts.fanDeg;
      }
    }
  }
  return out;
}
