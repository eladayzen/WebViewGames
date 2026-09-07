// POC renderer: everything is drawn from code in the concept-09 palette.
//
// PLACEHOLDER ON PURPOSE. The art is locked (concept-09) but not yet made, and
// the questions this POC exists to answer -- how the camera should behave and
// how close a monster may pass -- are answered by MOTION, not by texture. Real
// sprites drop in behind the same shapes later; nothing here decides anything
// about the art beyond silhouette scale and palette.

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { DESIGN_W, DESIGN_H, CAMERA, PLAYER, BULLETS, COINS, MONSTERS, TOYS } from '../data/tuning.js';

const PALETTE = {
  bg: 0x0b1020,
  star: 0xffffff,
  pod: 0xd8dee8,
  podTrim: 0x4a90d9,
  pilot: 0xf5a623,
  bullet: 0x74d7ff,
  coin: 0xffc93c,
  heart: 0xff6b6b,
};

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
    starPts.push({ x: rnd() * DESIGN_W, y: rnd() * DESIGN_H * 2, r: 1 + rnd() * 2.2, a: 0.25 + rnd() * 0.6 });
  }

  const g = new Graphics();
  world.addChild(g);

  const style = (size, fill) => new TextStyle({
    fill, fontFamily: 'system-ui, sans-serif', fontSize: size, fontWeight: '700',
  });
  const scoreText = new Text({ text: '', style: style(38, '#eaf2ff') });
  scoreText.position.set(84, 20);
  const statsText = new Text({ text: '', style: style(22, '#8fb4d9') });
  statsText.position.set(84, 74);
  const heartsG = new Graphics();
  hud.addChild(scoreText, statsText, heartsG);

  function drawStars(w) {
    starG.clear();
    const off = CAMERA.mode === 'drift' ? w.camera.starOffset % DESIGN_H : 0;
    for (const s of starPts) {
      const y = ((s.y + off) % (DESIGN_H * 2)) - DESIGN_H * 0.5;
      if (y < -10 || y > DESIGN_H + 10) continue;
      starG.circle(s.x, y, s.r).fill({ color: PALETTE.star, alpha: s.a });
    }
  }

  function drawMonster(m) {
    const squash = 1 + Math.sin(m.wobble) * 0.05;
    const rx = m.r * squash;
    const ry = m.r / squash;
    const flash = m.hitT > 0;
    // Body: a blob, not a circle -- flat fill plus a darker rim, which is the
    // whole of concept-09's rendering.
    g.ellipse(m.x, m.y, rx, ry).fill({ color: flash ? 0xffffff : m.tint });
    g.ellipse(m.x, m.y, rx, ry).stroke({ width: 5, color: 0x131a2b, alpha: 0.9 });
    if (m.horns) {
      g.moveTo(m.x - rx * 0.55, m.y - ry * 0.72)
       .lineTo(m.x - rx * 0.78, m.y - ry * 1.16)
       .lineTo(m.x - rx * 0.28, m.y - ry * 0.92)
       .fill({ color: 0xf0b429 });
      g.moveTo(m.x + rx * 0.55, m.y - ry * 0.72)
       .lineTo(m.x + rx * 0.78, m.y - ry * 1.16)
       .lineTo(m.x + rx * 0.28, m.y - ry * 0.92)
       .fill({ color: 0xf0b429 });
    }
    const eyeR = m.r * (m.eyes === 1 ? 0.30 : 0.22);
    const xs = m.eyes === 1 ? [0] : [-m.r * 0.30, m.r * 0.30];
    for (const ex of xs) {
      g.circle(m.x + ex, m.y - m.r * 0.10, eyeR).fill({ color: 0xffffff });
      g.circle(m.x + ex, m.y - m.r * 0.10, eyeR * 0.45).fill({ color: 0x14213d });
    }
    // Health, as a shrinking pip row rather than a bar: an eight-year-old reads
    // "two left" faster than a fraction.
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

  function drawPod(p) {
    const blink = p.invulnT > 0 && Math.floor(p.invulnT * 12) % 2 === 0;
    if (blink) return;
    const tilt = p.lean * 0.18;
    const r = PLAYER.radius;
    g.ellipse(p.x, p.y + r * 0.35, r * 1.28, r * 0.52).fill({ color: PALETTE.podTrim });
    g.ellipse(p.x, p.y + r * 0.35, r * 1.28, r * 0.52).stroke({ width: 5, color: 0x131a2b });
    g.circle(p.x + tilt * r, p.y - r * 0.12, r * 0.72).fill({ color: PALETTE.pod, alpha: 0.9 });
    g.circle(p.x + tilt * r, p.y - r * 0.12, r * 0.72).stroke({ width: 5, color: 0x131a2b });
    g.circle(p.x + tilt * r, p.y - r * 0.10, r * 0.40).fill({ color: PALETTE.pilot });
    g.circle(p.x + tilt * r - 8, p.y - r * 0.18, 6).fill({ color: 0xffffff });
    g.circle(p.x + tilt * r + 8, p.y - r * 0.18, 6).fill({ color: 0xffffff });
    g.circle(p.x + tilt * r - 8, p.y - r * 0.18, 3).fill({ color: 0x14213d });
    g.circle(p.x + tilt * r + 8, p.y - r * 0.18, 3).fill({ color: 0x14213d });
  }

  function drawHud(w) {
    scoreText.text = `${w.stats.score}   ★ ${w.stats.coins}`;
    heartsG.clear();
    for (let i = 0; i < PLAYER.hearts; i++) {
      const on = i < w.player.hearts;
      heartsG.circle(DESIGN_W - 60 - i * 52, 44, 17)
        .fill({ color: on ? PALETTE.heart : 0x2a3550, alpha: on ? 1 : 0.7 });
    }
    if (!w.stats.showStatsOff) {
      const worst = w.stats.worstReactionS < 90 ? w.stats.worstReactionS.toFixed(2) + 's' : '--';
      statsText.text =
        `camera ${CAMERA.mode}   drift x${MONSTERS.driftMul.toFixed(2)}   ` +
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
      const shotTint = toy ? toy.tint : PALETTE.bullet;
      for (const b of w.bullets) {
        g.circle(b.x, b.y, BULLETS.radius).fill({ color: shotTint });
      }
      for (const m of w.monsters) if (m.alive) drawMonster(m);
      for (const c of w.coins) {
        g.circle(c.x, c.y, COINS.radius).fill({ color: PALETTE.coin });
        g.circle(c.x, c.y, COINS.radius).stroke({ width: 3, color: 0x8a6100 });
      }
      for (const f of w.pops) {
        g.rect(f.x, f.y, f.size, f.size).fill({ color: f.tint, alpha: Math.min(1, f.t * 2) });
      }
      // Toy pickups: a fat glowing bubble with the toy's colour, bobbing.
      for (const c of w.toyPickups) {
        const kind = TOYS.kinds[c.kind];
        const bob = Math.sin(c.bob) * 5;
        g.circle(c.x, c.y + bob, TOYS.radius + 8).fill({ color: kind.tint, alpha: 0.22 });
        g.circle(c.x, c.y + bob, TOYS.radius).fill({ color: kind.tint });
        g.circle(c.x, c.y + bob, TOYS.radius).stroke({ width: 4, color: 0x131a2b });
        g.circle(c.x - 7, c.y + bob - 8, 5).fill({ color: 0xffffff, alpha: 0.85 });
      }

      // Buddy bots orbit OUTSIDE the pod, drawn before it so the pod stays the
      // thing the eye lands on.
      if (toy && toy.id === 'buddies') {
        for (const b of w.toy.buddies) {
          if (b.x === undefined) continue;
          g.circle(b.x, b.y, toy.radius).fill({ color: toy.tint });
          g.circle(b.x, b.y, toy.radius).stroke({ width: 4, color: 0x131a2b });
          g.circle(b.x - 6, b.y - 4, 6).fill({ color: 0xffffff });
          g.circle(b.x + 6, b.y - 4, 6).fill({ color: 0xffffff });
          g.circle(b.x - 6, b.y - 4, 3).fill({ color: 0x14213d });
          g.circle(b.x + 6, b.y - 4, 3).fill({ color: 0x14213d });
        }
      }

      if (w.player.alive) drawPod(w.player);

      // THE TIMER IS A RING AROUND THE POD, not a bar in a corner: the player's
      // eyes never leave the field, and a closing ring reads at three metres
      // while standing on a board.
      if (toy && w.toy.total > 0) {
        const frac = Math.max(0, w.toy.t / w.toy.total);
        const r = PLAYER.radius + 26;
        const start = -Math.PI / 2;
        // moveTo FIRST. arc() continues the current path, so without this it
        // strokes a line from wherever the path happened to be -- which draws a
        // green streak across the whole field. Same trap as Nova Vanguard's.
        g.moveTo(w.player.x + Math.cos(start) * r, w.player.y + Math.sin(start) * r)
         .arc(w.player.x, w.player.y, r, start, start + Math.PI * 2 * frac)
         .stroke({ width: 7, color: toy.tint, alpha: 0.95 });
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
