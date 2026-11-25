/* The rider's own numbers, kept in this browser. */
export const PROFILE_KEY = 'contour-profile';

/* Bike types. Weight in kg; CdA (m²) is for rider and bike together in that bike's usual position; Crr is for its
   usual tyres on tarmac. These are typical figures for each kind of bike, not measurements of any one model. */
export const BIKES = Object.freeze({
  allround: { name: 'All-round road', kg: 8.0, cda: 0.32, crr: 0.004 },
  climbing: { name: 'Climbing', kg: 6.8, cda: 0.33, crr: 0.004 },
  aero: { name: 'Aero road', kg: 7.8, cda: 0.30, crr: 0.0038 },
  tt: { name: 'Time trial', kg: 8.8, cda: 0.24, crr: 0.0035 },
  gravel: { name: 'Gravel', kg: 9.5, cda: 0.36, crr: 0.006 },
});

export const DEFAULT_PROFILE = Object.freeze({ riderKg: 72, bike: 'allround', units: 'metric', character: 'male', kit: 'red' });
const CHARACTER = ['male', 'female'], KIT = ['red', 'blue', 'green', 'orange', 'white', 'black'];
const KG = [30, 200];

export function cleanProfile(raw) {
  const p = { ...DEFAULT_PROFILE };
  if (raw && typeof raw === 'object') {
    if (raw.riderKg !== null && raw.riderKg !== '' && Number.isFinite(+raw.riderKg)) p.riderKg = Math.min(KG[1], Math.max(KG[0], +raw.riderKg));
    if (Object.hasOwn(BIKES, raw.bike)) p.bike = raw.bike;
    if (raw.units === 'imperial' || raw.units === 'metric') p.units = raw.units;
    if (CHARACTER.includes(raw.character)) p.character = raw.character;
    if (KIT.includes(raw.kit)) p.kit = raw.kit;
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
export function bodyOf(profile) {
  const b = BIKES[profile.bike] || BIKES.allround;
  return { mass: profile.riderKg + b.kg, riderKg: profile.riderKg, cda: b.cda, crr: b.crr };
}
