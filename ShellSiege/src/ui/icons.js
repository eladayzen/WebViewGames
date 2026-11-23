// ONE ICON PER ABILITY, as inline SVG.
//
// Not emoji. The Nova Vanguard session shipped its pause and shield icons as
// SVG after emoji characters rendered differently on every device they were
// tried on, and a WebView on a balance board's tablet is the worst place to
// find out which font it has. Drawn in `currentColor`, so the card decides
// the colour and the icon never has to.
//
// 48x48, chunky shapes, no thin strokes: this is seen at about a metre, by a
// child, for under a second.
const svg = (body) =>
  `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">${body}</svg>`;

export const ICONS = {
  // A four-point ninja star: stars.
  stars: svg('<path d="M24 2l5 15 15 5-15 5-5 15-5-15L4 22l15-5z"/><circle cx="24" cy="22" r="4" fill="#000" opacity=".4"/>'),
  // The star with speed lines: star flurry.
  starrate: svg('<path d="M30 6l4 11 11 4-11 4-4 11-4-11-11-4 11-4z"/><rect x="2" y="14" width="14" height="4" rx="2" opacity=".7"/><rect x="2" y="24" width="18" height="4" rx="2" opacity=".7"/><rect x="2" y="34" width="14" height="4" rx="2" opacity=".7"/>'),
  // Three small stars fanned: star spread.
  starsplit: svg('<path d="M24 4l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M10 28l2.5 6.5L19 37l-6.5 2.5L10 46l-2.5-6.5L1 37l6.5-2.5z" opacity=".8"/><path d="M38 28l2.5 6.5L47 37l-6.5 2.5L38 46l-2.5-6.5L29 37l6.5-2.5z" opacity=".8"/>'),
  // A lightning bolt: faster.
  rapid: svg('<path d="M28 3 10 27h12l-4 18 20-26H26z"/>'),
  // Three separate blades fanned from one point: more of them. Each is its own
  // kite shape with air between them -- the first attempt overlapped them and
  // read as a crown.
  multi: svg(
    '<path d="M24 3l6.5 15L24 36l-6.5-18z"/>' +
    '<path d="M24 3l6.5 15L24 36l-6.5-18z" transform="rotate(-34 24 44)"/>' +
    '<path d="M24 3l6.5 15L24 36l-6.5-18z" transform="rotate(34 24 44)"/>'),
  // A starburst: it hits harder.
  damage: svg('<path d="M24 2l5 13 13-5-6 12 11 6-12 4 4 13-12-7-6 12-3-14-13 3 8-11L3 20l14-1-3-14 10 8z"/>'),
  // An arrow straight through a bar.
  pierce: svg(
    '<rect x="26" y="8" width="8" height="32" rx="3" opacity=".55"/>' +
    '<rect x="4" y="21" width="30" height="6" rx="3"/>' +
    '<path d="M32 12l14 12-14 12z"/>'),
  // An arrow reaching out of a ring: further.
  reach: svg(
    '<circle cx="13" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="5"/>' +
    '<rect x="18" y="21.5" width="16" height="5" rx="2.5"/>' +
    '<path d="M32 11l14 13-14 13z"/>'),
  // Two chevrons: faster on your feet. (A wing read as a leaf.)
  swift: svg(
    '<path d="M3 8l16 16L3 40h10l16-16L13 8z"/>' +
    '<path d="M19 8l16 16-16 16h10l16-16L29 8z" opacity=".65"/>'),
  // Two crossed blades: Leonardo.
  leo: svg(
    '<path d="M6 40 34 8l5 4L12 44z"/><path d="M42 40 14 8 9 12l27 32z" opacity=".8"/>' +
    '<rect x="3" y="36" width="12" height="6" rx="2" transform="rotate(-50 9 39)"/><rect x="33" y="36" width="12" height="6" rx="2" transform="rotate(50 39 39)"/>'),
  // A plain shield: the shell shield ability.
  shield: svg('<path d="M24 4 41 10v12c0 11-7 18-17 22C14 40 7 33 7 22V10z"/>'),
  // A round grenade with arrows pulling in: Donatello's gravity grenades.
  donnie: svg(
    '<circle cx="24" cy="26" r="11"/><rect x="20" y="8" width="8" height="7" rx="2"/>' +
    '<path d="M3 24h9l-4-5zM45 24h-9l4-5zM24 45v-7l-5 3z" opacity=".7"/>'),
  // Two sticks on a chain with a cone of light: Michelangelo's nunchucks stun a lane.
  mikey: svg(
    '<rect x="3" y="30" width="18" height="6" rx="3" transform="rotate(-50 12 33)"/>' +
    '<rect x="20" y="9" width="6" height="16" rx="3" transform="rotate(35 23 17)"/>' +
    '<path d="M26 26 46 14v12z" opacity=".8"/><path d="M26 26 46 26v12z" opacity=".5"/>'),
  // A heart: more health.
  hearts: svg('<path d="M24 43C8 31 3 22 3 14 3 8 8 4 13 4c5 0 8 3 11 7 3-4 6-7 11-7 5 0 10 4 10 10 0 8-5 17-21 29z"/>'),
};

/** An icon for any key, with a plain fallback so a missing one is visible but not fatal. */
export const iconFor = (key) => ICONS[key] || svg('<circle cx="24" cy="24" r="16"/>');
