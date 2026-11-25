/* Writes a ride as a FIT activity file, the format Strava, Garmin Connect, Wahoo and most training sites accept.
   Input: the recorder's samples and summary (src/sim/recorder.js). Output: the file's bytes.
   Only what a ride needs is written: who made the file, a start and stop, one record a second, one lap, one
   session marked as a virtual ride, and the activity. */
const FIT_EPOCH = 631065600;                       // FIT counts seconds from 31 Dec 1989 UTC
const T = { enum: [0x00, 1], u8: [0x02, 1], u16: [0x84, 2], u32: [0x86, 4], s32: [0x85, 4], u32z: [0x8C, 4] };
const NONE = { enum: 0xFF, u8: 0xFF, u16: 0xFFFF, u32: 0xFFFFFFFF, s32: 0x7FFFFFFF, u32z: 0 };

const CRC = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
export function fitCrc(bytes, crc = 0) {
  for (const b of bytes) {
    let t = CRC[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc ^= t ^ CRC[b & 0xF];
    t = CRC[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc ^= t ^ CRC[(b >> 4) & 0xF];
  }
  return crc;
}

// message layouts: [field number, type] in the order written. Field numbers are from the FIT profile.
const MSG = {
  file_id: { num: 0, fields: { type: [0, 'enum'], manufacturer: [1, 'u16'], product: [2, 'u16'], serial_number: [3, 'u32z'], time_created: [4, 'u32'] } },
  event: { num: 21, fields: { timestamp: [253, 'u32'], event: [0, 'enum'], event_type: [1, 'enum'] } },
  record: { num: 20, fields: { timestamp: [253, 'u32'], position_lat: [0, 's32'], position_long: [1, 's32'], altitude: [2, 'u16'], heart_rate: [3, 'u8'],
    cadence: [4, 'u8'], distance: [5, 'u32'], speed: [6, 'u16'], power: [7, 'u16'] } },
  lap: { num: 19, fields: { message_index: [254, 'u16'], timestamp: [253, 'u32'], event: [0, 'enum'], event_type: [1, 'enum'], start_time: [2, 'u32'],
    total_elapsed_time: [7, 'u32'], total_timer_time: [8, 'u32'], total_distance: [9, 'u32'] } },
  session: { num: 18, fields: { message_index: [254, 'u16'], timestamp: [253, 'u32'], event: [0, 'enum'], event_type: [1, 'enum'], start_time: [2, 'u32'],
    sport: [5, 'enum'], sub_sport: [6, 'enum'], total_elapsed_time: [7, 'u32'], total_timer_time: [8, 'u32'], total_distance: [9, 'u32'],
    avg_speed: [14, 'u16'], max_speed: [15, 'u16'], avg_heart_rate: [16, 'u8'], max_heart_rate: [17, 'u8'], avg_cadence: [18, 'u8'],
    avg_power: [20, 'u16'], max_power: [21, 'u16'], total_ascent: [22, 'u16'], first_lap_index: [25, 'u16'], num_laps: [26, 'u16'], trigger: [28, 'enum'] } },
  activity: { num: 34, fields: { timestamp: [253, 'u32'], total_timer_time: [0, 'u32'], num_sessions: [1, 'u16'], type: [2, 'enum'], event: [3, 'enum'], event_type: [4, 'enum'] } },
};

const semicircles = deg => Math.round(deg * (2 ** 31 / 180));
const orNone = (x, f) => x == null || !Number.isFinite(x) ? null : f(x);

export function encodeFit(samples, summary, { product = 1, serial = 1 } = {}) {
  if (!samples.length || !summary) throw new Error('nothing recorded yet');
  const out = [], defined = new Map();
  const write = (name, values) => {
    const m = MSG[name], keys = Object.keys(m.fields);
    if (!defined.has(name)) {                       // each kind of message is described once, before its first use
      const local = defined.size; defined.set(name, local);
      out.push(0x40 | local, 0, 0, m.num & 0xFF, m.num >> 8, keys.length);
      for (const k of keys) { const [num, t] = m.fields[k]; out.push(num, T[t][1], T[t][0]); }
    }
    out.push(defined.get(name));
    for (const k of keys) {
      const t = m.fields[k][1], size = T[t][1];
      let v = values[k]; if (v == null) v = NONE[t];
      v = Math.round(v); if (t === 's32' && v < 0) v += 2 ** 32;
      for (let i = 0; i < size; i++) out.push(Math.floor(v / 2 ** (8 * i)) & 0xFF);
    }
  };
  const ts = unix => unix - FIT_EPOCH, ms = s => s * 1000, cm = m => m * 100, mmps = v => Math.min(65534, v * 1000);
  const start = ts(summary.start), end = ts(summary.end);

  write('file_id', { type: 4, manufacturer: 255, product, serial_number: serial, time_created: start });       // 4: activity; 255: development
  write('event', { timestamp: start, event: 0, event_type: 0 });                                              // timer start
  const d0 = samples[0].dist - samples[0].v;
  for (const s of samples) {
    write('record', {
      timestamp: ts(s.t), position_lat: orNone(s.lat, semicircles), position_long: orNone(s.lon, semicircles),
      altitude: orNone(s.alt, a => (a + 500) * 5), heart_rate: orNone(s.hr, h => Math.min(254, h)), cadence: orNone(s.cad, c => Math.min(254, c)),
      distance: cm(s.dist - d0), speed: mmps(s.v), power: Math.min(65534, s.power),
    });
  }
  write('event', { timestamp: end, event: 0, event_type: 4 });                                                // timer stop
  const totals = { total_elapsed_time: ms(summary.elapsed), total_timer_time: ms(summary.moving), total_distance: cm(summary.distance) };
  write('lap', { message_index: 0, timestamp: end, event: 9, event_type: 1, start_time: start, ...totals });
  write('session', {
    message_index: 0, timestamp: end, event: 8, event_type: 1, start_time: start, sport: 2, sub_sport: 58, ...totals,     // cycling, virtual activity
    avg_speed: mmps(summary.avgSpeed), max_speed: mmps(summary.maxSpeed), avg_heart_rate: summary.avgHr, max_heart_rate: summary.maxHr,
    avg_cadence: summary.avgCad, avg_power: summary.avgPower, max_power: summary.maxPower, total_ascent: summary.ascent,
    first_lap_index: 0, num_laps: 1, trigger: 0,
  });
  write('activity', { timestamp: end, total_timer_time: ms(summary.moving), num_sessions: 1, type: 0, event: 26, event_type: 1 });

  const head = [14, 0x20, 2132 & 0xFF, 2132 >> 8, out.length & 0xFF, (out.length >> 8) & 0xFF, (out.length >> 16) & 0xFF, (out.length >>> 24) & 0xFF, 0x2E, 0x46, 0x49, 0x54];
  const hc = fitCrc(head); head.push(hc & 0xFF, hc >> 8);
  const all = head.concat(out), crc = fitCrc(all);
  all.push(crc & 0xFF, crc >> 8);
  return Uint8Array.from(all);
}
