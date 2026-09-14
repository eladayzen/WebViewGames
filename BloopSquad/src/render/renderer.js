// POC renderer: everything is drawn from code, matching the locked concept-09
// art frame (`pipeline/macro-briefs/approved/bloop-squad/concepts/`).
//
// STILL PLACEHOLDER, but no longer a stand-in shape: these are the concept's
// actual silhouettes -- gummy blobs with a wavy hem, thick dark outlines, a
// gloss highlight, big eyes with catchlights, cream horns and fangs; a silver
// saucer with a glass dome and a blue thruster. Real sprites replace the
// drawing code behind the same silhouettes and sizes later, and getting the
// silhouettes right NOW is what makes that swap a swap rather than a redesign.
//
// The one thing deliberately not taken from the frame: colour still encodes
// SIZE (green small / orange medium / purple large) rather than varying freely
// as it does in the concept. A child reading "how tough is that one" off its
// colour is worth more than palette variety, and the concept is a mood board,
// not a spec for that.

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { DESIGN_W, DESIGN_H, CAMERA, PLAYER, BULLETS, COINS, MONSTERS, TOYS, difficulty01 } from '../data/tuning.js';

const PALETTE = {
  bg: 0x0b1020,
  star: 0xffffff,
  outline: 0x131a2b,
  // Saucer: a light hull with a darker underside, so it reads as metal.
  hull: 0xdfe6f0,
  hullShade: 0x96a3b8,
  dome: 0x8fd4ff,
  pilot: 0xf5a623,
  pilotShade: 0xd88712,
  horn: 0xf7e7c6,
  hornShade: 0xd9c299,
  eye: 0xffffff,
  pupil: 0x14213d,
  mouth: 0x6d1f2c,
  fang: 0xffffff,
  thruster: 0x8fd4ff,
  // Pale near-white, moved off the wand's 0x74d7ff now that base shots and wand
  // bubbles share the screen: two streams in the same blue would read as one.
  bullet: 0xe8f6ff,
  coin: 0xffc93c,
  coinShade: 0xd99a12,
  heart: 0xff6b6b,
};

// Confetti in the concept is mixed colours, not the dead monster's tint.
const CONFETTI = [0x7ed321, 0xf5a623, 0x9b59d0, 0x74d7ff, 0xff6b6b, 0xffc93c];

export async function createRenderer(canvas) {
  const app = new Application();
  await app.init({
    canvas,
    width: DESIGN_W,
    height: DESIGN_H,
    background: PALETTE.bg,
    antialias: true,
    resolution: 1,
    autoDensity: false,
  });
  app.ticker.autoStart = false;
  app.ticker.stop();

  const stars = new Container();
  const world = new Container();
  const hud = new Container();
  app.stage.addChild(stars, world, hud);

  // Starfield: two bands so 'drift' has something to scroll without the field
  // ever looking empty at a seam.
  const starG = new Graphics();
  stars.addChild(starG);
  const starPts = [];
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 150; i++) {
    starPts.push({
      x: rnd() * DESIGN_W, y: rnd() * DESIGN_H * 2,
      r: 1 + rnd() * 2.2, a: 0.25 + rnd() * 0.6,
      // A few are four-point sparkles rather than dots, as in the concept.
      spark: rnd() < 0.12,
    });
  }

  const g = new Graphics();
  world.addChild(g);

  const style = (size, fill) => new TextStyle({
    fill, fontFamily: 'system-ui, sans-serif', fontSize: size, fontWeight: '700',
  });
  const scoreText = new Text({ text: '', style: style(38, '#eaf2ff') });
  scoreText.position.set(46, 74);
  const statsText = new Text({ text: '', style: style(22, '#8fb4d9') });
  statsText.position.set(46, 122);
  const heartsG = new Graphics();
  hud.addChild(scoreText, statsText, heartsG);

  function drawStars(w) {
    starG.clear();
    const off = CAMERA.mode === 'drift' ? w.camera.starOffset % DESIGN_H : 0;
    for (const s of starPts) {
      const y = ((s.y + off) % (DESIGN_H * 2)) - DESIGN_H * 0.5;
      if (y < -10 || y > DESIGN_H + 10) continue;
      if (s.spark) {
        const r = s.r * 3.2;
        starG.moveTo(s.x, y - r).quadraticCurveTo(s.x, y, s.x + r, y)
             .quadraticCurveTo(s.x, y, s.x, y + r)
             .quadraticCurveTo(s.x, y, s.x - r, y)
             .quadraticCurveTo(s.x, y, s.x, y - r)
             .fill({ color: PALETTE.star, alpha: s.a });
      } else {
        starG.circle(s.x, y, s.r).fill({ color: PALETTE.star, alpha: s.a });
      }
    }
  }

  /**
   * The monster silhouette: a gummy blob, wide at the bottom with a wavy hem.
   *
   * This is the concept's shape and it matters more than any of the detail
   * drawn on top of it -- a circle with eyes reads as a bug, this reads as a
   * soft toy. Built from beziers in units of (rx, ry) so the hit squash can
   * scale the two axes independently and the whole thing deforms as one body.
   */
  function blobPath(x, y, rx, ry) {
    g.moveTo(x, y - ry);
    g.bezierCurveTo(x + rx * 0.62, y - ry, x + rx * 0.99, y - ry * 0.50, x + rx * 0.95, y + ry * 0.20);
    g.bezierCurveTo(x + rx * 0.93, y + ry * 0.63, x + rx * 0.79, y + ry * 0.87, x + rx * 0.62, y + ry * 0.90);
    // The hem: two shallow scallops, which is what stops the bottom reading as
    // a flat cut-off and gives the blob its "sitting on nothing" look.
    g.bezierCurveTo(x + rx * 0.44, y + ry * 0.95, x + rx * 0.36, y + ry * 0.72, x + rx * 0.19, y + ry * 0.78);
    g.bezierCurveTo(x + rx * 0.06, y + ry * 0.83, x + rx * 0.07, y + ry * 0.99, x, y + ry * 0.95);
    g.bezierCurveTo(x - rx * 0.07, y + ry * 0.99, x - rx * 0.06, y + ry * 0.83, x - rx * 0.19, y + ry * 0.78);
    g.bezierCurveTo(x - rx * 0.36, y + ry * 0.72, x - rx * 0.44, y + ry * 0.95, x - rx * 0.62, y + ry * 0.90);
    g.bezierCurveTo(x - rx * 0.79, y + ry * 0.87, x - rx * 0.93, y + ry * 0.63, x - rx * 0.95, y + ry * 0.20);
    g.bezierCurveTo(x - rx * 0.99, y - ry * 0.50, x - rx * 0.62, y - ry, x, y - ry);
    g.closePath();
  }

  /** A horn is a thick curved cone, not a spike. The concept's horns are short
   *  and fat with a clear inward hook -- drawn thin they read as antennae, and
   *  the creature stops being cuddly. */
  function drawHorn(x, y, r, side) {
    const s = side;
    const baseX = x + s * r * 0.34, baseY = y - r * 0.66;
    const tipX = x + s * r * 0.94, tipY = y - r * 1.24;
    // Outer edge sweeps up and out, inner edge cuts back in low, which is what
    // gives the fat base.
    g.moveTo(baseX - s * r * 0.16, baseY - r * 0.06);
    g.quadraticCurveTo(x + s * r * 0.42, y - r * 1.12, tipX, tipY);
    g.quadraticCurveTo(x + s * r * 0.58, y - r * 0.86, baseX + s * r * 0.20, baseY + r * 0.12);
    g.closePath();
    g.fill({ color: PALETTE.horn });
    g.stroke({ width: Math.max(3, r * 0.08), color: PALETTE.outline, alpha: 0.9 });
    // One shade sweep inside, which is all it takes to stop it looking flat.
    g.moveTo(baseX + s * r * 0.02, baseY + r * 0.02)
     .quadraticCurveTo(x + s * r * 0.50, y - r * 0.92, tipX - s * r * 0.14, tipY + r * 0.10)
     .stroke({ width: Math.max(2, r * 0.055), color: PALETTE.hornShade, alpha: 0.85 });
  }

  function drawMonster(m, time) {
    const lw = Math.max(4, m.r * 0.10);
    // Idle breathing, plus the hit squash on top of it.
    const breathe = Math.sin(m.wobble) * 0.045;
    let squash = 0;
    if (m.squashT > 0) {
      // p runs 0 -> 1 over the impulse. Amplitude decays as it goes, and the
      // cosine carries it through stretch on the way back, which is the "and
      // stretch" half -- without it a hit reads as a dent, not a bounce.
      const p = 1 - m.squashT / MONSTERS.hit.squashS;
      squash = MONSTERS.hit.squashAmount * (1 - p) *
               Math.cos(p * Math.PI * 2 * MONSTERS.hit.squashCycles);
    }
    // Shots arrive from below, so a hit FLATTENS: wider and shorter.
    const rx = m.r * (1 + breathe + squash);
    const ry = m.r * (1 - breathe - squash);
    const flash = m.hitT > 0;

    // Body.
    blobPath(m.x, m.y, rx, ry);
    g.fill({ color: flash ? 0xffffff : m.tint });
    blobPath(m.x, m.y, rx, ry);
    g.stroke({ width: lw, color: PALETTE.outline, alpha: 0.95 });

    // Ambient shade along the bottom, INSIDE the silhouette. One dark ellipse
    // at low alpha is the difference between a flat sticker and something with
    // a belly -- the concept gets the same read from a gradient.
    g.ellipse(m.x, m.y + ry * 0.52, rx * 0.72, ry * 0.34)
     .fill({ color: PALETTE.outline, alpha: 0.16 });

    if (m.horns) {
      drawHorn(m.x, m.y, m.r, -1);
      drawHorn(m.x, m.y, m.r, 1);
    }

    // Gloss: one soft highlight up and left, and a small bright dot. Two shapes,
    // and between them they turn a flat fill into something with a surface.
    g.ellipse(m.x - rx * 0.34, m.y - ry * 0.46, rx * 0.30, ry * 0.20)
     .fill({ color: 0xffffff, alpha: 0.20 });
    g.circle(m.x - rx * 0.52, m.y - ry * 0.30, rx * 0.07)
     .fill({ color: 0xffffff, alpha: 0.35 });

    // Eyes: one, two or three. A slow blink, offset per monster.
    const blink = Math.sin(time * 1.7 + m.blinkPhase);
    const lidded = blink > 0.94;
    const eyeR = m.r * (m.eyes === 1 ? 0.34 : m.eyes === 2 ? 0.25 : 0.20);
    const spread = m.eyes === 1 ? [0] :
                   m.eyes === 2 ? [-0.32, 0.32] : [-0.42, 0, 0.42];
    const eyeY = m.y - ry * (m.eyes === 3 ? 0.20 : 0.14);
    for (const ex of spread) {
      const cx = m.x + ex * rx;
      if (lidded) {
        // A closed eye is a line, and the line has to sit where the eye was.
        g.moveTo(cx - eyeR * 0.9, eyeY).lineTo(cx + eyeR * 0.9, eyeY)
         .stroke({ width: Math.max(3, lw * 0.8), color: PALETTE.outline });
        continue;
      }
      g.circle(cx, eyeY, eyeR).fill({ color: PALETTE.eye });
      g.circle(cx, eyeY, eyeR).stroke({ width: lw * 0.62, color: PALETTE.outline, alpha: 0.9 });
      // The pupil sits low and the catchlight high -- that pairing is most of
      // what makes a drawn eye look wet rather than printed.
      g.circle(cx, eyeY + eyeR * 0.16, eyeR * 0.46).fill({ color: PALETTE.pupil });
      g.circle(cx - eyeR * 0.20, eyeY - eyeR * 0.26, eyeR * 0.20)
       .fill({ color: 0xffffff, alpha: 0.95 });
    }

    // Mouth: a grin normally, a round "oh!" while it is being hit. The open
    // mouth is the other half of the hit read -- the squash says something
    // landed, the face says who it landed on.
    const mouthY = m.y + ry * (m.eyes === 3 ? 0.30 : 0.26);
    if (m.hitT > 0) {
      const mr = m.r * 0.19;
      g.ellipse(m.x, mouthY, mr, mr * 1.15).fill({ color: PALETTE.mouth });
      g.ellipse(m.x, mouthY, mr, mr * 1.15).stroke({ width: lw * 0.55, color: PALETTE.outline, alpha: 0.85 });
    } else {
      // WIDE, and high enough to belong to the eyes. A small mouth low on the
      // body reads as a navel; the concept's grin is nearly as wide as the eyes
      // are spread, and that is what makes the thing look delighted.
      const mw = m.r * 0.44 * m.grin;
      const lip = mouthY - m.r * 0.03;
      g.moveTo(m.x - mw, lip)
       .quadraticCurveTo(m.x, mouthY + m.r * 0.34, m.x + mw, lip)
       .quadraticCurveTo(m.x, mouthY + m.r * 0.08, m.x - mw, lip)
       .fill({ color: PALETTE.mouth });
      g.moveTo(m.x - mw, lip)
       .quadraticCurveTo(m.x, mouthY + m.r * 0.34, m.x + mw, lip)
       .stroke({ width: lw * 0.5, color: PALETTE.outline, alpha: 0.55 });
      // Fangs hanging from the upper lip -- bigger than they look like they
      // should be, because at 46 px radius a subtle fang is no fang.
      for (const s of [-1, 1]) {
        const fx = m.x + s * mw * 0.56;
        const fw = m.r * 0.075;
        g.moveTo(fx - fw, lip)
         .lineTo(fx + fw, lip)
         .lineTo(fx, lip + m.r * 0.17)
         .closePath()
         .fill({ color: PALETTE.fang });
      }
    }

    // Health, as a shrinking pip row rather than a bar: a child reads
    // "two left" faster than a fraction. Sits below the hem, and does NOT
    // squash with the body -- a wobbling health readout is unreadable.
    if (m.maxHp > 1) {
      const pips = Math.min(m.maxHp, 6);
      const left = Math.ceil((m.hp / m.maxHp) * pips);
      for (let i = 0; i < pips; i++) {
        const px = m.x - (pips - 1) * 7 + i * 14;
        g.circle(px, m.y + m.r + 16, 4.5)
         .fill({ color: i < left ? 0xffffff : 0x33405c, alpha: i < left ? 0.9 : 0.5 });
      }
    }
  }

  /**
   * The pod: a silver saucer with a glass dome, a grinning orange pilot and a
   * blue thruster. Drawn back-to-front (thruster, hull, dome, pilot, glass) so
   * the glass can sit OVER the pilot with real transparency, which is the whole
   * reason the dome reads as glass and not as a hat.
   */
  function drawPod(p, time) {
    const blink = p.invulnT > 0 && Math.floor(p.invulnT * 12) % 2 === 0;
    if (blink) return;
    const r = PLAYER.radius;
    const lw = Math.max(4, r * 0.11);
    const tilt = p.lean * 0.18;
    const cx = p.x + tilt * r * 0.5;

    // Thruster, flickering. Two flames, the inner one brighter and shorter.
    const flick = 0.82 + Math.sin(time * 22) * 0.18;
    const fy = p.y + r * 0.52;
    g.ellipse(cx, fy + r * 0.5, r * 0.34, r * 0.62 * flick)
     .fill({ color: PALETTE.thruster, alpha: 0.30 });
    g.moveTo(cx - r * 0.22, fy)
     .quadraticCurveTo(cx, fy + r * 1.20 * flick, cx + r * 0.22, fy)
     .closePath()
     .fill({ color: PALETTE.thruster });
    g.moveTo(cx - r * 0.10, fy)
     .quadraticCurveTo(cx, fy + r * 0.70 * flick, cx + r * 0.10, fy)
     .closePath()
     .fill({ color: 0xffffff, alpha: 0.85 });

    // Hull: the underside first, then the top plate, so the rim reads as an
    // edge rather than a line drawn on a disc.
    g.ellipse(p.x, p.y + r * 0.44, r * 1.16, r * 0.34).fill({ color: PALETTE.hullShade });
    g.ellipse(p.x, p.y + r * 0.44, r * 1.16, r * 0.34).stroke({ width: lw, color: PALETTE.outline });
    g.ellipse(p.x, p.y + r * 0.30, r * 1.34, r * 0.42).fill({ color: PALETTE.hull });
    g.ellipse(p.x, p.y + r * 0.30, r * 1.34, r * 0.42).stroke({ width: lw, color: PALETTE.outline });
    // Rim lights, as in the concept.
    for (const s of [-1, -0.33, 0.33, 1]) {
      g.circle(p.x + s * r * 0.92, p.y + r * 0.34, r * 0.10)
       .fill({ color: PALETTE.coin });
      g.circle(p.x + s * r * 0.92, p.y + r * 0.34, r * 0.10)
       .stroke({ width: lw * 0.5, color: PALETTE.outline, alpha: 0.8 });
    }

    // Pilot: an orange alien with little horns and a big grin, sitting IN the
    // hull so the dome can cover the top half of him.
    const py = p.y - r * 0.28;
    for (const s of [-1, 1]) {
      g.moveTo(cx + s * r * 0.20, py - r * 0.30)
       .quadraticCurveTo(cx + s * r * 0.40, py - r * 0.62, cx + s * r * 0.46, py - r * 0.50)
       .quadraticCurveTo(cx + s * r * 0.36, py - r * 0.34, cx + s * r * 0.34, py - r * 0.22)
       .closePath()
       .fill({ color: PALETTE.pilotShade });
    }
    g.circle(cx, py, r * 0.42).fill({ color: PALETTE.pilot });
    g.circle(cx, py, r * 0.42).stroke({ width: lw * 0.8, color: PALETTE.outline, alpha: 0.9 });
    g.circle(cx - r * 0.15, py - r * 0.08, r * 0.11).fill({ color: PALETTE.eye });
    g.circle(cx + r * 0.15, py - r * 0.08, r * 0.11).fill({ color: PALETTE.eye });
    g.circle(cx - r * 0.15, py - r * 0.06, r * 0.055).fill({ color: PALETTE.pupil });
    g.circle(cx + r * 0.15, py - r * 0.06, r * 0.055).fill({ color: PALETTE.pupil });
    g.moveTo(cx - r * 0.16, py + r * 0.10)
     .quadraticCurveTo(cx, py + r * 0.30, cx + r * 0.16, py + r * 0.10)
     .quadraticCurveTo(cx, py + r * 0.18, cx - r * 0.16, py + r * 0.10)
     .fill({ color: PALETTE.mouth });

    // The glass dome, over the pilot. Low alpha plus one bright sweep.
    g.circle(cx, py + r * 0.04, r * 0.74).fill({ color: PALETTE.dome, alpha: 0.26 });
    g.circle(cx, py + r * 0.04, r * 0.74).stroke({ width: lw, color: PALETTE.outline, alpha: 0.9 });
    g.moveTo(cx - r * 0.50, py - r * 0.26)
     .quadraticCurveTo(cx - r * 0.20, py - r * 0.62, cx + r * 0.16, py - r * 0.56)
     .stroke({ width: lw * 0.9, color: 0xffffff, alpha: 0.55 });
  }

  /** A bullet is a teardrop with a glow, not a dot: the concept's shots are
   *  little comets, and the taper is what shows which way one is going. */
  function drawBullet(b) {
    const tint = b.tint || PALETTE.bullet;
    const sp = Math.hypot(b.vx || 0, b.vy) || 1;
    const ux = (b.vx || 0) / sp, uy = b.vy / sp;
    const R = BULLETS.radius;
    const tail = R * 3.2;
    g.circle(b.x, b.y, R * 1.9).fill({ color: tint, alpha: 0.22 });
    // Head, plus a tail behind it along the travel direction.
    g.moveTo(b.x - uy * R, b.y + ux * R)
     .quadraticCurveTo(b.x - ux * tail * 0.5, b.y - uy * tail * 0.5,
                       b.x - ux * tail, b.y - uy * tail)
     .quadraticCurveTo(b.x + uy * R * 0.2 - ux * tail * 0.5, b.y - ux * R * 0.2 - uy * tail * 0.5,
                       b.x + uy * R, b.y - ux * R)
     .closePath()
     .fill({ color: tint, alpha: 0.75 });
    g.circle(b.x, b.y, R).fill({ color: tint });
    g.circle(b.x - R * 0.25, b.y - R * 0.25, R * 0.4).fill({ color: 0xffffff, alpha: 0.8 });
  }

  function drawCoin(c) {
    g.circle(c.x, c.y, COINS.radius).fill({ color: PALETTE.coin });
    g.circle(c.x, c.y, COINS.radius).stroke({ width: 3.5, color: PALETTE.coinShade });
    g.circle(c.x, c.y, COINS.radius * 0.58).stroke({ width: 2.5, color: PALETTE.coinShade, alpha: 0.9 });
    g.circle(c.x - COINS.radius * 0.3, c.y - COINS.radius * 0.32, COINS.radius * 0.22)
     .fill({ color: 0xffffff, alpha: 0.75 });
  }

  /**
   * A toy pickup is a SHAPE, not a tinted circle.
   *
   * It was a circle, and a player said the twirl "just looks like a big coin" --
   * which it did: same silhouette, and the twirl's old tint was the coin's exact
   * yellow. A pickup has to be identifiable across the field before the player
   * decides whether to go and get it, and at 34 px on a screen a child is
   * standing three metres from, colour alone does not carry that. Shape does.
   *
   * Each kind draws what it DOES: a star for the wand that seeks, a pinwheel for
   * the spray that spins, two little faces for the bots that follow you around.
   */
  function drawToyPickup(c, time) {
    const kind = TOYS.kinds[c.kind];
    const R = TOYS.radius;
    const x = c.x, y = c.y + Math.sin(c.bob) * 5;
    const spin = time * 1.6 + c.bob;
    // A halo that breathes, so a pickup is the one thing on the field that
    // pulses -- movement in the corner of the eye is what makes it eye-catching
    // rather than merely brightly coloured.
    const pulse = 1 + Math.sin(time * 4 + c.bob) * 0.12;
    g.circle(x, y, R * 1.55 * pulse).fill({ color: kind.tint, alpha: 0.16 });
    g.circle(x, y, R * 1.18 * pulse).fill({ color: kind.tint, alpha: 0.14 });

    if (kind.id === 'wand') {
      // A five-point star: the seeking toy, drawn as the thing that points.
      star(x, y, R * 1.12, R * 0.46, 5, spin * 0.5);
      g.fill({ color: kind.tint });
      star(x, y, R * 1.12, R * 0.46, 5, spin * 0.5);
      g.stroke({ width: 5, color: PALETTE.outline });
      g.circle(x - R * 0.16, y - R * 0.20, R * 0.16).fill({ color: 0xffffff, alpha: 0.9 });
      return;
    }

    if (kind.id === 'twirl') {
      // A pinwheel, actually spinning: three curved blades around a hub.
      for (let i = 0; i < 3; i++) {
        const a = spin * 2.2 + (Math.PI * 2 * i) / 3;
        const ax = Math.cos(a), ay = Math.sin(a);
        const px = -ay, py = ax;   // perpendicular, for the blade's curve
        g.moveTo(x, y)
         .quadraticCurveTo(x + ax * R * 0.75 + px * R * 0.80, y + ay * R * 0.75 + py * R * 0.80,
                           x + ax * R * 1.25, y + ay * R * 1.25)
         .quadraticCurveTo(x + ax * R * 0.70 - px * R * 0.10, y + ay * R * 0.70 - py * R * 0.10,
                           x, y)
         .closePath()
         .fill({ color: kind.tint });
      }
      g.circle(x, y, R * 0.34).fill({ color: 0xffffff });
      g.circle(x, y, R * 0.34).stroke({ width: 4, color: PALETTE.outline });
      return;
    }

    // Buddies: two little faces, orbiting each other. The pickup is a preview of
    // what you get, which is the clearest label a non-reader can be given.
    for (let i = 0; i < 2; i++) {
      const a = spin * 1.6 + Math.PI * i;
      const bx = x + Math.cos(a) * R * 0.52;
      const by = y + Math.sin(a) * R * 0.52;
      const br = R * 0.62;
      g.circle(bx, by, br).fill({ color: kind.tint });
      g.circle(bx, by, br).stroke({ width: 4.5, color: PALETTE.outline });
      g.circle(bx - br * 0.30, by - br * 0.18, br * 0.26).fill({ color: PALETTE.eye });
      g.circle(bx + br * 0.30, by - br * 0.18, br * 0.26).fill({ color: PALETTE.eye });
      g.circle(bx - br * 0.30, by - br * 0.14, br * 0.13).fill({ color: PALETTE.pupil });
      g.circle(bx + br * 0.30, by - br * 0.14, br * 0.13).fill({ color: PALETTE.pupil });
    }
  }

  /** A star path, used by the wand pickup. Kept separate because a star built
   *  inline is unreadable and this is the third place that wanted one. */
  function star(cx, cy, outer, inner, points, rot) {
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = rot - Math.PI / 2 + (Math.PI * i) / points;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  function drawHud(w) {
    scoreText.text = `${w.stats.score}   ★ ${w.stats.coins}`;
    heartsG.clear();
    // HEARTS LEFT, CHROME RIGHT. They are the two things always on screen, and
    // splitting them means neither has to move when the other grows -- a fourth
    // heart or a fourth button changes nothing about the other side.
    for (let i = 0; i < PLAYER.hearts; i++) {
      const on = i < w.player.hearts;
      const x = 46 + i * 52;
      heartsG.circle(x, 44, 17)
        .fill({ color: on ? PALETTE.heart : 0x2a3550, alpha: on ? 1 : 0.7 });
      heartsG.circle(x, 44, 17).stroke({ width: 3, color: PALETTE.outline, alpha: on ? 0.9 : 0.5 });
    }
    if (!w.stats.showStatsOff) {
      const worst = w.stats.worstReactionS < 90 ? w.stats.worstReactionS.toFixed(2) + 's' : '--';
      statsText.text =
        `camera ${CAMERA.mode}   drift x${MONSTERS.driftMul.toFixed(2)}   ` +
        `ramp ${Math.round(difficulty01(w.time) * 100)}%   ` +
        `clearance x${MONSTERS.passClearanceMul.toFixed(2)}\n` +
        `passes ${w.stats.passes}   near ${w.stats.nearMisses}   contacts ${w.stats.contacts}   ` +
        `worst reaction ${worst}`;
    }
  }

  return {
    app,
    draw(w) {
      drawStars(w);
      world.x = CAMERA.mode === 'lateral' ? -w.camera.x : 0;
      g.clear();
      const toy = w.toy.active;
      const time = w.time;

      // TINTED PER BULLET, not per active toy. The base gun and the toy fire at
      // the same time now, so one colour for everything on screen would hide
      // the fact that the cannon never stopped -- which is the single thing the
      // player most needs to be able to see.
      for (const b of w.bullets) drawBullet(b);
      for (const m of w.monsters) if (m.alive) drawMonster(m, time);
      for (const c of w.coins) drawCoin(c);
      for (const f of w.pops) {
        g.rect(f.x, f.y, f.size, f.size).fill({ color: f.tint, alpha: Math.min(1, f.t * 2) });
      }
      for (const c of w.toyPickups) drawToyPickup(c, time);

      // Buddy bots orbit OUTSIDE the pod, drawn before it so the pod stays the
      // thing the eye lands on.
      if (toy && toy.id === 'buddies') {
        for (const b of w.toy.buddies) {
          if (b.x === undefined) continue;
          g.circle(b.x, b.y, toy.radius).fill({ color: toy.tint });
          g.circle(b.x, b.y, toy.radius).stroke({ width: 4, color: PALETTE.outline });
          g.circle(b.x - 6, b.y - 4, 6).fill({ color: PALETTE.eye });
          g.circle(b.x + 6, b.y - 4, 6).fill({ color: PALETTE.eye });
          g.circle(b.x - 6, b.y - 4, 3).fill({ color: PALETTE.pupil });
          g.circle(b.x + 6, b.y - 4, 3).fill({ color: PALETTE.pupil });
        }
      }

      if (w.player.alive) drawPod(w.player, time);

      // THE TOY TIMER: A BAR UNDER THE POD.
      //
      // It was a ring around the pod, on the theory that a closing circle reads
      // at three metres while standing on a board. It does -- but it reads as a
      // SHIELD, or as health: a player on the board asked what was protecting
      // him. A ring drawn around a character means "this character is wrapped
      // in something" in every game that has ever drawn one, and no amount of
      // it being the right shape for a countdown survives that.
      //
      // A bar still travels with the pod, so the eyes stay on the field, but it
      // cannot be mistaken for armour. Under rather than over: up-screen is
      // where the monsters, the shots and the aim all are.
      if (toy && w.toy.total > 0) {
        const frac = Math.max(0, Math.min(1, w.toy.t / w.toy.total));
        const bar = TOYS.timerBar;
        const bx = w.player.x - bar.width / 2;
        const by = w.player.y + PLAYER.radius + bar.offsetY;
        const r = bar.height / 2;
        g.roundRect(bx, by, bar.width, bar.height, r)
         .fill({ color: PALETTE.outline, alpha: 0.85 });
        if (frac > 0) {
          // Shrinks from both ends toward the centre, so the bar stays centred
          // under the pod instead of appearing to slide off to the left as it
          // empties -- at this size, an off-centre bar reads as the pod being
          // lopsided rather than as a timer running out.
          const wFill = Math.max(bar.height, bar.width * frac);
          g.roundRect(w.player.x - wFill / 2, by, wFill, bar.height, r)
           .fill({ color: toy.tint });
        }
        g.roundRect(bx, by, bar.width, bar.height, r)
         .stroke({ width: 3, color: 0x0b1020, alpha: 0.9 });
      }
      drawHud(w);
    },
    resize() {
      const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      app.canvas.style.width = `${DESIGN_W * scale}px`;
      app.canvas.style.height = `${DESIGN_H * scale}px`;
    },
  };
}
