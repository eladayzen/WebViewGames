// WHAT THE THING YOU ARE BEING SENT AFTER LOOKS LIKE.
//
// Amit: "in the first few missions, when we introduce new items every mission,
// can we have in the opening popup with the objective some icon or
// representation of them?"
//
// The teaching missions each introduce exactly one thing, and until now the
// card announced it in words only -- HIT RAMPS, RIDE RAILS, COLLECT CRYSTALS.
// That is fine for a player who already knows what a rail looks like on this
// hill and useless for the one who does not, which is precisely the player a
// teaching mission is for. A word tells you the name of a thing; a picture
// tells you what to look for, and looking for it is the entire task.
//
// COLOUR COMES FROM PROP_TYPES, never from a value typed in here. The icon's
// only job is to be recognised on the road three seconds later, so if a prop is
// recoloured -- and the ramps and the idol both were this week -- the icon has
// to follow it in the same commit or it starts lying. Shape is drawn by hand
// because a silhouette is not something the data carries.

import { PROP_TYPES } from '../data/propTypes.js';

const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, '0')}`;

/** A prop's colours, or a neutral fallback if the type ever goes away. */
function colours(type, fallback = 0x9b6bff, fallbackAccent = 0xffffff) {
  const def = PROP_TYPES[type];
  return {
    main: hex(def && def.colour != null ? def.colour : fallback),
    accent: hex(def && def.accent != null ? def.accent : fallbackAccent),
  };
}

/**
 * Each icon is drawn in a 40x32 box, in the same three-quarter-ish view the
 * player sees from behind the rider -- not a flat plan view. A ramp seen from
 * above is a rectangle and tells you nothing; seen from behind it is a wedge,
 * which is the shape you actually scan the road for.
 */
const BOX = 'viewBox="0 0 40 32" width="40" height="32"';

function rampIcon() {
  const c = colours('kicker');
  return `<svg ${BOX} aria-hidden="true">
    <path d="M4 27 L30 27 L30 9 Z" fill="${c.main}"/>
    <path d="M30 9 L30 27 L36 27 L36 12 Z" fill="${c.accent}"/>
    <rect x="3" y="27" width="34" height="2.5" rx="1.2" fill="${c.accent}" opacity="0.7"/>
  </svg>`;
}

function railIcon() {
  const c = colours('rail');
  return `<svg ${BOX} aria-hidden="true">
    <rect x="3" y="12" width="34" height="3.4" rx="1.7" fill="${c.main}"/>
    <rect x="7" y="15" width="3" height="13" rx="1.5" fill="${c.accent}"/>
    <rect x="30" y="15" width="3" height="13" rx="1.5" fill="${c.accent}"/>
    <rect x="3" y="28" width="34" height="2" rx="1" fill="${c.accent}" opacity="0.55"/>
  </svg>`;
}

function crystalIcon() {
  const c = colours('crystal');
  // A cut gem, so it reads as something to collect rather than as scenery.
  return `<svg ${BOX} aria-hidden="true">
    <path d="M20 3 L30 13 L20 29 L10 13 Z" fill="${c.main}"/>
    <path d="M20 3 L30 13 L20 13 Z" fill="${c.accent}" opacity="0.85"/>
    <path d="M20 13 L30 13 L20 29 Z" fill="${c.accent}" opacity="0.35"/>
  </svg>`;
}

function idolIcon() {
  /**
   * DARK STONE WITH AN AMBER FACE, which is what the statue actually is
   * (colour 0x2e2338, accent 0xffb43c). A first pass drew it as a solid amber
   * gem and it came out looking exactly like the crystal -- which is the one
   * confusion this icon exists to prevent, since one mission asks for
   * twenty-five crystals and another for seven idols.
   *
   * A TOTEM SILHOUETTE rather than a gem: taller than it is wide, standing on a
   * base. Shape carries the difference as well as colour, so it still reads on
   * a dim board screen where the two ambers would be hard to tell apart.
   */
  const c = colours('statue');
  return `<svg ${BOX} aria-hidden="true">
    <path d="M20 2 L26 8 L26 24 L14 24 L14 8 Z" fill="${c.main}"/>
    <path d="M20 6 L23 10 L23 17 L17 17 L17 10 Z" fill="${c.accent}"/>
    <circle cx="20" cy="20" r="1.8" fill="${c.accent}" opacity="0.8"/>
    <rect x="11" y="24" width="18" height="4" rx="1.5" fill="${c.main}"/>
    <rect x="11" y="24" width="18" height="1.4" rx="0.7" fill="${c.accent}" opacity="0.5"/>
  </svg>`;
}

function gateIcon() {
  const c = colours('airGate');
  // The arch you ride THROUGH, which is the thing to recognise -- two posts and
  // a span, not a pad on the floor.
  return `<svg ${BOX} aria-hidden="true">
    <path d="M7 29 L7 12 Q20 3 33 12 L33 29" fill="none" stroke="${c.main}" stroke-width="4"
      stroke-linecap="round"/>
    <path d="M15 20 L20 15 L25 20" fill="none" stroke="${c.accent}" stroke-width="2.6"
      stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15 26 L20 21 L25 26" fill="none" stroke="${c.accent}" stroke-width="2.6"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
  </svg>`;
}

function scoreIcon() {
  // Score has no prop, so this is the one icon that cannot come from the world.
  // A star, matching the results screen's own currency.
  return `<svg ${BOX} aria-hidden="true">
    <path d="M20 4 L24 15 L36 15 L26 22 L30 30 L20 24 L10 30 L14 22 L4 15 L16 15 Z"
      fill="#ffd166"/>
  </svg>`;
}

const ICONS = {
  launch: rampIcon,
  grind: railIcon,
  boost: gateIcon,
  score: scoreIcon,
  crystal: crystalIcon,
  idol: idolIcon,
};

/**
 * @param {string} kind an objective kind
 * @param {string} [type] the pickup type, where the kind alone is ambiguous
 * @returns {string} inline SVG, or '' when there is nothing sensible to draw
 *
 * Pickups are keyed by TYPE rather than kind: a crystal and an idol are the
 * same kind and are the two things a player most needs told apart, since one
 * mission asks for twenty-five of one and another for seven of the other.
 */
export function iconFor(kind, type) {
  const make = ICONS[kind === 'pickup' ? (type || 'crystal') : kind];
  return make ? make() : '';
}
