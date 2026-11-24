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
  leo: svg('<circle cx="24" cy="25" r="20" fill="#5fb24a" stroke="#14210f" stroke-width="3"/><path d="M4 18c6-4 34-4 40 0l-1 11c-6 4-32 4-38 0z" fill="#2f7be0" stroke="#14210f" stroke-width="2.5"/><ellipse cx="16" cy="23.5" rx="5" ry="4" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23.5" rx="5" ry="4" fill="#fff" stroke="#14210f" stroke-width="2"/><circle cx="17" cy="24" r="1.9" fill="#14210f"/><circle cx="31" cy="24" r="1.9" fill="#14210f"/>'),
  // A plain shield: the shell shield ability.
  shield: svg('<path d="M24 4 41 10v12c0 11-7 18-17 22C14 40 7 33 7 22V10z"/>'),
  // A round grenade with arrows pulling in: Donatello's gravity grenades.
  donnie: svg('<circle cx="24" cy="25" r="20" fill="#5fb24a" stroke="#14210f" stroke-width="3"/><path d="M4 18c6-4 34-4 40 0l-1 11c-6 4-32 4-38 0z" fill="#8a4fd6" stroke="#14210f" stroke-width="2.5"/><ellipse cx="16" cy="23.5" rx="5" ry="4" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23.5" rx="5" ry="4" fill="#fff" stroke="#14210f" stroke-width="2"/><circle cx="17" cy="24" r="1.9" fill="#14210f"/><circle cx="31" cy="24" r="1.9" fill="#14210f"/><path d="M30 40q6-2 9 1" fill="none" stroke="#14210f" stroke-width="2.4" stroke-linecap="round"/>'),
  // Two sticks on a chain with a cone of light: Michelangelo's nunchucks stun a lane.
  mikey: svg('<circle cx="24" cy="25" r="20" fill="#5fb24a" stroke="#14210f" stroke-width="3"/><path d="M4 18c6-4 34-4 40 0l-1 11c-6 4-32 4-38 0z" fill="#ff7a1a" stroke="#14210f" stroke-width="2.5"/><ellipse cx="16" cy="23.5" rx="5" ry="4" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23.5" rx="5" ry="4" fill="#fff" stroke="#14210f" stroke-width="2"/><circle cx="17" cy="24" r="1.9" fill="#14210f"/><circle cx="31" cy="24" r="1.9" fill="#14210f"/>'),
  // Three blades on a ring: spinning blades.
  orbit: svg('<circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/><circle cx="24" cy="24" r="5"/>' +
    '<path d="M24 1l5 9H19z"/><path d="M45 36l-10 1 4-9z" transform="rotate(0)"/><path d="M3 36l10 1-4-9z"/>'),
  // A blast ring around a core: shell shock.
  burst: svg('<circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="4"/>' +
    '<path d="M24 1v6M24 41v6M1 24h6M41 24h6M8 8l4 4M36 36l4 4M40 8l-4 4M12 36l-4 4" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
  dash: svg('<path d="M4 24h22M8 14h18M8 34h18" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".6"/><path d="M26 8l18 16-18 16V28H18V20h8z"/>'),
  caltrop: svg('<path d="M24 4l5 14-5 4-5-4zM6 34l14-5 2 6-6 5zM42 34l-14-5-2 6 6 5z"/><circle cx="24" cy="26" r="5"/>'),
  shellboom: svg('<ellipse cx="24" cy="24" rx="16" ry="13"/><path d="M24 11v26M10 18l28 12M38 18 10 30" stroke="#000" stroke-width="2.5" opacity=".35"/><path d="M4 12c6-8 14-9 20-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".6"/>'),
  decoy: svg('<path d="M6 18l18-8 18 8v18l-18 8-18-8z"/><path d="M24 10v34M6 18l18 8 18-8" stroke="#000" stroke-width="2.5" opacity=".35" fill="none"/><circle cx="24" cy="26" r="4" fill="#d6242c"/>'),
  arc: svg('<path d="M20 2 8 26h10l-4 20 22-28H24l6-16z"/><path d="M36 8l8 4-6 6M10 40l-6-3 5-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/>'),
  vortex: svg('<path d="M24 6a18 18 0 1 1-16 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M24 14a10 10 0 1 1-9 5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".75"/><circle cx="24" cy="24" r="3.5"/>'),
  frost: svg('<path d="M24 3v42M5 14l38 20M5 34l38-20" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><circle cx="24" cy="24" r="5"/>'),
  rush: svg('<path d="M24 3C32 14 38 20 38 30a14 14 0 0 1-28 0c0-6 3-9 6-13 1 5 3 7 5 8 0-8-1-14 3-22z"/><path d="M24 42a6 6 0 0 1-6-6c0-3 3-5 6-9 3 4 6 6 6 9a6 6 0 0 1-6 6z" fill="#000" opacity=".25"/>'),
  // A heart: more health.
  hearts: svg('<path d="M24 43C8 31 3 22 3 14 3 8 8 4 13 4c5 0 8 3 11 7 3-4 6-7 11-7 5 0 10 4 10 10 0 8-5 17-21 29z"/>'),
};

/** An icon for any key, with a plain fallback so a missing one is visible but not fatal. */
export const iconFor = (key) => ICONS[key] || svg('<circle cx="24" cy="24" r="16"/>');
