/* The rider's own numbers, kept in this browser. Defaults add up to the original ride's fixed 80 kg. */
export const PROFILE_KEY = 'contour-profile';
export const DEFAULT_PROFILE = Object.freeze({ riderKg: 72, bikeKg: 8, cda: 0.32, crr: 0.004, units: 'metric' });

const LIMITS = { riderKg: [30, 200], bikeKg: [4, 30], cda: [0.15, 0.7], crr: [0.001, 0.02] };

export function cleanProfile(raw) {
  const p = { ...DEFAULT_PROFILE };
  if (raw && typeof raw === 'object') {
    for (const k in LIMITS) if (Number.isFinite(+raw[k]) && raw[k] !== null && raw[k] !== '') p[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], +raw[k]));
    if (raw.units === 'imperial' || raw.units === 'metric') p.units = raw.units;
  }
  return p;
}

export function loadProfile(storage) {
  try { return cleanProfile(JSON.parse(storage.getItem(PROFILE_KEY))); } catch { return cleanProfile(null); }
}

export function saveProfile(storage, profile) {
  try { storage.setItem(PROFILE_KEY, JSON.stringify(cleanProfile(profile))); return true; } catch { return false; }
}

// what the physics needs from a profile
export const bodyOf = profile => ({ mass: profile.riderKg + profile.bikeKg, cda: profile.cda, crr: profile.crr });
