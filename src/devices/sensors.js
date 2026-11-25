/* Heart rate and cadence: the byte-level parts of the Bluetooth messages. */

// Heart Rate Measurement: a flags byte, then beats per minute in one or two bytes
export function heartRate(dv) {
  if (dv.byteLength < 2) return null;
  const wide = dv.getUint8(0) & 0x01;
  if (wide && dv.byteLength < 3) return null;
  return wide ? dv.getUint16(1, true) : dv.getUint8(1);
}

/* Crank data inside a Cycling Power Measurement: a running count of crank turns and the time of the last one
   (in 1/1024 s). Returns { revs, time }, or null if this trainer doesn't send it. */
export function crankData(dv) {
  if (dv.byteLength < 4) return null;
  const flags = dv.getUint16(0, true);
  if (!(flags & 0x20)) return null;
  let o = 4;
  if (flags & 0x01) o += 1;         // pedal power balance
  if (flags & 0x04) o += 2;         // accumulated torque
  if (flags & 0x10) o += 6;         // wheel revolutions and time
  return o + 4 <= dv.byteLength ? { revs: dv.getUint16(o, true), time: dv.getUint16(o + 2, true) } : null;
}

// Cadence in rpm from two crank readings. Both counters wrap at 65536. null when there has been no new turn.
export function cadenceBetween(prev, cur) {
  if (!prev || !cur) return null;
  const turns = (cur.revs - prev.revs) & 0xFFFF, secs = ((cur.time - prev.time) & 0xFFFF) / 1024;
  if (!secs || !turns) return null;
  const rpm = turns / secs * 60;
  return rpm < 250 ? rpm : null;
}

// Instantaneous cadence (rpm) from FTMS Indoor Bike Data, or null if the message doesn't carry it
export function indoorBikeCadence(dv) {
  if (dv.byteLength < 2) return null;
  const flags = dv.getUint16(0, true);
  if (!(flags & 0x04)) return null;
  let o = 2;
  if (!(flags & 0x01)) o += 2;      // instantaneous speed
  if (flags & 0x02) o += 2;         // average speed
  return o + 2 <= dv.byteLength ? dv.getUint16(o, true) * 0.5 : null;
}
