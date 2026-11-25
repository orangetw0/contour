/* Power to speed. No DOM, no rendering; safe to run anywhere.
   body: { mass (kg, rider + bike), cda (m², rider and bike together), crr }
   env:  { altitude (m), vLimit (m/s, the fastest the rider will take the road here; see course/speedLimit.js),
           drag (share of air drag left when sheltered behind other riders, 1 in clean air; see sim/draft.js) }
   Two sets of rules:
   REAL   – gravity in full both ways, rolling resistance, air drag thinning with altitude, drivetrain loss,
            and a rider who brakes for bends instead of at a fixed speed.
   LEGACY – the original ride: descents count half and the brakes come on above 54 km/h. ?physics=legacy */
export const G = 9.81;

// air density at an altitude, kg/m³: standard sea-level air thinning by about 1 % per 100 m
export const airDensity = (altitude = 0) => 1.225 * Math.exp(-Math.max(-500, altitude) / 10000);

export const REAL = Object.freeze({
  name: 'real',
  drivetrain: 0.975,    // share of pedal power that reaches the road
  wheelKg: 0.3,         // the wheels' spin, as extra mass to get moving
  maxAccel: 3,          // m/s²; caps the push from power at very low speed
  brakeDecel: 3,        // m/s²; how hard the rider brakes for a bend
  maxSpeed: 27.8,       // m/s (100 km/h); the rider sits up and brakes beyond this
  minSpeed: 0,          // the rider can stop
  accel(v, power, slope, body, env = {}) {
    const cos = Math.sqrt(Math.max(0, 1 - slope * slope));
    const drive = Math.min(power * this.drivetrain / Math.max(v, 0.3), body.mass * this.maxAccel);
    const resist = body.mass * G * (slope + body.crr * cos) + 0.5 * airDensity(env.altitude) * body.cda * (env.drag ?? 1) * v * v;
    return (drive - resist) / (body.mass + this.wheelKg);
  },
});

export const LEGACY = Object.freeze({
  name: 'legacy',
  rho: 1.2,             // air density, kg/m³
  descentFactor: 0.5,   // share of a downhill slope that counts
  brakeAbove: 15,       // m/s; above this the rider brakes
  brakeGain: 0.5,       // braking deceleration per m/s over the limit, 1/s
  minSpeed: 0.5,        // m/s; the ride never quite stops
  minDriveSpeed: 2,     // m/s; caps the push from power at very low speed
  maxSpeed: Infinity, brakeDecel: 0,
  accel(v, power, slope, body) {
    const s = slope > 0 ? slope : slope * this.descentFactor;
    const brake = v > this.brakeAbove ? body.mass * this.brakeGain * (v - this.brakeAbove) : 0;
    const force = power / Math.max(v, this.minDriveSpeed) - body.mass * G * (s + body.crr) - 0.5 * this.rho * body.cda * v * v - brake;
    return force / body.mass;
  },
});

export const MODELS = { real: REAL, legacy: LEGACY };

// slope is rise over distance along the road (the road tangent's y), positive uphill
export const acceleration = (v, power, slope, body, model = REAL, env) => model.accel(v, power, slope, body, env);

export function stepSpeed(v, power, slope, body, dt, model = REAL, env = {}) {
  let n = v + model.accel(v, power, slope, body, env) * dt;
  const limit = model.brakeDecel ? Math.min(env.vLimit ?? Infinity, model.maxSpeed) : Infinity;
  if (n > limit) n = Math.max(limit, v - model.brakeDecel * dt);       // brake down to the limit, no harder than brakeDecel
  return Math.max(model.minSpeed, n);
}

// the speed a rider settles at for a steady power and slope; for tests and, later, for bots
export function steadySpeed(power, slope, body, model = REAL, env = {}) {
  let v = 6;
  for (let i = 0; i < 40000; i++) { const n = stepSpeed(v, power, slope, body, 0.05, model, env); if (Math.abs(n - v) < 1e-8) return n; v = n; }
  return v;
}
