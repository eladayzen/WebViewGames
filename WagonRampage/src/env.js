// Environments: one place per level. applyEnv() in main.js reads this at level start.
//
//   look   overrides on top of the base LOOK (anything LOOK_DEFAULTS has: exposure, fogDensity,
//          hemi*, sun*, bloom*, windows, neonSigns, lampLight, lampPool, roadWet, foot*...)
//   sky    horizon / zenith / band colours: the sky dome AND the fog read these, together
//   lamp   colour of the street-lamp lights and their pools on the road
//   neon   colours of the four shopfront neon spills
//   tint   multipliers on the existing textures: upper floors, shopfronts, towers, road, sidewalk,
//          window glow, neon signs, paint (centre / edge lines), the ground plane under it all
//   kit    the shape of the street: floors, widths, gaps, props, lamp spacing, backdrop
//
// Level 1 is the original Midtown night: empty look overrides, kit defaults.

export const KIT_DEFAULT = {
  floors: [2, 9],          // storeys per building (inclusive)
  width: [9, 22],          // metres along the street
  gap: 0.16,               // chance of a gap (alley / lot) after a building
  gapLen: [5, 14],
  setback: 0.25,
  towers: 0.4,             // chance of a tall tower behind a building
  towerH: [35, 90],
  ground: 4.4,             // shopfront height
  lampEvery: 24,
  vents: true,
  props: [],               // 'lanterns' | 'banners' | 'spikes' | 'pylons' | 'crane'
  propChance: 0.5,
  lot: null,               // what fills a gap: 'containers' | 'rubble'
  backdrop: 'city',        // 'city' | 'dusk' | 'docks' | 'pagodas' | 'techno'
};

export const ENVS = {
  // 1 JOY RIDE: Midtown at night (the baseline)
  1: {
    name: 'Midtown night',
    look: {},
    sky: { horizon: 0x3a4580, zenith: 0x080b22, band: 0x9a5aa8 },
    lamp: 0xffb878, pool: 0xffffff,
    neon: [0xd860b0, 0x60a8d8, 0xd89050, 0x9070d0],
    tint: { upper: 0xffffff, ground: 0xffffff, tower: 0xffffff, road: 0xffffff, walk: 0xffffff, win: 0xffffff, neon: 0xffffff, yellow: 0xffc42e, white: 0xe8e6de, base: 0x17141f },
    kit: { backdrop: 'city' },
  },

  // 2 PICK UP LEO: downtown at golden dusk. Low sun, warm air, a dry road, tall blocks.
  2: {
    name: 'Downtown dusk',
    look: {
      exposure: 1.55, saturation: 1.15, contrast: 1.0, vignette: 0.45,
      bloomStrength: 0.45, bloomThreshold: 1.1,
      sunIntensity: 3.6, sunColor: '#ffae6a', sunAzimuth: -70, sunElevation: 13,
      hemiIntensity: 1.25, hemiSky: '#ffc59a', hemiGround: '#5a3446',
      lampLight: 16, lampPool: 0.18, neonLight: 24, windows: 0.55, neonSigns: 0.5, underglow: 0.55, fogDensity: 0.0042,
      roadWet: 0.3, roadDark: 0.08, fresnelEdge: 0.35, dampSheen: 0.15, walkWet: 0.05,
    },
    sky: { horizon: 0xf0905a, zenith: 0x2c3470, band: 0xffb060 },
    lamp: 0xffc890, pool: 0xffd8a8,
    neon: [0xffa060, 0xff7088, 0xffc060, 0xc080a0],
    tint: { upper: 0xffddc0, ground: 0xffe4c8, tower: 0xe8c0b0, road: 0xc4b0a4, walk: 0xd8c0aa, win: 0xffc880, neon: 0xffd0a0, yellow: 0xffc42e, white: 0xf4ece0, base: 0x3a2a30 },
    kit: { floors: [4, 13], width: [8, 19], gap: 0.1, towers: 0.55, towerH: [50, 110], backdrop: 'dusk', props: ['tanks'], propChance: 0.35 },
  },

  // 3 SAVE APRIL: a rain-soaked Chinatown. Narrow low shopfronts, red lanterns, glossy road.
  3: {
    name: 'Chinatown rain',
    look: {
      exposure: 1.7, saturation: 1.2, contrast: 1.0, vignette: 0.7,
      bloomStrength: 0.85, bloomRadius: 0.8, bloomThreshold: 1.0,
      sunIntensity: 1.4, sunColor: '#6fa8b8', sunAzimuth: -50, sunElevation: 55,
      hemiIntensity: 0.95, hemiSky: '#8cc4cc', hemiGround: '#1c2a30',
      lampLight: 40, lampPool: 0.5, neonLight: 80, windows: 1.3, neonSigns: 1.9, underglow: 0.8, fogDensity: 0.0074,
      roadWet: 1.35, roadDark: 0.3, fresnelEdge: 0.9, dampSheen: 0.45, walkWet: 0.5,
    },
    sky: { horizon: 0x22444c, zenith: 0x04101a, band: 0xd0384a },
    lamp: 0xff8a58, pool: 0xff9a70,
    neon: [0xff3a48, 0x38e0d0, 0xffc040, 0xe040a0],
    tint: { upper: 0xaed0d0, ground: 0xffc8c0, tower: 0x90b0b8, road: 0x8a98a0, walk: 0x8a98a8, win: 0xffc070, neon: 0xffd0d0, yellow: 0xffc42e, white: 0xd8e4e4, base: 0x0e1418 },
    kit: { floors: [3, 7], width: [6, 12], gap: 0.05, setback: 0, towers: 0.15, towerH: [30, 60], ground: 4.8, backdrop: 'city', props: ['lanterns'], propChance: 0.75, lampEvery: 20 },
  },

  // 4 ON OUR TAIL: the docks. Low wide warehouses, container lots, cranes, sodium light.
  4: {
    name: 'Docks',
    look: {
      exposure: 1.6, saturation: 1.0, contrast: 1.08, vignette: 0.6,
      bloomStrength: 0.7, bloomThreshold: 1.05,
      sunIntensity: 2.8, sunColor: '#9cc2ff', sunAzimuth: -40, sunElevation: 38,
      hemiIntensity: 1.0, hemiSky: '#a8c0d8', hemiGround: '#2a2c32',
      lampLight: 85, lampPool: 0.62, neonLight: 30, windows: 0.5, neonSigns: 0.35, underglow: 0.7, fogDensity: 0.0046,
      roadWet: 0.75, roadDark: 0.22, fresnelEdge: 0.6, dampSheen: 0.3, walkWet: 0.2,
    },
    sky: { horizon: 0x56708a, zenith: 0x0a1220, band: 0xe09050 },
    lamp: 0xffa040, pool: 0xffa860,
    neon: [0xffa040, 0xd8d8e0, 0xff7030, 0x60b0e0],
    tint: { upper: 0xa4aeb8, ground: 0xb4b4b0, tower: 0x8892a0, road: 0x8e9098, walk: 0x9a9aa0, win: 0xffd8a0, neon: 0xffe0b0, yellow: 0xffd02e, white: 0xe0e0e0, base: 0x14161c },
    kit: { floors: [1, 3], width: [18, 40], gap: 0.45, gapLen: [14, 34], setback: 0.4, towers: 0, ground: 5.2, lampEvery: 36, vents: false, props: ['crane'], propChance: 0.18, lot: 'containers', backdrop: 'docks' },
  },

  // 5 BOSS RUN: the Foot Clan's district. Red sky, black towers, banners and spikes.
  5: {
    name: 'Foot Clan district',
    look: {
      exposure: 1.5, saturation: 1.15, contrast: 1.1, vignette: 0.8,
      bloomStrength: 0.95, bloomRadius: 0.9, bloomThreshold: 1.0,
      sunIntensity: 2.4, sunColor: '#ff5a40', sunAzimuth: -55, sunElevation: 28,
      hemiIntensity: 0.95, hemiSky: '#ff8a7a', hemiGround: '#2a0a12',
      lampLight: 60, lampPool: 0.5, neonLight: 70, windows: 1.1, neonSigns: 1.4, underglow: 0.8, fogDensity: 0.0056,
      roadWet: 0.9, roadDark: 0.3, fresnelEdge: 0.7, dampSheen: 0.3, walkWet: 0.25,
      footRacer: '#b070ff', footTruck: '#9a78d0', footGlow: '#2a0a40', footRim: 2.4, footRimColor: '#ff9cf0',
    },
    sky: { horizon: 0x7a1c26, zenith: 0x14040a, band: 0xff4a28 },
    lamp: 0xff4a38, pool: 0xff5a48,
    neon: [0xff2a30, 0xff6030, 0xc01040, 0xff9040],
    tint: { upper: 0x8a6068, ground: 0xff9088, tower: 0x6a4850, road: 0x8a6c74, walk: 0x8a6a74, win: 0xff7050, neon: 0xff9080, yellow: 0xff5a2e, white: 0xf0d0c8, base: 0x12060a },
    kit: { floors: [4, 10], width: [7, 14], gap: 0.1, setback: 0.1, towers: 0.55, towerH: [45, 100], props: ['banners', 'spikes'], propChance: 0.6, backdrop: 'pagodas' },
  },

  // 6 TECHNODROME: streets lit by something alien. Green and violet, glowing pylons, and the
  // Technodrome itself growing on the horizon as you close in.
  6: {
    name: 'Technodrome approach',
    look: {
      exposure: 1.4, saturation: 1.1, contrast: 1.1, vignette: 0.8,
      bloomStrength: 0.8, bloomRadius: 0.8, bloomThreshold: 1.05,
      sunIntensity: 2.6, sunColor: '#80ffb4', sunAzimuth: -45, sunElevation: 35,
      hemiIntensity: 1.0, hemiSky: '#9cffd0', hemiGround: '#1c1040',
      lampLight: 50, lampPool: 0.45, neonLight: 60, windows: 0.95, neonSigns: 1.0, underglow: 0.9, fogDensity: 0.0050,
      roadWet: 1.0, roadDark: 0.3, fresnelEdge: 0.8, dampSheen: 0.35, walkWet: 0.3,
      footRacer: '#c860ff', footTruck: '#a880e0', footGlow: '#2a1050', footRim: 2.2, footRimColor: '#ff80e0',
    },
    sky: { horizon: 0x1c6a56, zenith: 0x120a3c, band: 0x40ffa0 },
    lamp: 0x78ffb0, pool: 0x80ffc0,
    neon: [0x40ffa0, 0xa060ff, 0x40e0ff, 0xff60d0],
    tint: { upper: 0x90a8b0, ground: 0xa0ffd8, tower: 0x7088a0, road: 0x7c8a94, walk: 0x7c8c9c, win: 0x60ffb0, neon: 0xa0ffd0, yellow: 0x70ff90, white: 0xd0f0e8, base: 0x080c14 },
    kit: { floors: [3, 9], width: [10, 22], gap: 0.12, towers: 0.35, towerH: [40, 85], props: ['pylons'], propChance: 0.55, backdrop: 'techno' },
  },
};

export const envFor = (n) => {
  const e = ENVS[n] || ENVS[1];
  return { ...e, kit: { ...KIT_DEFAULT, ...e.kit } };
};
