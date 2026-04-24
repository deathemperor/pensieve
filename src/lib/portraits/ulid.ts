// 26-char Crockford-base32 ULID, monotonic within process.
// Extracted from per-file copies; shared across all portraits code.
// Hot path is admin-only; no dep needed.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let lastMs = 0;
let lastRand: Uint8Array = new Uint8Array(10);

export function ulid(): string {
  const now = Date.now();
  let rand: Uint8Array;
  if (now === lastMs) {
    rand = new Uint8Array(lastRand);
    for (let i = 9; i >= 0; i--) {
      rand[i] = (rand[i] + 1) & 0xff;
      if (rand[i] !== 0) break;
    }
  } else {
    rand = crypto.getRandomValues(new Uint8Array(10));
    lastMs = now;
  }
  lastRand = rand as Uint8Array;

  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }

  let randStr = "";
  let bits = 0;
  let acc = 0;
  for (let i = 0; i < 10; i++) {
    acc = (acc << 8) | rand[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      randStr += CROCKFORD[(acc >> bits) & 31];
    }
  }
  return time + randStr;
}
