// THE ROOM ICON: a DOOR (Elad, 24 Nov: a pizza for a room "makes no sense"). One arched sewer door per
// room, drawn four ways so the road reads at a glance with no words:
//
//   todo  a shut, dull door         here  a shut door that glows, with a bright handle
//   done  the door standing open    boss  a bigger red iron door with a skull on it
//
// Inline SVG, 40 x 52, chunky outlines like the rest of the UI.
const INK = '#14210f';

export function doorIcon(state = 'todo') {
  const arch = `<path d="M5 50V20a15 15 0 0 1 30 0v30z" fill="#b9b2a0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const leaf = (fill, plank) =>
    `<path d="M10 50V21a10 10 0 0 1 20 0v29z" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M20 11v39M10.5 30h19" stroke="${plank}" stroke-width="2" opacity=".7"/>`;
  let inner;
  if (state === 'done') {
    // open: a dark doorway with the leaf swung back against the left side
    inner = `<path d="M10 50V21a10 10 0 0 1 20 0v29z" fill="#0f1a12"/><path d="M14 46V24" stroke="#3ce6a0" stroke-width="2" opacity=".5"/>` +
      `<path d="M10 50V22.5l7-3.5v31z" fill="#8a5a2b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  } else if (state === 'here') {
    inner = leaf('#c98a3c', '#7a4a16') + `<circle cx="26" cy="33" r="3.2" fill="#ffe27a" stroke="${INK}" stroke-width="1.6"/>`;
  } else if (state === 'boss') {
    inner = leaf('#a3242b', '#5c1015') +
      `<circle cx="20" cy="27" r="6" fill="#f3efe0" stroke="${INK}" stroke-width="2"/><rect x="16.5" y="31" width="7" height="4.5" rx="1.5" fill="#f3efe0" stroke="${INK}" stroke-width="1.8"/>` +
      `<circle cx="17.8" cy="26.5" r="1.5" fill="${INK}"/><circle cx="22.2" cy="26.5" r="1.5" fill="${INK}"/>`;
  } else {
    inner = leaf('#6f6a60', '#4a463e') + `<circle cx="26" cy="33" r="2.6" fill="#a8a294" stroke="${INK}" stroke-width="1.4"/>`;
  }
  const dim = state === 'todo' ? ' opacity=".8"' : '';
  return `<svg class="door door-${state}" viewBox="0 0 40 52" aria-hidden="true"${dim}>${arch}${inner}</svg>`;
}
