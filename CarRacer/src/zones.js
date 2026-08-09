// In-run visual progression: the world's palette (pylons/fog/sky) shifts
// through a cycling set of zones as distance increases, purely visual --
// the difficulty ramp already tells the player "things are progressing";
// this is what makes the world itself feel like it's moving through
// distinct stretches of track over a long run.
export const ZONES = [
  // Zone 0 matches the current look exactly -- no visual change at the
  // start of a run, only after the first zone boundary.
  {
    name: 'Void',
    fog: 0x0a0e1e,
    skyTop: '#05060c', skyMid: '#0a0e1e', skyBottom: '#12162a',
    neonA: 0x6ff0ff, neonB: 0xff6ff0,
  },
  {
    name: 'Ember',
    fog: 0x1a0e08,
    skyTop: '#120704', skyMid: '#2a1408', skyBottom: '#3a2410',
    neonA: 0xffe14d, neonB: 0xff5c3f,
  },
  {
    name: 'Verdant',
    fog: 0x081a10,
    skyTop: '#04120a', skyMid: '#0a2a16', skyBottom: '#12351e',
    neonA: 0x39ff8f, neonB: 0x6ff0ff,
  },
  {
    name: 'Violet',
    fog: 0x140a1e,
    skyTop: '#0c0512', skyMid: '#1e0a2a', skyBottom: '#2e1240',
    neonA: 0xb453ff, neonB: 0xff3f6f,
  },
];

export const ZONE_DISTANCE = 700; // meters per zone
export const ZONE_TRANSITION = 0.25; // fraction of the span spent blending into the next zone

// Returns the current zone, the one being blended into, and how far into
// that blend we are (0 = fully zoneA, 1 = fully zoneB). Pure function of
// distance -- no state to reset on restart.
export function getZoneBlend(distance) {
  const n = ZONES.length;
  const idx = Math.floor(distance / ZONE_DISTANCE);
  const zoneA = ZONES[((idx % n) + n) % n];
  const zoneB = ZONES[(((idx + 1) % n) + n) % n];
  const localT = (distance % ZONE_DISTANCE) / ZONE_DISTANCE;
  const holdUntil = 1 - ZONE_TRANSITION;
  const blend = localT < holdUntil ? 0 : (localT - holdUntil) / ZONE_TRANSITION;
  return { zoneA, zoneB, blend };
}
