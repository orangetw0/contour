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

export const DEFAULT_PROFILE = Object.freeze({ riderKg: 72, heightCm: 178, bike: 'allround', units: 'metric', character: 'male', kit: 'red', skin: 'medium' });
const CHARACTER = ['male', 'female'], KIT = ['red', 'blue', 'green', 'orange', 'white', 'black'], SKIN = ['light', 'medium', 'tan', 'dark'], CM = [140, 210];
const KG = [30, 200];

export function cleanProfile(raw) {
  const p = { ...DEFAULT_PROFILE };
  if (raw && typeof raw === 'object') {
    if (raw.riderKg !== null && raw.riderKg !== '' && Number.isFinite(+raw.riderKg)) p.riderKg = Math.min(KG[1], Math.max(KG[0], +raw.riderKg));
    if (Object.hasOwn(BIKES, raw.bike)) p.bike = raw.bike;
    if (raw.units === 'imperial' || raw.units === 'metric') p.units = raw.units;
    if (CHARACTER.includes(raw.character)) p.character = raw.character;
    if (KIT.includes(raw.kit)) p.kit = raw.kit;
    if (SKIN.includes(raw.skin)) p.skin = raw.skin;
    if (raw.heightCm !== null && raw.heightCm !== '' && Number.isFinite(+raw.heightCm)) p.heightCm = Math.min(CM[1], Math.max(CM[0], +raw.heightCm));
  }
  return p;
}

export function loadProfile(storage) {
  try { return cleanProfile(JSON.parse(storage.getItem(PROFILE_KEY))); } catch { return cleanProfile(null); }
}

export function saveProfile(storage, profile) {
  try { storage.setItem(PROFILE_KEY, JSON.stringify(cleanProfile(profile))); return true; } catch { return false; }
}

/* A bigger rider pushes more air. A bike type's CdA is for a 72 kg rider; this scales it for others, by roughly
   the change in frontal area (about 2.5 % per 10 kg). */
export const sizeFactor = kg => 0.82 + kg / 400;

// what the physics needs: total mass, and drag and rolling numbers for this rider on this bike
export function bodyFor(riderKg, bikeKey) {
  const b = BIKES[bikeKey] || BIKES.allround;
  return { mass: riderKg + b.kg, riderKg, cda: b.cda * sizeFactor(riderKg), crr: b.crr };
}
export const bodyOf = profile => bodyFor(profile.riderKg, profile.bike);

// what the picture needs: who to draw
export const lookOf = profile => ({ character: profile.character, kit: profile.kit, kg: profile.riderKg, heightM: profile.heightCm / 100, skin: profile.skin });
