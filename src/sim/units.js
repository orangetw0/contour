/* Display units. Everything inside the ride is SI (metres, m/s, kg); convert only when showing a number. */
export const SYSTEMS = Object.freeze({
  metric: { speed: [3.6, 'km/h'], distance: [1 / 1000, 'km'], height: [1, 'm'], weight: [1, 'kg'] },
  imperial: { speed: [2.2369362921, 'mph'], distance: [1 / 1609.344, 'mi'], height: [3.280839895, 'ft'], weight: [2.2046226218, 'lb'] },
});

export function units(system) {
  const sys = SYSTEMS[system] || SYSTEMS.metric, out = { system: SYSTEMS[system] ? system : 'metric' };
  for (const k in sys) { out[k] = v => v * sys[k][0]; out[k + 'Label'] = sys[k][1]; }
  return out;
}
