// Special-ability pickups -- direct feedback: "I want us to build 2 pickups.
// One is magnating only the gold coins to you. And the second is pick up live."
//
// Both abilities already EXISTED as scaffolding with nothing to grant them:
// entities/player.js's grantMagnet (the coin pull in entities/coins.js's
// applyMagnetPull) and systems/lives.js's gainLife. So this file adds no new
// mechanics at all -- it's the falling-into-the-world half that was missing.
//
// Same data-driven shape as data/coinTypes.js / data/enemyTypes.js: everything
// entities/pickups.js needs to draw and resolve one is a row here.
//
// `effect` is what core/main.js dispatches on. `draw` paints the icon onto the
// shared 96px glow backing (entities/pickups.js's makePickupTexture) -- kept in
// the data file so adding a third pickup is one row here and nothing else.

// World-space diameter. Roughly twice a common coin (0.72) -- these are rare
// and run-changing, and should read as an event from a long way off rather
// than as "a slightly bigger coin".
const PICKUP_SIZE = 1.5;

// Icons are drawn into a unit square (0..1 in both axes) and scaled to the
// texture by the caller, so these stay resolution-independent.
function drawMagnet(ctx, s) {
  // Classic horseshoe: a thick 180-degree arc with two straight legs. Red body
  // + steel tips is the universally-read magnet, and neither colour collides
  // with anything else on screen (coins are gold/cyan, hearts red-PINK below,
  // enemies purple).
  const cx = 0.5 * s;
  const r = 0.26 * s;
  const w = 0.15 * s;
  const legTop = 0.46 * s;
  const legBottom = 0.74 * s;

  ctx.lineCap = 'butt';
  ctx.lineWidth = w;

  ctx.strokeStyle = '#e8402f';
  ctx.beginPath();
  ctx.arc(cx, legTop, r, Math.PI, 0);
  ctx.stroke();

  // Legs, drawn after the arc so their square ends sit flush against it.
  ctx.beginPath();
  ctx.moveTo(cx - r, legTop);
  ctx.lineTo(cx - r, legBottom - 0.09 * s);
  ctx.moveTo(cx + r, legTop);
  ctx.lineTo(cx + r, legBottom - 0.09 * s);
  ctx.stroke();

  // Steel pole tips.
  ctx.strokeStyle = '#dfe6ec';
  ctx.beginPath();
  ctx.moveTo(cx - r, legBottom - 0.09 * s);
  ctx.lineTo(cx - r, legBottom);
  ctx.moveTo(cx + r, legBottom - 0.09 * s);
  ctx.lineTo(cx + r, legBottom);
  ctx.stroke();

  // Highlight along the top of the arc -- the cue that reads as "metal" and
  // keeps the silhouette from looking like a flat sticker.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.03 * s;
  ctx.beginPath();
  ctx.arc(cx, legTop, r + w * 0.28, Math.PI * 1.12, Math.PI * 1.62);
  ctx.stroke();
}

function drawHeart(ctx, s) {
  // Two lobes + a point, as one filled path.
  const cx = 0.5 * s;
  const top = 0.28 * s;
  const bottom = 0.76 * s;
  const lobe = 0.145 * s;

  ctx.beginPath();
  ctx.moveTo(cx, bottom);
  ctx.bezierCurveTo(cx - 0.30 * s, 0.52 * s, cx - 0.30 * s, top, cx - lobe, top);
  ctx.bezierCurveTo(cx - 0.045 * s, top, cx, 0.36 * s, cx, 0.40 * s);
  ctx.bezierCurveTo(cx, 0.36 * s, cx + 0.045 * s, top, cx + lobe, top);
  ctx.bezierCurveTo(cx + 0.30 * s, top, cx + 0.30 * s, 0.52 * s, cx, bottom);
  ctx.closePath();

  ctx.fillStyle = '#ff3b5c';
  ctx.fill();
  ctx.lineWidth = 0.035 * s;
  ctx.strokeStyle = '#8c0f24';
  ctx.stroke();

  // Specular blob on the left lobe -- same job as the magnet's highlight.
  ctx.beginPath();
  ctx.ellipse(cx - 0.115 * s, 0.40 * s, 0.055 * s, 0.075 * s, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

export const PICKUP_TYPES = {
  // Timed coin magnet. Duration is MAGNET_DURATION_SEC (data/constants.js).
  magnet: {
    effect: 'magnet',
    size: PICKUP_SIZE,
    // Tint of the soft glow BEHIND the icon (the icon itself is drawn in its
    // own colours). Cool blue-white reads as "powered" and stays distinct from
    // the life pickup's warm red halo at a distance, which matters -- these two
    // are the same silhouette size and a player should know which one is
    // arriving before it's close enough to see the icon.
    glow: 0x7fd8ff,
    draw: drawMagnet,
  },
  // One life back, up to LIVES_SOFTCAP. Deliberately the rarest thing in the
  // game (data/spawnConfig.js's PICKUP_LIFE_SPAWN_CHANCE, plus it only rolls at
  // all while the player is actually missing a life).
  life: {
    effect: 'life',
    size: PICKUP_SIZE,
    glow: 0xff8fa3,
    draw: drawHeart,
  },
};
