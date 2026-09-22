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
import { DESIGN_W, DESIGN_H, CAMERA, PLAYER, BULLETS, COINS, HEARTS, MONSTERS, TOYS, SQUAD, SKY, POD, XP, difficulty01 } from '../data/tuning.js';
import { punchExtension, activeToy } from '../systems/toys.js';

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
  statsText.position.set(46, 146);
  const heartsG = new Graphics();
  // The level-up celebration. Two lines: a shout anyone recognises, and a big
  // numeral -- the number is the message, since the audience cannot read the
  // word above it.
  const levelG = new Graphics();
  const yayText = new Text({ text: 'YAY!', style: style(64, '#fff3a8') });
  const levelText = new Text({ text: '', style: style(150, '#ffffff') });
  yayText.anchor.set(0.5);
  levelText.anchor.set(0.5);
  const xpG = new Graphics();
  hud.addChild(scoreText, statsText, heartsG, xpG, levelG, yayText, levelText);

  // The sky eases toward the current level's colour rather than cutting to it.
  // Held as separate channels because interpolating packed ints channel-wise is
  // the only way to avoid sliding through a bright colour on the way between two
  // dark ones -- which would be a flash, and a flash is the one thing the
  // luminance rule exists to prevent.
  let skyR = (SKY.colors[0] >> 16) & 0xff;
  let skyG = (SKY.colors[0] >> 8) & 0xff;
  let skyB = SKY.colors[0] & 0xff;

  function updateSky(w, dt) {
    const target = SKY.colors[(Math.max(1, w.level) - 1) % SKY.colors.length];
    const tr = (target >> 16) & 0xff, tg = (target >> 8) & 0xff, tb = target & 0xff;
    // `?level=` sets this so a headless screenshot shows the DESTINATION. Under
    // virtual time Pixi's ticker reports a near-zero delta, so the ease never
    // runs and every shot came back showing the starting navy -- which had me
    // rewriting the palette twice before the test itself was the problem.
    if (w.skySnap) {
      skyR = tr; skyG = tg; skyB = tb;
      w.skySnap = false;
    }
    // 95 % of the way in `lerpS`, frame-rate independent.
    //
    // This was `dt / lerpS`, which is an exponential decay whose TIME CONSTANT
    // is lerpS -- so it reached only 63 % in 1.5 s and needed ~4.5 s to arrive.
    // Sampling the rendered pixels caught it: level 4 came out rgb(16,20,48)
    // against a target of (42,15,46), and I had blamed the palette first.
    const k = 1 - Math.exp((-3 * dt) / SKY.lerpS);
    skyR += (tr - skyR) * k;
    skyG += (tg - skyG) * k;
    skyB += (tb - skyB) * k;
    app.renderer.background.color =
      (Math.round(skyR) << 16) | (Math.round(skyG) << 8) | Math.round(skyB);
  }

  function drawStars(w) {
    starG.clear();
    // Stars pick up a fraction of the sky, so they belong to it.
    const sr = Math.round(255 + (skyR - 255) * SKY.starTint);
    const sg = Math.round(255 + (skyG - 255) * SKY.starTint);
    const sb = Math.round(255 + (skyB - 255) * SKY.starTint);
    const starColor = (sr << 16) | (sg << 8) | sb;
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
             .fill({ color: starColor, alpha: s.a });
      } else {
        starG.circle(s.x, y, s.r).fill({ color: starColor, alpha: s.a });
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
   * The pod: a silver ship with a glass canopy, a grinning crew and blue
   * thrusters. Drawn back-to-front (exhaust, hull, crew, canopy) so the glass
   * sits OVER the crew with real transparency, which is the whole reason the
   * dome reads as glass and not as a hat.
   *
   * FOUR SILHOUETTES, not one with parts added. See POD.tiers for why.
   */
  /**
   * The hull, as ONE closed path per tier.
   *
   * This is the difference between four ships and one ship with parts glued on:
   * the wingtips are points on this curve, so a tier changes the outline you
   * would recognise in black rather than adding a shape beside it. Everything
   * else about the pod -- dome, pilots, thrusters -- scales to match.
   */
  function hullPath(x, y, r, t) {
    const W = r * t.hullW;
    const tipY = y - r * t.tipRise;
    const topY = y - r * t.topH;
    const keelY = y + r * t.keel;
    g.moveTo(x - W, tipY);
    g.bezierCurveTo(x - W * 0.62, topY - r * 0.02, x - W * 0.30, topY - r * 0.10, x, topY - r * 0.08);
    g.bezierCurveTo(x + W * 0.30, topY - r * 0.10, x + W * 0.62, topY - r * 0.02, x + W, tipY);
    g.bezierCurveTo(x + W * 0.84, y + r * t.underY, x + W * 0.36, keelY, x, keelY);
    g.bezierCurveTo(x - W * 0.36, keelY, x - W * 0.84, y + r * t.underY, x - W, tipY);
    g.closePath();
  }

  function podTier(level) {
    const ts = POD.tiers;
    let out = ts[0];
    for (const t of ts) if ((level || 1) >= t.from) out = t;
    return out;
  }

  // The pod's recent path, for the exhaust ribbon. Recorded by DISTANCE rather
  // than per frame, for the same reason the squad trail was: a stationary pod
  // would otherwise fill the buffer with identical points and the ribbon would
  // collapse to a dot the moment the player held still.
  const podTrail = [];

  /** One small alien in the canopy, drawn with the SAME recipe as everything
   *  else -- fill, thick outline, catchlight. The first version of the second
   *  pilot was a flat circle beside a shaded one, which is exactly the kind of
   *  mismatch that made the upgrades read cheap. */
  function drawPilot(x, y, rr, body, lw) {
    g.circle(x, y, rr).fill({ color: body });
    g.circle(x, y, rr).stroke({ width: lw, color: PALETTE.outline, alpha: 0.9 });
    g.circle(x - rr * 0.30, y - rr * 0.34, rr * 0.26).fill({ color: 0xffffff, alpha: 0.30 });
    g.circle(x - rr * 0.36, y - rr * 0.18, rr * 0.26).fill({ color: PALETTE.eye });
    g.circle(x + rr * 0.36, y - rr * 0.18, rr * 0.26).fill({ color: PALETTE.eye });
    g.circle(x - rr * 0.36, y - rr * 0.13, rr * 0.13).fill({ color: PALETTE.pupil });
    g.circle(x + rr * 0.36, y - rr * 0.13, rr * 0.13).fill({ color: PALETTE.pupil });
    g.moveTo(x - rr * 0.34, y + rr * 0.24)
     .quadraticCurveTo(x, y + rr * 0.68, x + rr * 0.34, y + rr * 0.24)
     .quadraticCurveTo(x, y + rr * 0.44, x - rr * 0.34, y + rr * 0.24)
     .fill({ color: PALETTE.mouth });
  }

  function drawPod(p, time, level) {
    const blink = p.invulnT > 0 && Math.floor(p.invulnT * 12) % 2 === 0;
    const r = PLAYER.radius;
    const lw = Math.max(4, r * 0.11);
    const tilt = p.lean * 0.18;
    const cx = p.x + tilt * r * 0.5;
    const t = podTier(level);

    // The exhaust ribbon is recorded and drawn even while the pod is blinking
    // after a hit -- a trail that vanished on every hit would strobe with it.
    if ((level || 1) >= POD.trailFrom) {
      const last = podTrail[podTrail.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= POD.trailStepPx) {
        podTrail.push({ x: p.x, y: p.y });
      }
      while (podTrail.length > POD.trailPoints) podTrail.shift();
      for (let i = 1; i < podTrail.length; i++) {
        const f = i / podTrail.length;
        g.moveTo(podTrail[i - 1].x, podTrail[i - 1].y)
         .lineTo(podTrail[i].x, podTrail[i].y)
         .stroke({ width: r * 0.5 * f, color: PALETTE.thruster, alpha: 0.30 * f });
      }
    } else if (podTrail.length) {
      podTrail.length = 0;
    }

    if (blink) return;

    // Thrusters, spread across the keel so a wider ship has wider exhausts.
    const flick = 0.82 + Math.sin(time * 22) * 0.18;
    const fy = p.y + r * (t.keel - 0.04);
    const spread = t.thrusters === 1 ? [0]
                 : t.thrusters === 2 ? [-0.28, 0.28]
                 : [-0.42, 0, 0.42];
    for (const nx of spread) {
      const ex = cx + nx * r;
      g.ellipse(ex, fy + r * 0.5, r * 0.30, r * 0.58 * flick)
       .fill({ color: PALETTE.thruster, alpha: 0.28 });
      g.moveTo(ex - r * 0.20, fy)
       .quadraticCurveTo(ex, fy + r * 1.10 * flick, ex + r * 0.20, fy)
       .closePath()
       .fill({ color: PALETTE.thruster });
      g.moveTo(ex - r * 0.09, fy)
       .quadraticCurveTo(ex, fy + r * 0.64 * flick, ex + r * 0.09, fy)
       .closePath()
       .fill({ color: 0xffffff, alpha: 0.85 });
    }

    // THE HULL, with the monsters' recipe applied in the monsters' order:
    // fill, then the underside shade INSIDE the silhouette, then gloss, then the
    // outline last so nothing overpaints it.
    hullPath(p.x, p.y, r, t);
    g.fill({ color: PALETTE.hull });

    // Belly shade: a dark ellipse clipped visually by sitting inside the hull.
    g.ellipse(p.x, p.y + r * (t.keel * 0.56), r * t.hullW * 0.86, r * (t.keel * 0.40))
     .fill({ color: PALETTE.hullShade, alpha: 0.7 });
    // Gloss, up and to the left, exactly as on a monster.
    g.ellipse(p.x - r * t.hullW * 0.34, p.y - r * 0.02, r * t.hullW * 0.30, r * 0.11)
     .fill({ color: 0xffffff, alpha: 0.35 });

    hullPath(p.x, p.y, r, t);
    g.stroke({ width: lw, color: PALETTE.outline });

    // Rim lights, spread along whatever width this hull has -- the count never
    // changes, because a count is not something anyone perceives as a better
    // ship. They simply travel further apart as the hull grows.
    for (const sgn of [-0.78, -0.26, 0.26, 0.78]) {
      const lx = p.x + sgn * r * t.hullW;
      g.circle(lx, p.y + r * 0.16, r * 0.10).fill({ color: PALETTE.coin });
      g.circle(lx, p.y + r * 0.16, r * 0.10)
       .stroke({ width: lw * 0.5, color: PALETTE.outline, alpha: 0.85 });
    }

    // Crew, then the canopy over them.
    // ONE PILOT. He is the player, and a second face in the canopy quietly asks
    // who the player is now. Sits just above the hull's crown, with the canopy
    // riding on him -- both anchored to `topH`, so a taller ship raises its
    // bubble rather than leaving it floating over a bigger body.
    const py = p.y - r * (t.topH + 0.22);
    drawPilot(cx, py, r * 0.30, PALETTE.pilot, lw * 0.6);

    const domeR = r * t.dome;
    g.circle(cx, py + r * 0.04, domeR).fill({ color: PALETTE.dome, alpha: 0.24 });
    g.circle(cx, py + r * 0.04, domeR)
     .stroke({ width: lw, color: PALETTE.outline, alpha: 0.9 });
    g.moveTo(cx - domeR * 0.60, py - domeR * 0.22)
     .quadraticCurveTo(cx - domeR * 0.22, py - domeR * 0.72, cx + domeR * 0.22, py - domeR * 0.62)
     .stroke({ width: lw * 0.85, color: 0xffffff, alpha: 0.5 });
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

  /** A heart pickup: the same shape as the HUD hearts, so what it gives you is
   *  obvious without a word. Pulses, because it is the one pickup a player in
   *  trouble has to spot immediately. */
  function drawHeart(h, time) {
    const r = HEARTS.radius;
    const y = h.y + Math.sin(h.bob) * 5;
    const pulse = 1 + Math.sin(time * 5 + h.bob) * 0.10;
    g.circle(h.x, y, r * 1.5 * pulse).fill({ color: PALETTE.heart, alpha: 0.18 });
    heartPath(h.x, y, r * pulse);
    g.fill({ color: PALETTE.heart });
    heartPath(h.x, y, r * pulse);
    g.stroke({ width: 4, color: PALETTE.outline });
    g.circle(h.x - r * 0.34, y - r * 0.30, r * 0.18).fill({ color: 0xffffff, alpha: 0.7 });
  }

  /** A heart outline: two lobes into a point. */
  function heartPath(cx, cy, r) {
    g.moveTo(cx, cy + r * 0.85);
    g.bezierCurveTo(cx - r * 1.30, cy - r * 0.10, cx - r * 0.62, cy - r * 1.05, cx, cy - r * 0.32);
    g.bezierCurveTo(cx + r * 0.62, cy - r * 1.05, cx + r * 1.30, cy - r * 0.10, cx, cy + r * 0.85);
    g.closePath();
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

    if (kind.id === 'cross') {
      // A plus with arrowheads: the shape of what it fires, which is the
      // clearest label available to someone who cannot read "CROSS FIRE".
      // Three arms, matching what it fires. The icon has to lose the up arm too
      // or the pickup promises a barrel the toy no longer has.
      const arm = R * 0.92, w2 = R * 0.17;
      g.roundRect(x - w2, y - w2, w2 * 2, arm + w2, w2).fill({ color: kind.tint });
      g.roundRect(x - arm, y - w2, arm * 2, w2 * 2, w2).fill({ color: kind.tint });
      for (const [dx, dy] of kind.dirs) {
        const tx = x + dx * arm, ty = y + dy * arm;
        g.moveTo(tx + dx * R * 0.22 - dy * R * 0.26, ty + dy * R * 0.22 + dx * R * 0.26)
         .lineTo(tx + dx * R * 0.40, ty + dy * R * 0.40)
         .lineTo(tx + dx * R * 0.22 + dy * R * 0.26, ty + dy * R * 0.22 - dx * R * 0.26)
         .closePath()
         .fill({ color: kind.tint });
      }
      g.circle(x, y, R * 0.26).fill({ color: 0xffffff, alpha: 0.85 });
      return;
    }

    if (kind.id === 'shield') {
      // A ring with a gap, around a dot: the universal "protected" mark.
      g.circle(x, y, R * 0.94).stroke({ width: 9, color: kind.tint });
      g.circle(x, y, R * 0.94).stroke({ width: 3, color: PALETTE.outline, alpha: 0.5 });
      g.circle(x, y, R * 0.34).fill({ color: kind.tint });
      g.circle(x - R * 0.12, y - R * 0.14, R * 0.12).fill({ color: 0xffffff, alpha: 0.9 });
      return;
    }

    if (kind.id === 'punch') {
      // A fist with three knuckles and a short cuff, angled like a jab.
      const a = Math.sin(spin) * 0.25;
      const fx = x + Math.cos(a) * R * 0.18, fy = y + Math.sin(a) * R * 0.18;
      g.moveTo(x - R * 0.95, y + R * 0.28)
       .lineTo(fx - R * 0.30, fy + R * 0.20)
       .stroke({ width: 11, color: kind.tint });
      g.circle(fx, fy, R * 0.62).fill({ color: kind.tint });
      g.circle(fx, fy, R * 0.62).stroke({ width: 4.5, color: PALETTE.outline });
      for (const k of [-0.42, 0, 0.42]) {
        g.circle(fx + k * R * 0.42, fy - R * 0.24, R * 0.11)
         .fill({ color: 0xffffff, alpha: 0.6 });
      }
      return;
    }

    if (kind.id === 'chain') {
      // Three bombs hanging on a rope -- the pickup previews the silhouette the
      // toy actually makes, which is the only label a non-reader can use.
      const xs = [-0.42, 0.02, 0.44];
      const ys = [-0.62, 0.10, 0.78];
      g.moveTo(x + xs[0] * R, y + ys[0] * R);
      for (let i = 1; i < 3; i++) g.lineTo(x + xs[i] * R, y + ys[i] * R);
      g.stroke({ width: 5, color: PALETTE.horn });
      for (let i = 0; i < 3; i++) {
        const bx = x + xs[i] * R, by = y + ys[i] * R;
        g.circle(bx, by, R * 0.34).fill({ color: 0x25304a });
        g.circle(bx, by, R * 0.34).stroke({ width: 3.5, color: PALETTE.outline });
        g.circle(bx, by, R * 0.34).stroke({ width: 2, color: kind.tint, alpha: 0.85 });
        g.circle(bx - R * 0.10, by - R * 0.04, R * 0.10).fill({ color: PALETTE.eye });
        g.circle(bx + R * 0.10, by - R * 0.04, R * 0.10).fill({ color: PALETTE.eye });
      }
      return;
    }

    if (kind.id === 'rapid') {
      // A lightning bolt: the one silhouette that means "faster" without a word
      // of text, which matters for an audience that cannot read the label.
      const bolt = [
        [0.30, -1.15], [-0.55, 0.10], [-0.05, 0.10], [-0.30, 1.15],
        [0.58, -0.08], [0.08, -0.08],
      ];
      bolt.forEach(([bx, by], i) => {
        const px = x + bx * R, py = y + by * R;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.closePath();
      g.fill({ color: kind.tint });
      bolt.forEach(([bx, by], i) => {
        const px = x + bx * R, py = y + by * R;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.closePath();
      g.stroke({ width: 5, color: PALETTE.outline });
      return;
    }

    // Buddies: two little BOMBS orbiting each other. The pickup is a preview of
    // what you get, which is the clearest label a non-reader can be given -- so
    // when the buddies became bombs, this had to become bombs too. A pickup that
    // shows the old behaviour is worse than one that shows nothing.
    for (let i = 0; i < 2; i++) {
      const a = spin * 1.6 + Math.PI * i;
      const bx = x + Math.cos(a) * R * 0.52;
      const by = y + Math.sin(a) * R * 0.52;
      const br = R * 0.60;
      g.circle(bx, by, br).fill({ color: 0x25304a });
      g.circle(bx, by, br).stroke({ width: 4, color: PALETTE.outline });
      g.circle(bx, by, br).stroke({ width: 2, color: kind.tint, alpha: 0.8 });
      g.circle(bx - br * 0.28, by - br * 0.06, br * 0.24).fill({ color: PALETTE.eye });
      g.circle(bx + br * 0.28, by - br * 0.06, br * 0.24).fill({ color: PALETTE.eye });
      g.circle(bx - br * 0.28, by - br * 0.02, br * 0.12).fill({ color: PALETTE.pupil });
      g.circle(bx + br * 0.28, by - br * 0.02, br * 0.12).fill({ color: PALETTE.pupil });
      // Fuse and spark, same as the real thing.
      const fx = bx + br * 0.78, fy = by - br * 1.30;
      g.moveTo(bx + br * 0.14, by - br * 0.92)
       .quadraticCurveTo(bx + br * 0.70, by - br * 0.98, fx, fy)
       .stroke({ width: 4, color: PALETTE.horn });
      g.circle(fx, fy, br * 0.26).fill({ color: PALETTE.coin });
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

  /**
   * One rescued squad member: the monster silhouette at a fraction of the size,
   * keeping the face it had when it was an enemy.
   *
   * Reusing `blobPath` rather than drawing a simplified token is the point --
   * a child has to recognise the thing behind them as the same creature they
   * were shooting a minute ago, or the line is just decoration.
   */
  function drawSquadMember(mem, time) {
    // Swell in on join, with a small overshoot so it pops rather than inflates.
    const t = mem.joinT > 0 ? 1 - mem.joinT / SQUAD.joinS : 1;
    const grow = t >= 1 ? 1 : Math.sin(t * Math.PI * 0.5) * (1 + (1 - t) * 0.25);
    const r = SQUAD.radius * grow;
    if (r < 0.5) return;
    const y = mem.y + Math.sin(mem.bob) * SQUAD.bobAmp;
    const lw = Math.max(2.5, r * 0.13);

    // An armed member carries a faint halo that breathes -- the only way to tell
    // a live bomb from one still taking its place, and the difference decides
    // whether flying into something is protection or a waste.
    if (mem.armT <= 0 && mem.joinT <= 0) {
      const pulse = 1 + Math.sin(mem.bob * 1.6) * 0.14;
      g.circle(mem.x, y, r * 1.5 * pulse).fill({ color: mem.tint, alpha: 0.16 });
    }

    blobPath(mem.x, y, r, r);
    g.fill({ color: mem.tint });
    blobPath(mem.x, y, r, r);
    g.stroke({ width: lw, color: PALETTE.outline, alpha: 0.95 });

    // Eyes only -- at this size a mouth and horns turn into noise, and the eyes
    // are what carry "this is alive and it is with me".
    const eyeR = r * (mem.eyes === 1 ? 0.30 : 0.22);
    const spread = mem.eyes === 1 ? [0] : mem.eyes === 2 ? [-0.30, 0.30] : [-0.40, 0, 0.40];
    for (const ex of spread) {
      const cx = mem.x + ex * r;
      g.circle(cx, y - r * 0.10, eyeR).fill({ color: PALETTE.eye });
      g.circle(cx, y - r * 0.04, eyeR * 0.48).fill({ color: PALETTE.pupil });
    }
    void time;
  }

  /**
   * A Buddy Bomb: a cartoon bomb that is still a character.
   *
   * Dark body, cream fuse, a spark that flickers -- the universal "this will go
   * off" silhouette, readable by someone who cannot read. The eyes stay, because
   * the thing orbiting your pod is a friend doing you a favour and rule 4 says
   * nothing in this game dies unhappily.
   *
   * An UNARMED bomb (the first fraction of a second) shows no spark, so the one
   * state that changes what it does is the one state you can see.
   */
  function drawBuddyBomb(b, kind, time, radiusOverride) {
    const r = radiusOverride || kind.radius;
    const armed = !(b.armT > 0);

    // Halo, pulsing, in the toy's colour so the pickup and the bomb agree.
    if (armed) {
      const pulse = 1 + Math.sin(time * 9 + b.a) * 0.13;
      g.circle(b.x, b.y, r * 1.45 * pulse).fill({ color: kind.tint, alpha: 0.18 });
    }

    // Body: dark, so it reads as a bomb rather than as another blob to shoot.
    g.circle(b.x, b.y, r).fill({ color: 0x25304a });
    g.circle(b.x, b.y, r).stroke({ width: 4.5, color: PALETTE.outline });
    // One rim light in the toy's colour keeps it tied to its pickup.
    g.circle(b.x, b.y, r).stroke({ width: 2, color: kind.tint, alpha: 0.75 });
    g.circle(b.x - r * 0.34, b.y - r * 0.34, r * 0.20).fill({ color: 0xffffff, alpha: 0.28 });

    g.circle(b.x - r * 0.26, b.y - r * 0.06, r * 0.24).fill({ color: PALETTE.eye });
    g.circle(b.x + r * 0.26, b.y - r * 0.06, r * 0.24).fill({ color: PALETTE.eye });
    g.circle(b.x - r * 0.26, b.y - r * 0.02, r * 0.12).fill({ color: PALETTE.pupil });
    g.circle(b.x + r * 0.26, b.y - r * 0.02, r * 0.12).fill({ color: PALETTE.pupil });

    // FUSE LAST, and reaching well outside the body. Drawn before the body it
    // was painted over and invisible -- which cost the bomb the one feature
    // that says "bomb" to someone who cannot read the label.
    const fx = b.x + r * 0.80, fy = b.y - r * 1.34;
    g.moveTo(b.x + r * 0.16, b.y - r * 0.94)
     .quadraticCurveTo(b.x + r * 0.72, b.y - r * 1.00, fx, fy)
     .stroke({ width: 5, color: PALETTE.horn });
    if (armed) {
      // Flicker on a fast irregular beat: a steady dot reads as an LED, a
      // jumping one reads as burning.
      const flick = 0.7 + Math.abs(Math.sin(time * 17 + b.a * 3)) * 0.6;
      g.circle(fx, fy, r * 0.42 * flick).fill({ color: PALETTE.coin, alpha: 0.45 });
      g.circle(fx, fy, r * 0.22 * flick).fill({ color: 0xffffff });
    }
  }

  /**
   * The level-up popup.
   *
   * IN THE LOWER THIRD, never the top: the top of the screen is where four out
   * of five monsters arrive, and a celebration that covers an incoming threat
   * turns a reward into a death. It also never pauses and never asks to be
   * dismissed -- there are no buttons, and a child should not have to clear
   * their own prize.
   *
   * Scales in with an overshoot, holds, then lifts and fades.
   */
  function drawLevelPopup(w) {
    const pop = w.levelPopup;
    if (!pop) {
      yayText.visible = false;
      levelText.visible = false;
      levelG.clear();
      return;
    }
    const p01 = 1 - pop.t / pop.total;
    // Punch in over the first 18%, hold, fade out over the last 25%.
    const grow = p01 < 0.18
      ? Math.sin((p01 / 0.18) * Math.PI * 0.5) * 1.15
      : 1 + Math.max(0, (0.18 - p01)) * 0.5;
    const alpha = p01 > 0.75 ? Math.max(0, 1 - (p01 - 0.75) / 0.25) : 1;
    const rise = p01 > 0.6 ? (p01 - 0.6) * 150 : 0;
    const cx = DESIGN_W * 0.5;
    // 0.52 keeps the whole thing clear of the pod at 0.72 while staying well
    // out of the top half, where four arrivals in five come from.
    const cy = DESIGN_H * 0.52 - rise;

    levelG.clear();
    // A soft burst behind it, so the text never sits on raw starfield.
    levelG.circle(cx, cy, 215 * grow).fill({ color: 0x74d7ff, alpha: 0.12 * alpha });
    levelG.circle(cx, cy, 140 * grow).fill({ color: 0xffc93c, alpha: 0.12 * alpha });
    // Rays, spinning slowly: the universal "big deal" frame.
    // The full-screen colour wash, from level 7. Drawn FIRST so everything else
    // sits on top of it -- a wash over the numeral would grey out the one thing
    // the popup exists to show.
    if (pop.wash) {
      const beats = pop.finale ? 3 : 2;
      const ph = (p01 * beats) % 1;
      const strength = (1 - ph) * alpha * (pop.finale ? 0.20 : 0.13);
      const tint = CONFETTI[Math.floor(p01 * beats) % CONFETTI.length];
      levelG.rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: tint, alpha: strength });
    }

    // WARM, not white. White at 5 % over a near-black field renders as grey
    // smudges that read as damage to the screen rather than as light.
    const rays = pop.rays || 10;
    for (let i = 0; i < rays; i++) {
      const a = (Math.PI * 2 * i) / rays + p01 * 0.8;
      levelG.moveTo(cx, cy)
        .lineTo(cx + Math.cos(a) * (pop.finale ? 900 : 250) * grow,
                cy + Math.sin(a) * (pop.finale ? 900 : 250) * grow)
        // Narrow and pale rather than wide and gold: at width 20 the rays
        // rendered as opaque brown bars laid over the field, which read as
        // damage to the screen instead of as light bursting out of the popup.
        .stroke({ width: pop.finale ? 9 : 7, color: 0xfff0b8,
                  alpha: (pop.finale ? 0.10 : 0.075) * alpha });
    }

    yayText.visible = true;
    levelText.visible = true;
    yayText.text = 'YAY!';
    levelText.text = String(pop.level);
    yayText.position.set(cx, cy - 92 * grow);
    levelText.position.set(cx, cy + 32 * grow);
    // The numeral grows with the level, capped: by ten it is half the screen,
    // which is the "whole screen goes" the ladder builds toward.
    const sizeUp = Math.min(1.9, 1 + (pop.level - 1) * 0.10);
    yayText.scale.set(grow * Math.min(1.5, sizeUp));
    levelText.scale.set(grow * sizeUp);
    yayText.alpha = alpha;
    levelText.alpha = alpha;
  }

  /** A thin XP bar under the score. Deliberately small and unlabelled: it is
   *  there so the popup is not a surprise out of nowhere, not to be read. */
  function drawXpBar(w) {
    const need = Math.round(XP.base * Math.pow(w.level, XP.curve));
    const frac = Math.max(0, Math.min(1, w.xp / need));
    // y=112 sits between the score and the stats block. It was 156, which is
    // inside the two-line stats readout -- the bar drew straight over it.
    const x = 46, y = 112, wid = 260, h = 12;
    xpG.clear();
    xpG.roundRect(x, y, wid, h, h / 2).fill({ color: 0x1b2540, alpha: 0.9 });
    if (frac > 0) {
      xpG.roundRect(x, y, Math.max(h, wid * frac), h, h / 2).fill({ color: 0x74d7ff });
    }
    xpG.roundRect(x, y, wid, h, h / 2).stroke({ width: 2, color: 0x0b1020, alpha: 0.8 });
  }

  function drawHud(w) {
    drawXpBar(w);
    drawLevelPopup(w);
    scoreText.text = `LV ${w.level}   ${w.stats.score}   ★ ${w.stats.coins}`;
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
    draw(w, dt = 1 / 60) {
      updateSky(w, dt);
      drawStars(w);
      world.x = CAMERA.mode === 'lateral' ? -w.camera.x : 0;
      g.clear();
      // Several toys run at once now; each block below asks for its own.
      const chainToy = activeToy(w, 'chain');
      const shieldToy = activeToy(w, 'shield');
      const punchToy = activeToy(w, 'punch');
      const buddiesToy = activeToy(w, 'buddies');
      const time = w.time;

      // TINTED PER BULLET, not per active toy. The base gun and the toy fire at
      // the same time now, so one colour for everything on screen would hide
      // the fact that the cannon never stopped -- which is the single thing the
      // player most needs to be able to see.
      for (const b of w.bullets) drawBullet(b);
      for (const m of w.monsters) if (m.alive) drawMonster(m, time);
      for (const c of w.coins) drawCoin(c);
      for (const h of w.hearts) drawHeart(h, time);
      for (const f of w.pops) {
        g.rect(f.x, f.y, f.size, f.size).fill({ color: f.tint, alpha: Math.min(1, f.t * 2) });
      }
      for (const c of w.toyPickups) drawToyPickup(c, time);

      // Buddy bots orbit OUTSIDE the pod, drawn before it so the pod stays the
      // thing the eye lands on.
      // The bomb chain, drawn under the pod. Rope first so the links sit on it.
      if (chainToy && chainToy.chain.length) {
        const toy = chainToy.kind;
        let px = w.player.x, py = w.player.y + PLAYER.radius;
        for (const c of chainToy.chain) {
          g.moveTo(px, py).lineTo(c.x, c.y)
           .stroke({ width: 7, color: PALETTE.outline, alpha: 0.9 });
          g.moveTo(px, py).lineTo(c.x, c.y)
           .stroke({ width: 3, color: toy.tint, alpha: 0.55 });
          px = c.x; py = c.y;
        }
        for (const c of chainToy.chain) {
          drawBuddyBomb({ x: c.x, y: c.y, a: c.x * 0.01, armT: c.armT }, toy, time, toy.radius);
        }
      }

      // The shield: a bubble the player is inside, with one arc per remaining
      // charge around its rim. The charges are the number that matters, and a
      // child counts arcs faster than they read a digit.
      if (shieldToy && shieldToy.charges > 0) {
        const toy = shieldToy.kind;
        const R = toy.radiusPx;
        const px = w.player.x, py = w.player.y;
        const breathe = 1 + Math.sin(time * 3) * 0.03;
        g.circle(px, py, R * breathe).fill({ color: toy.tint, alpha: 0.13 });
        g.circle(px, py, R * breathe).stroke({ width: 4, color: toy.tint, alpha: 0.5 });
        for (let i = 0; i < shieldToy.charges; i++) {
          const a0 = -Math.PI / 2 + (Math.PI * 2 * i) / shieldToy.charges + time * 0.5;
          const a1 = a0 + Math.PI * 2 / shieldToy.charges * 0.62;
          g.moveTo(px + Math.cos(a0) * R * breathe, py + Math.sin(a0) * R * breathe)
           .arc(px, py, R * breathe, a0, a1)
           .stroke({ width: 9, color: toy.tint, alpha: 0.95 });
        }
        // A brighter flash for the instant right after a save.
        if (shieldToy.graceT > 0) {
          g.circle(px, py, R * breathe).fill({ color: 0xffffff, alpha: 0.22 * (shieldToy.graceT / toy.graceS) });
        }
      }

      // The punch arm: segments out to a fist. Drawn before the pod so the arm
      // emerges from behind it rather than sitting on top of the pilot.
      if (punchToy) {
        const toy = punchToy.kind;
        const ext = punchExtension(w);
        if (ext > 0) {
          const st = punchToy.punch;
          const px = w.player.x, py = w.player.y;
          const hx = px + (st.tx - px) * ext;
          const hy = py + (st.ty - py) * ext;
          // Segments thin toward the fist, which is what makes it read as an arm
          // reaching rather than as a beam.
          const segs = 5;
          for (let i = 1; i <= segs; i++) {
            const f = i / segs;
            const sx = px + (hx - px) * f, sy = py + (hy - py) * f;
            g.circle(sx, sy, 13 - i * 1.2).fill({ color: toy.tint });
            g.circle(sx, sy, 13 - i * 1.2).stroke({ width: 3, color: PALETTE.outline, alpha: 0.8 });
          }
          g.circle(hx, hy, toy.fistPx).fill({ color: toy.tint });
          g.circle(hx, hy, toy.fistPx).stroke({ width: 5, color: PALETTE.outline });
          // Knuckles, so the fist is a fist.
          for (const k of [-0.45, 0, 0.45]) {
            g.circle(hx + k * toy.fistPx * 0.9, hy - toy.fistPx * 0.34, toy.fistPx * 0.17)
             .fill({ color: 0xffffff, alpha: 0.55 });
          }
        }
      }

      if (buddiesToy) {
        const toy = buddiesToy.kind;
        for (const b of buddiesToy.buddies) {
          if (b.x === undefined) continue;
          drawBuddyBomb(b, toy, time);
        }
      }

      // Blast rings, under everything: they are a readout of reach, not an
      // effect to look at. Drawn expanding and fading, so the radius the player
      // learns is the radius the code actually used.
      for (const b of w.blasts) {
        const p01 = 1 - b.t / b.total;
        // Each blast carries the radius it actually used -- the trail's bombs
        // and the buddy bombs are different sizes, and a ring drawn at the wrong
        // one teaches the player a reach that is not real.
        const r = (b.radiusPx || SQUAD.bomb.radiusPx) * (0.25 + 0.75 * p01);
        g.circle(b.x, b.y, r).stroke({
          width: 10 * (1 - p01) + 2, color: b.tint, alpha: 0.75 * (1 - p01),
        });
        g.circle(b.x, b.y, r * 0.66).fill({ color: 0xffffff, alpha: 0.22 * (1 - p01) });
      }

      // Tail first so each member overlaps the one behind it and the line reads
      // as receding, and all of them before the pod so the player stays the
      // thing the eye lands on.
      for (let i = w.squad.length - 1; i >= 0; i--) drawSquadMember(w.squad[i], time);

      if (w.player.alive) drawPod(w.player, time, w.level);

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
      // ONE BAR PER ACTIVE TOY, stacked. Each in its own tint, so the stack is
      // a legend as well as a countdown: a child can see they have three things
      // running and watch them expire at different times, without reading a word.
      //
      // Narrower than the single bar was, because five of them at full width
      // would be a wall under the pod rather than a readout.
      const bar = TOYS.timerBar;
      const stack = w.toys.filter((inst) => inst.total > 0);
      // Anything that occupies the space BELOW the pod pushes the whole stack
      // above it -- the chain drew straight through the old single bar.
      const above = stack.some((inst) => inst.kind.timerAbove);
      const rowH = bar.height + 6;
      for (let i = 0; i < stack.length; i++) {
        const inst = stack[i];
        const frac = Math.max(0, Math.min(1, inst.t / inst.total));
        const wid = bar.width * 0.78;
        const bx = w.player.x - wid / 2;
        const by = above
          ? w.player.y - PLAYER.radius - bar.offsetY - bar.height - 18 - i * rowH
          : w.player.y + PLAYER.radius + bar.offsetY + i * rowH;
        const r = bar.height / 2;
        g.roundRect(bx, by, wid, bar.height, r)
         .fill({ color: PALETTE.outline, alpha: 0.85 });
        if (frac > 0) {
          // Shrinks from both ends toward the centre, so a bar stays centred
          // under the pod instead of appearing to slide off to the left as it
          // empties -- at this size, an off-centre bar reads as the pod being
          // lopsided rather than as a timer running out.
          const wFill = Math.max(bar.height, wid * frac);
          g.roundRect(w.player.x - wFill / 2, by, wFill, bar.height, r)
           .fill({ color: inst.kind.tint });
        }
        g.roundRect(bx, by, wid, bar.height, r)
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
