/* Running numbers for the head unit and the ride summary. */

// average of the last `seconds` of a value sampled `hz` times a second
export function createRolling(seconds, hz) {
  const n = Math.max(1, Math.round(seconds * hz)), buf = new Float64Array(n);
  let i = 0, count = 0, sum = 0;
  return {
    push(x) { sum += x - buf[i]; buf[i] = x; i = (i + 1) % n; if (count < n) count++; return this; },
    get avg() { return count ? sum / count : 0; },
    reset() { buf.fill(0); i = count = sum = 0; },
  };
}

export const wattsPerKg = (watts, riderKg) => riderKg > 0 ? watts / riderKg : 0;

/* Normalised power: the fourth-root mean of 30 s rolling averages of 1 Hz power. Tracks how hard a ride with
   surges felt, compared with a steady one. null for rides shorter than 30 s. */
export function normalisedPower(perSecond) {
  if (perSecond.length < 30) return null;
  let sum = 0, acc = 0, n = 0;
  for (let i = 0; i < perSecond.length; i++) {
    sum += perSecond[i]; if (i >= 30) sum -= perSecond[i - 30];
    if (i >= 29) { acc += (sum / 30) ** 4; n++; }
  }
  return Math.pow(acc / n, 0.25);
}
