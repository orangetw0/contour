/* Power to speed: gravity, rolling resistance and air drag. No DOM, no rendering; safe to run anywhere.
   body:  { mass (kg, rider + bike), cda (m²), crr }
   model: the rules of the world. LEGACY is the original ride's model, kept so the restructure changes nothing:
          descents count half and the rider feathers the brakes above 54 km/h. A realistic model replaces it next. */
export const G = 9.81;

export const LEGACY = Object.freeze({
  rho: 1.2,             // air density, kg/m³
  descentFactor: 0.5,   // share of a downhill slope that counts
  brakeAbove: 15,       // m/s; above this the rider brakes
  brakeGain: 0.5,       // braking deceleration per m/s over the limit, 1/s
  minSpeed: 0.5,        // m/s; the ride never quite stops
  minDriveSpeed: 2,     // m/s; caps the push from power at very low speed
});

// slope is rise over distance along the road (the road tangent's y), positive uphill
export function acceleration(v, power, slope, body, model = LEGACY) {
  const s = slope > 0 ? slope : slope * model.descentFactor;
  const brake = v > model.brakeAbove ? body.mass * model.brakeGain * (v - model.brakeAbove) : 0;
  const force = power / Math.max(v, model.minDriveSpeed) - body.mass * G * (s + body.crr) - 0.5 * model.rho * body.cda * v * v - brake;
  return force / body.mass;
}

export function stepSpeed(v, power, slope, body, dt, model = LEGACY) {
  return Math.max(model.minSpeed, v + acceleration(v, power, slope, body, model) * dt);
}

// the speed a rider settles at for a steady power and slope; for tests and, later, for bots
export function steadySpeed(power, slope, body, model = LEGACY) {
  let v = 6;
  for (let i = 0; i < 20000; i++) { const n = stepSpeed(v, power, slope, body, 0.05, model); if (Math.abs(n - v) < 1e-7) return n; v = n; }
  return v;
}
