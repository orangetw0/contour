/* Bluetooth trainer messages: the byte-level parts, kept apart from the connection code so they can be tested.
   FTMS is the Fitness Machine Service; Cycling Power is the older, power-only service. */
export const FTMS = 0x1826, FTMS_POINT = 0x2AD9, FTMS_BIKE_DATA = 0x2AD2;
export const OP_CONTROL = 0x00, OP_SIM = 0x11, OP_REPLY = 0x80, OP_OK = 0x01;

// Cycling Power Measurement: 2 bytes of flags, then instantaneous power in watts
export const cyclingPower = dv => dv.byteLength >= 4 ? dv.getInt16(2, true) : null;

/* Indoor Bike Data: 2 bytes of flags, then only the fields the flags announce, in a fixed order.
   Returns instantaneous power in watts, or null if this message doesn't carry it. */
export function indoorBikePower(dv) {
  if (dv.byteLength < 2) return null;
  const flags = dv.getUint16(0, true);
  if (!(flags & 0x40)) return null;
  let o = 2;
  if (!(flags & 0x01)) o += 2;      // instantaneous speed (present when the "more data" bit is clear)
  if (flags & 0x02) o += 2;         // average speed
  if (flags & 0x04) o += 2;         // instantaneous cadence
  if (flags & 0x08) o += 2;         // average cadence
  if (flags & 0x10) o += 3;         // total distance
  if (flags & 0x20) o += 2;         // resistance level
  return o + 2 <= dv.byteLength ? dv.getInt16(o, true) : null;
}

// What the trainer is asked to feel for a road gradient (%). hills: 0 to 1. Descents count half again.
export function trainerGrade(gradePct, hills) {
  return Math.max(-20, Math.min(20, gradePct)) * (gradePct > 0 ? hills : hills * 0.5);
}

// Indoor Bike Simulation Parameters: wind, gradient, rolling resistance and drag, matching the ride's own physics.
// (FTMS has no rider weight here; the trainer uses the weight set in its own app.)
export function simParams(gradePct, body, rho = 1.2) {
  const d = new DataView(new ArrayBuffer(7));
  d.setUint8(0, OP_SIM);
  d.setInt16(1, 0, true);                                              // wind speed, 0.001 m/s
  d.setInt16(3, Math.round(gradePct * 100), true);                     // gradient, 0.01 %
  d.setUint8(5, Math.min(255, Math.round(body.crr / 0.0001)));         // rolling resistance, 0.0001
  d.setUint8(6, Math.min(255, Math.round(0.5 * rho * body.cda / 0.01)));   // drag (half rho CdA), 0.01 kg/m
  return d;
}
