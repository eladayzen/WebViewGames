// The turtle's movement and the rules of the run. Pure logic: no DOM, no
// three.js, so tools/sim.mjs can play thousands of seconds of it headless.
//
// He runs right on his own, at a speed set only by the time ramp. Lean LEFT or RIGHT = jump;
// again in the air = double jump; hold it = a jump on every landing.
//   - run off a roof edge without jumping -> fall between buildings: a life
//   - jump short into a taller building's wall -> slide down it: a life
//   - run into a Foot soldier -> a life; ROLL into one, or LAND on one -> KO
//   - a crate (barrier) must be JUMPED; a hanging sign (overhead) must be ROLLED
//     under; a shielded ninja can only be KO'd by a ROLL
import { PLAYER, SPEED, RUN, ENEMY, HAZARD, PICKUP } from './constants.js';
import { airTime } from './world.js';

export function createRunner(world, hooks = {}) {
  const p = {};
  function reset() {
    Object.assign(p, {
      x: 0, y: 0, vy: 0, grounded: true, roofY: 0,
      speed: SPEED.START, t: 0, buffer: 0, coyote: 0, invuln: 0, freeze: 0,
      dist: 0, pizzas: 0, hearts: 0, kos: 0, jumps: 0, falls: 0, hits: 0,
      airJumps: 0, wall: false, off: false, airT: 0, landT: 9, doubleT: 9, hurtT: 9, stompT: 9, still: true, onPad: false, rollT: 9, rolls: 0,
    });
  }

  const score = () => Math.floor(p.dist * RUN.SCORE_PER_M + p.pizzas * RUN.PIZZA + p.kos * RUN.KO + p.hearts * RUN.HEART);

  function jump() {
    p.buffer = 0; p.coyote = 0;
    p.grounded = false; p.vy = PLAYER.JUMP_V; p.airT = 0; p.jumps++; p.airJumps = 0;
    hooks.onJump && hooks.onJump();
  }
  function airJump() {                              // double jump: a second push in mid-air
    p.buffer = 0; p.vy = PLAYER.AIR_JUMP_V; p.airJumps++; p.airT = 0; p.jumps++; p.doubleT = 0;
    hooks.onJump && hooks.onJump(true);
  }


  function hurt() {
    if (p.invuln > 0) return;
    p.invuln = RUN.INVULN_S; p.hits++; p.hurtT = 0;
    hooks.onDamage && hooks.onDamage('hit');
  }

  /** After a fall: the start of the next roof ahead, cleared of Foot soldiers. */
  function respawn() {
    const r = world.nextRoof(p.x) || world.roofAt(p.x);
    if (!r) return;
    Object.assign(p, {
      x: r.x0 + 1.5, y: r.y, roofY: r.y, vy: 0, grounded: true, wall: false,
      buffer: 0, coyote: 0, freeze: RUN.RESPAWN_FREEZE_S,
      invuln: RUN.INVULN_S + RUN.RESPAWN_FREEZE_S,
    });
    const near = (o) => o.x > r.x0 && o.x < r.x0 + p.speed * 1.5;
    for (const f of world.foes) if (f.alive && near(f)) f.alive = false;
    world.barriers = world.barriers.filter((o) => !near(o));
    world.overheads = world.overheads.filter((o) => !near(o));
    hooks.onRespawn && hooks.onRespawn();
  }

  /** action: a tap (any truthy value = jump). Edge-triggered only: holding does nothing. */
  function frame(dt, action, live) {
    if (action) action = 'jump';                    // any tap, left or right, is a jump
    p.still = !live || p.freeze > 0;      // standing in place: countdown, respawn freeze, game over
    p.invuln = Math.max(0, p.invuln - dt);
    p.landT += dt; p.doubleT += dt; p.hurtT += dt; p.stompT += dt;
    for (const f of world.foes) { f.t += dt; if (f.ko >= 0) f.ko += dt; }
    if (!live) return;
    world.ensure(p.x + 160, p.x - 60);
    if (p.freeze > 0) { p.freeze -= dt; p.buffer = 0; return; }

    // speed: the time ramp, and nothing else (no input, hit or move changes it)
    p.t += dt;
    world.tick && world.tick(p.t);                  // lifts move
    const base = SPEED.START + (SPEED.MAX - SPEED.START) * Math.min(1, p.t / SPEED.RAMP_S);
    const target = base;
    p.speed += (target - p.speed) * Math.min(1, SPEED.EASE * dt);
    const dx = p.wall ? 0 : p.speed * dt;
    p.x += dx; p.dist += dx;

    // the jump: on a roof, just after leaving one, or buffered before landing.
    // In the air, a fresh tap is the double jump -- unless he is about to land, when it buffers a jump instead.
    if (action === 'jump') {
      const fl = world.surfaceBelow(p.x, p.y + 0.02);
      const nearFloor = fl && p.vy < 0 && p.y - fl.y < 0.9;
      if (p.grounded || p.coyote > 0) jump();
      else if (p.airJumps < PLAYER.AIR_JUMPS && p.airT > 0.12 && !nearFloor) airJump();
      else p.buffer = PLAYER.BUFFER_S;
    } else if (p.buffer > 0) p.buffer -= dt;

    if (p.grounded) p.airJumps = 0;
    if (p.grounded) {
      // the floor under his feet: a roof, a lift or a hover pad. Walk off its end
      // and he falls to whatever is below (or to his death between buildings).
      const f = world.surfaceBelow(p.x, p.y + 0.1);
      if (!f || p.y - f.y > 0.1) {
        p.grounded = false; p.vy = 0; p.coyote = PLAYER.COYOTE_S; p.airT = 0;
        if (p.onPad) p.invuln = Math.max(p.invuln, RUN.PAD_GRACE_S);   // dropped off a pad
        p.onPad = false;
      } else { p.y = f.y; p.roofY = f.y; p.onPad = !!f.pad; }
    } else {
      p.coyote = Math.max(0, p.coyote - dt);
      p.airT += dt;
      const prevY = p.y;
      p.vy -= PLAYER.G * dt;
      p.y += p.vy * dt;
      const f = world.surfaceBelow(p.x, prevY + 0.02);     // floors below his feet last frame: pads let him up through from below
      const r = world.roofAt(p.x);                          // the building here: its wall can stop him
      if (f && !p.wall && p.y <= f.y) {                     // landed on top
        p.y = f.y; p.roofY = f.y; p.vy = 0; p.grounded = true; p.landT = 0; p.onPad = !!f.pad;
        hooks.onLand && hooks.onLand();
        if (p.buffer > 0) jump();
      } else if (r && !p.wall) {
        if (p.y < r.y - 0.45) {                              // into the wall
          p.wall = true; p.x = r.x0 - PLAYER.W / 2; p.vy = Math.min(p.vy, 0);
        } else if (p.y < r.y && prevY < r.y) {               // clipped the ledge: step up
          p.y = r.y; p.roofY = r.y; p.vy = 0; p.grounded = true; p.landT = 0;
          hooks.onLand && hooks.onLand();
        }
      }
      if (p.y < p.roofY - PLAYER.FALL_OUT) {
        p.falls++;
        if (hooks.onFall) hooks.onFall(world.roofAt(p.x) || world.nextRoof(p.x - 6), p);
        hooks.onDamage && hooks.onDamage('fall');
        respawn();
      }
    }

    // Foot soldiers: stomp them from above (or jump over), else get hurt
    for (const f of world.foes) {
      if (!f.alive) continue;
      if (Math.abs(f.x - p.x) > (PLAYER.W + ENEMY.W) / 2) continue;
      if (p.y > f.y + ENEMY.H || p.y + PLAYER.H < f.y) continue;
      if (!p.grounded && p.vy < 0 && p.y > f.y + ENEMY.H * 0.4) {
        f.alive = false; f.ko = 0; p.kos++; p.vy = PLAYER.JUMP_V * 0.55; p.stompT = 0;
        hooks.onKO && hooks.onKO(f);
      } else hurt();
    }
    // crates: jump them.
    const H = PLAYER.H;
    for (const b of world.barriers) {
      if (Math.abs(b.x - p.x) < (HAZARD.BARRIER_W + PLAYER.W) / 2 && p.y < b.y + HAZARD.BARRIER_H - 0.05 && p.y + H > b.y) hurt();
    }
    for (const o of world.overheads) {
      if (Math.abs(o.x - p.x) < (HAZARD.OVER_W + PLAYER.W) / 2 && p.y + H > o.y + HAZARD.OVER_LOW && p.y < o.y + HAZARD.OVER_TOP) hurt();
    }
    // pickups (a small vertical radius: things hung at jump height need a jump)
    const cy = p.y + PLAYER.H / 2;
    for (const z of world.pizzas) {
      if (z.taken || Math.abs(z.x - p.x) > PICKUP.RX) continue;
      if (Math.abs(z.y - cy) < PICKUP.RY) { z.taken = true; p.pizzas++; hooks.onPizza && hooks.onPizza(z); }
    }
    for (const h of world.hearts) {
      if (h.taken || Math.abs(h.x - p.x) > PICKUP.RX + 0.2) continue;
      if (Math.abs(h.y - cy) < PICKUP.RY + 0.2) { h.taken = true; p.hearts++; hooks.onHeart && hooks.onHeart(h); }
    }
  }

  reset();
  return { p, reset, frame, score, respawn };
}

/**
 * A bot that plays like a careful player: it only reacts to what is a fixed
 * time ahead. tools/sim.mjs uses it to prove the generator is beatable; in the
 * game it is the dev autopilot (P).
 */
export function botWantsTap(runner, world, high = false) {
  const p = runner.p;
  if (!p.grounded || p.freeze > 0) return null;
  const v = p.speed;
  const f = world.surfaceBelow(p.x, p.y + 0.1);
  if (!f) return null;

  // high road: climb onto pads whenever one is within reach, hop pad to pad
  const padAhead = () => {
    for (const q of world.pads) {
      if (q === f || q.x1 < p.x) continue;
      const dy = q.y - f.y;
      if (dy > 0.9 && dy < 3.6) {                         // above us: jump so we land inside it
        const dL = v * airTime(dy);
        if (q.x0 + 1.2 - p.x <= dL && q.x1 - 1.2 - p.x >= dL) return 'up';
      } else if (f.pad && Math.abs(dy) < 0.9 && q.x0 >= f.x1 - 0.2 && q.x0 - f.x1 < v * airTime(0) * 0.6) return 'hop';
    }
    return null;
  };
  if (f.pad) {                                            // on a pad
    if (!high && !f.sky) return null;
    const a = padAhead();
    if (a === 'up') return 'jump';
    if (f.sky && f.x1 - p.x < v * 0.07 + 0.15) return 'jump';   // a skyway: the pad's edge is always a take-off
    if (a === 'hop' && f.x1 - p.x < v * 0.07 + 0.15) return 'jump';
    return null;
  }
  // (only climb if no ground hazard is in the way of the jump)
  const hazardWithin = (d) => [world.foes, world.barriers, world.overheads].some((arr) => arr.some((o) => (o.alive === undefined || o.alive) && o.x > p.x - 0.5 && o.x < p.x + d));
  if (high && padAhead() === 'up' && !hazardWithin(v * 0.75)) return 'jump';

  // the ground: a gap takes off at the roof's edge
  if (f.x1 - p.x < v * 0.07 + 0.15) return 'jump';
  // the nearest hazard ahead decides the move
  let best = null, bd = 1e9;
  const see = (o, kind) => { const d = o.x - p.x; if (d >= -0.3 && d < bd) { bd = d; best = kind; } };
  for (const q of world.foes) if (q.alive) see(q, 'jump');
  for (const o of world.barriers) see(o, 'jump');
  if (best === 'jump') return bd < v * (PLAYER.JUMP_V / PLAYER.G) * 0.95 + 0.1 ? 'jump' : null;       // apex over the crate / the ninja
  return null;
}
