/* Pixi renderer.
 *
 * Rendering is the second and last place orientation exists: everything here
 * asks `project()` where a (along, across) pair goes and never computes a
 * screen position itself.
 *
 * PixiJS rather than raw Canvas, following NovaVanguard -- the first 2D game
 * in this repo to take the step WEB_MINIGAME_TECH_RETROSPECTIVE.md argued for.
 * Pong is simple enough that raw Canvas would have done, but matching the
 * newest game keeps one 2D path rather than two, and keeps the sprite route
 * open when this stops being flat shapes.
 *
 * Nothing outside this directory imports pixi.js.
 */

import { Application, Container, Graphics } from 'pixi.js';
import { DESIGN_W, DESIGN_H, SHARED, PROFILES, PICKUPS } from '../data/tuning.js';
import { courtBox, project, CLASSIC } from '../data/orientation.js';
import { SIDE_NEAR, SIDE_FAR } from '../sim/world.js';
import { predictPath, contactPlane } from '../sim/physics.js';

const INK = {
  bg: 0x0a1020,
  court: 0x111a30,
  line: 0x2f4a7a,
  near: 0x4fd1ff,
  far: 0xff7a59,
  ball: 0xf6fbff,
  perk: 0xfee44f,
};

export async function createRenderer() {
  const app = new Application();
  await app.init({
    width: DESIGN_W,
    height: DESIGN_H,
    background: INK.bg,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.getElementById('app').appendChild(app.canvas);

  // The frame loop is ours (and, inside the WebView, Unity's -- see the rAF
  // shim in index.html). Pixi's own ticker would be a second, competing clock.
  app.ticker.stop();

  const root = new Container();
  app.stage.addChild(root);

  const bg = new Graphics();
  const play = new Graphics();
  const trail = new Graphics();
  const traj = new Graphics();
  const pickupsG = new Graphics();
  // Trajectory under everything else so it never obscures the ball it is
  // predicting; pickups above the trail but below the paddles.
  root.addChild(bg, traj, trail, pickupsG, play);

  const box = { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H, scale: 1 };
  let court = null;
  let orientation = CLASSIC;
  // The far side takes its opponent's colour, so who you are up against is
  // readable from the paddle and the goal line, not only from the score chip.
  let farTint = INK.far;
  const history = [];

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    box.scale = s;
    box.w = DESIGN_W * s;
    box.h = DESIGN_H * s;
    app.renderer.resize(box.w, box.h);
    root.scale.set(s);
    layout();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  /* Court geometry + the static furniture drawn on it. Recomputed only when
   * the frame or the orientation changes, not per frame. */
  function layout() {
    const ratio = PROFILES[orientation].courtRatio;
    court = courtBox(orientation, ratio, DESIGN_W, DESIGN_H);
    drawCourt();
  }

  function drawCourt() {
    bg.clear();
    bg.roundRect(court.x, court.y, court.w, court.h, 18).fill({ color: INK.court });
    bg.roundRect(court.x, court.y, court.w, court.h, 18).stroke({ width: 3, color: INK.line, alpha: 0.9 });

    // Halfway line, dashed along the ACROSS axis at the midpoint of ALONG --
    // which is a horizontal line in one orientation and a vertical one in the
    // other, without this code knowing or caring which.
    const dashes = 17;
    for (let i = 0; i < dashes; i++) {
      if (i % 2 === 1) continue;
      const a0 = (i / dashes) * court.A;
      const a1 = ((i + 0.75) / dashes) * court.A;
      const p0 = project(orientation, court.L / 2, a0, court);
      const p1 = project(orientation, court.L / 2, a1, court);
      bg.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
    }
    bg.stroke({ width: 4, color: INK.line, alpha: 0.55 });

    // Goal lines, tinted to whoever is defending them, so which end is yours
    // is readable at a glance in either orientation.
    for (const [side, colour] of [[SIDE_NEAR, INK.near], [SIDE_FAR, farTint]]) {
      const along = side === SIDE_NEAR ? 0 : court.L;
      const p0 = project(orientation, along, 0, court);
      const p1 = project(orientation, along, court.A, court);
      bg.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 6, color: colour, alpha: 0.75 });
    }
  }

  /* A paddle is a rounded bar spanning `half` either side of its position on
   * the across axis, and `paddleThickness` on the along axis. Both are in sim
   * units, so the projection decides which one ends up as screen width. */
  function drawPaddle(g, w, side) {
    const pad = w.paddles[side];
    const t = SHARED.paddleThickness;
    const a0 = project(orientation, pad.along - t / 2, pad.across - pad.half, court);
    const a1 = project(orientation, pad.along + t / 2, pad.across + pad.half, court);
    const x = Math.min(a0.x, a1.x);
    const y = Math.min(a0.y, a1.y);
    const w2 = Math.abs(a1.x - a0.x);
    const h2 = Math.abs(a1.y - a0.y);
    const r = Math.min(w2, h2) / 2;
    const colour = side === SIDE_NEAR ? INK.near : farTint;
    g.roundRect(x, y, w2, h2, r).fill({ color: colour });
    g.roundRect(x - 3, y - 3, w2 + 6, h2 + 6, r + 3).stroke({ width: 2, color: colour, alpha: 0.35 });
  }

  return {
    get court() {
      return court;
    },
    get box() {
      return box;
    },

    setOrientation(o) {
      orientation = o;
      history.length = 0;
      layout();
    },

    /* The goal line is drawn once into the static layer, so changing the far
     * colour has to redraw it rather than only affecting the next paddle. */
    setFarTint(tintValue) {
      farTint = tintValue;
      if (court) drawCourt();
    },

    start() {
      resize();
    },

    draw(w) {
      const b = w.ball;
      const p = project(orientation, b.along, b.across, court);
      const rPx = SHARED.ballRadius * court.scale;
      const now = performance.now() / 1000;

      // --- pickups ---------------------------------------------------------
      pickupsG.clear();
      for (const pk of w.pickups) {
        const c = project(orientation, pk.along, pk.across, court);
        const rr = PICKUPS.radius * court.scale;
        const pulse = 0.82 + Math.sin(now * 3 + pk.phase) * 0.18;
        // Fade out over the last couple of seconds, so a pickup about to
        // expire says so rather than vanishing mid-approach.
        const left = PICKUPS.lifetimeSec - pk.age;
        const alpha = left < 2 ? Math.max(0, left / 2) : 1;

        pickupsG.circle(c.x, c.y, rr * pulse).stroke({ width: 3, color: INK.perk, alpha: 0.9 * alpha });
        pickupsG.circle(c.x, c.y, rr * 0.55 * pulse).fill({ color: INK.perk, alpha: 0.28 * alpha });
        pickupsG.circle(c.x, c.y, rr * 0.18).fill({ color: INK.perk, alpha: 0.95 * alpha });
      }

      // --- trajectory perk -------------------------------------------------
      traj.clear();
      if (w.perks.trajectory > 0 && b.live) {
        const target = contactPlane(w, b.vAlong < 0 ? SIDE_NEAR : SIDE_FAR);
        const path = predictPath(w, target);
        // Fade the whole line out over the perk's last second rather than
        // having it disappear mid-rally with no warning.
        const fade = Math.min(1, w.perks.trajectory);
        for (let i = 0; i < path.length - 1; i++) {
          const a = project(orientation, path[i].along, path[i].across, court);
          const bb = project(orientation, path[i + 1].along, path[i + 1].across, court);
          traj.moveTo(a.x, a.y).lineTo(bb.x, bb.y);
        }
        traj.stroke({ width: 3, color: INK.perk, alpha: 0.5 * fade });
        // Mark the bounce corners and the arrival point.
        for (let i = 1; i < path.length; i++) {
          const q = project(orientation, path[i].along, path[i].across, court);
          traj.circle(q.x, q.y, 6).fill({ color: INK.perk, alpha: 0.75 * fade });
        }
      }

      // Short positional trail. At the top of the speed ramp the ball crosses
      // a good fraction of the court between frames, and a bare dot becomes
      // genuinely hard to track; the trail is what keeps it readable without
      // slowing the game down to compensate.
      if (b.live) {
        history.push(p);
        while (history.length > 9) history.shift();
      } else {
        history.length = 0;
      }

      trail.clear();
      for (let i = 0; i < history.length; i++) {
        const h = history[i];
        const f = (i + 1) / history.length;
        trail.circle(h.x, h.y, rPx * f * 0.85).fill({ color: INK.ball, alpha: 0.10 * f });
      }

      play.clear();
      drawPaddle(play, w, SIDE_NEAR);
      drawPaddle(play, w, SIDE_FAR);
      // Drawn while parked too -- the ball rides the server's paddle through
      // the serve pause, so the player can see where it is about to come from
      // and is already aiming it before it launches.
      if (b.live || b.parked) {
        play.circle(p.x, p.y, rPx).fill({ color: INK.ball });
        play.circle(p.x, p.y, rPx + 4).stroke({ width: 2, color: INK.ball, alpha: b.parked ? 0.55 : 0.3 });
      }

      app.render();
    },
  };
}
