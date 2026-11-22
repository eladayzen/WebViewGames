// WHAT EACH ROOM LOOKS LIKE AND HOW IT PLAYS: a theme (the floor and the mood)
// and a layout (what you cannot walk through).
//
// Elad, 22 Nov: "every time I finish and start a new one it feels underwhelming
// ... always the same". The enemies change from room to room, but the PLACE did
// not, and the place is most of the screen.
//
// A THEME IS THE FLOOR PAINTING PLUS A GRADE. The plaza floor is one painted
// image with its medallion baked in, so a room cannot have a tiled variant of
// it; it has a different painting. Two paintings exist. Tinting the floor's
// material multiplies it, which is free in memory and enough to make the same
// stone read as dusk, ember or moss. Real new paintings slot into this table
// later without touching anything else.
//
// A LAYOUT IS A SET OF OBSTACLES (core/obstacles.js), authored RELATIVE TO THE
// CENTRE so the same shapes survive a change of arena size. Every one leaves the
// centre clear -- that is where you start -- and leaves gaps wide enough for the
// BIGGEST enemy, because a layout a giant cannot cross is a room it cannot
// reach you in. test/looks.test.mjs proves that with a flood fill rather than
// asking anyone to trust the numbers.
//
//   ?theme=dusk  ?layout=pillars   force one, to look at it without clearing rooms
import { ARENA } from './world.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

/**
 * `floor` names a painting in render/floors.js. `tint` multiplies it. `fog` is
 * also the background colour, so it sets the value of every pixel the floor
 * does not cover. `props` colours the colonnade, the kerb and the obstacles.
 * `ring` is the live glow on the painted rune ring, or null for a floor that
 * has none.
 */
export const THEMES = {
  warm:  { label: 'Sandstone plaza', floor: 'warm',  tint: 0xffffff, fog: 0x8d94a0, apron: 0x8a8070, props: 0xc6b89d, ring: { color: 0x3ce6a0 } },
  dusk:  { label: 'Dusk plaza',      floor: 'warm',  tint: 0xcdbcec, fog: 0x7d7396, apron: 0x6d6482, props: 0xb7a6cc, ring: { color: 0xff7ad9 } },
  sewer: { label: 'Sewer',           floor: 'sewer', tint: 0xffffff, fog: 0x72897a, apron: 0x5f7060, props: 0xa3b09c, ring: null },
  roof:  { label: 'Rooftop',         floor: 'roof',  tint: 0xffffff, fog: 0x9aa1ad, apron: 0x707178, props: 0xbab5a8, ring: null },
  tech:  { label: 'Tech base',       floor: 'tech',  tint: 0xffffff, fog: 0x7f93aa, apron: 0x5e6c7c, props: 0xaab7c6, ring: null },
  // KEPT FOR LATER AND IN NO ROOM'S ROTATION. Its painted steps are the thing
  // Elad rejected ("we should not do anything with height depth"); it is here
  // only so ?theme=stone can still show it.
  stone: { label: 'Grey dais (not used)', floor: 'stone', tint: 0xffffff, fog: 0x8d94a0, apron: 0x8a8070, props: 0xb8b3ac, ring: { color: 0x3ce6a0 } },
};

// Offsets from the arena centre, in sim pixels. Player radius is 42 and the
// biggest enemy 115, so every gap is at least 300 wide.
const PILLAR = (x, y, r = 70) => ({ kind: 'circle', x, y, r, tall: true });
const RUBBLE = (x, y, r) => ({ kind: 'circle', x, y, r, tall: false });
const WALL = (x, y, hw, hh) => ({ kind: 'rect', x, y, hw, hh, tall: true });

export const LAYOUTS = {
  open: { label: 'Open floor', shapes: [] },
  pillars: {
    label: 'Pillars',
    shapes: [
      PILLAR(-640, -640, 72), PILLAR(640, -640, 72), PILLAR(-640, 640, 72), PILLAR(640, 640, 72),
      PILLAR(0, -1050, 62), PILLAR(0, 1050, 62), PILLAR(-1050, 0, 62), PILLAR(1050, 0, 62),
    ],
  },
  barricade: {
    label: 'Barricades',
    shapes: [WALL(0, -560, 760, 46), WALL(0, 560, 760, 46)],
  },
  ruins: {
    label: 'Ruins',
    shapes: [
      RUBBLE(-900, -300, 70), RUBBLE(-560, 720, 85), RUBBLE(420, -880, 60), RUBBLE(980, 260, 78),
      RUBBLE(300, 640, 55), RUBBLE(-1180, 640, 66), RUBBLE(740, -420, 50), RUBBLE(-300, -1000, 72),
      RUBBLE(1180, -1000, 64),
    ],
  },
  cross: {
    label: 'The cross',
    shapes: [WALL(-860, 0, 330, 44), WALL(860, 0, 330, 44), WALL(0, -860, 44, 330), WALL(0, 860, 44, 330)],
  },
};

/** The obstacles of a layout, in absolute arena coordinates. */
export function layoutObstacles(key) {
  const l = LAYOUTS[key] || LAYOUTS.open;
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  return l.shapes.map((s) => ({ ...s, x: s.x + cx, y: s.y + cy }));
}

// Five distinct looks, so within any five rooms no two are alike. On level one
// the LAST room is the cross on the tech floor: the most closed-in, for the boss.
// Four paintings serve five rooms: the plaza is used twice, once graded to dusk.
// NOTHING HERE MAY USE THE GREY DAIS (see the note on THEMES.stone).
const SEQUENCE = [
  { theme: 'warm',  layout: 'open' },
  { theme: 'sewer', layout: 'pillars' },
  { theme: 'dusk',  layout: 'ruins' },
  { theme: 'roof',  layout: 'barricade' },
  { theme: 'tech',  layout: 'cross' },
];

/**
 * Every floor painting the build has to load: those the rooms use, plus the one
 * a `?theme=` override asks for. Loading only these keeps the grey dais -- which
 * no room uses -- out of memory.
 */
export function usedFloors() {
  const keys = new Set(SEQUENCE.map((s) => THEMES[s.theme].floor));
  const forced = THEMES[QS.get('theme')];
  if (forced) keys.add(forced.floor);
  return [...keys];
}

/**
 * The look of room `roomIdx` (0-based) on `level` (1-based).
 *
 * LATER LEVELS START PARTWAY ROUND, two steps on, so level two does not open
 * on the same plaza level one did. Consecutive rooms are always different
 * because the sequence is five distinct entries.
 */
export function lookFor(level, roomIdx) {
  const i = (roomIdx + (level - 1) * 2) % SEQUENCE.length;
  const base = SEQUENCE[i];
  const theme = THEMES[QS.get('theme')] ? QS.get('theme') : base.theme;
  const layout = LAYOUTS[QS.get('layout')] ? QS.get('layout') : base.layout;
  return { theme, layout };
}
