// Three in-run pipe sections (§5.4, §10 milestone 7), reached purely by
// elapsed run time -- always restarts from section 0 on a new run (§8, no
// persistent meta-progression). Keeping section content here (not in
// core/systems logic) is what makes Post-MVP's additional sections a data
// addition later, not a core-logic rewrite (§9.3).
//
// obstaclesPerWave / pickupChance / obstacleSpacing are stage 4's tuning
// call per §12 -- increasing density/speed each section is the doc's only
// hard requirement. Capped so the treatment chamber never demands faster
// reaction than a lean board can give (§5.1's "no fast alternating
// corrections" discipline).

export const SECTIONS = [
  {
    key: 'stormDrain',
    label: 'STORM DRAIN',
    startSeconds: 0,
    crossSection: 'partialArc',
    themeIndex: 0,
    speed: 0.1,
    obstacleSpacing: 30, // world units between waves
    obstaclesPerWave: [1, 1, 1, 2], // weighted pool, mostly singles
    pickupChance: 0.55,
    obstacleTypes: ['crate'],
  },
  {
    key: 'mainLine',
    label: 'MAIN LINE',
    startSeconds: 32,
    crossSection: 'partialArc',
    themeIndex: 1,
    speed: 0.125,
    obstacleSpacing: 24,
    obstaclesPerWave: [1, 1, 2, 2],
    pickupChance: 0.6,
    obstacleTypes: ['crate', 'drum'],
  },
  {
    key: 'treatmentChamber',
    label: 'TREATMENT CHAMBER',
    startSeconds: 68,
    crossSection: 'halfPipe',
    themeIndex: 2,
    speed: 0.145,
    obstacleSpacing: 20,
    obstaclesPerWave: [1, 2, 2, 3],
    pickupChance: 0.65,
    obstacleTypes: ['crate', 'drum', 'girder'],
  },
];

export function sectionIndexAt(elapsedSeconds) {
  let idx = 0;
  for (let i = 0; i < SECTIONS.length; i++) {
    if (elapsedSeconds >= SECTIONS[i].startSeconds) idx = i;
  }
  return idx;
}
