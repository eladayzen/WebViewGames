// Bullets, coins, collisions and the pod itself. Small enough to live together;
// the moment any of it grows a second opinion it should split.

import { BULLETS, MONSTERS, COINS, HEARTS, PLAYER, SQUAD, TOYS, XP, DESIGN_W, DESIGN_H } from '../data/tuning.js';
import {
  maybeDropToy, steerHomingBullets, updateBuddies, updateChainBombs,
  consumeShield, updatePunch,
} from './toys.js';
import { registerHit } from './monsters.js';
import {
  playPop, playCoin, playPlayerHit, playBlast, playLevelUp, playHeart,
  playShieldSave, playPunch,
} from './audio.js';

// The concept's confetti is a party, not the colour of what just popped.
const CONFETTI = [0x7ed321, 0xf5a623, 0x9b59d0, 0x74d7ff, 0xff6b6b, 0xffc93c];

export function updatePlayer(w, input, dt) {
  const p = w.player;
  p.x += input.x * PLAYER.lateralMaxPxS * dt;
  p.y += input.y * PLAYER.verticalMaxPxS * dt;
  p.x = Math.max(PLAYER.clampMarginX, Math.min(DESIGN_W - PLAYER.clampMarginX, p.x));
  p.y = Math.max(PLAYER.clampMinY, Math.min(PLAYER.clampMaxY, p.y));
  // The pod leans into the turn -- squash-and-stretch's cheapest cousin, and
  // most of what makes it feel alive rather than dragged.
  p.lean += (input.x - p.lean) * Math.min(1, dt * 9);
  if (p.invulnT > 0) p.invulnT = Math.max(0, p.invulnT - dt);
}

/**
 * Move what has been fired. WHAT gets fired is decided in /systems/toys.js --
 * the base gun and any active toy, together, from one place.
 *
 * Bullets are born at the pod and are then INDEPENDENT of it, which is what
 * paints a ribbon behind a moving player rather than a column -- the
 * reference's signature read, and the reason the shot is worth watching.
 */
export function updateBullets(w, dt) {
  steerHomingBullets(w, dt);
  const out = 60;
  for (const b of w.bullets) {
    if (!b.alive) continue;
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    if (b.y < -out || b.y > DESIGN_H + out || b.x < -out || b.x > DESIGN_W + out) b.alive = false;
  }
  w.bullets = w.bullets.filter((b) => b.alive);
}

export function popMonster(w, m, rng) {
  m.alive = false;
  m.hitT = 0;
  // Pitched by tier, so a big one pops lower than a small one and the field has
  // a range rather than one repeated noise.
  playPop(1 - Math.min(1, m.maxHp / 42));
  w.stats.popped++;
  w.stats.score += m.points;
  addXp(w, XP.perPop[m.tierName] || 10);
  maybeDropHeart(w, m, rng);
  // AFTER the count is incremented: maybeRecruit tests `popped % everyNPops`,
  // and reading the pre-increment value recruits on the wrong pop -- off by one
  // forever, and invisible because the line still grows at the right rate.
  maybeRecruit(w, m);
  maybeDropToy(w, m, rng);
  for (let i = 0; i < m.coins; i++) {
    const a = rng.next() * Math.PI * 2;
    const s = 40 + rng.next() * 90;
    w.coins.push({
      alive: true, x: m.x, y: m.y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: COINS.lifeS,
    });
  }
  // Confetti: cosmetic only, and the reason a pop reads as a celebration
  // rather than a death. MIXED COLOURS, as in the concept frame -- confetti in
  // the dead monster's own colour reads as debris, which is the one thing rule
  // 4 (nobody dies) is trying not to show a six-year-old.
  for (let i = 0; i < 14; i++) {
    const a = rng.next() * Math.PI * 2;
    const s = 90 + rng.next() * 220;
    w.pops.push({
      alive: true, x: m.x, y: m.y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0.5 + rng.next() * 0.4,
      tint: CONFETTI[Math.floor(rng.next() * CONFETTI.length)],
      size: 5 + rng.next() * 7,
    });
  }
}

export function updateCollisions(w, rng, dt) {
  // The buddy bombs detonate by touch, which is how they answer the monsters
  // that arrive from below without the player having to turn toward them.
  const boom = (x, y, tint, dmg, radius) => detonate(w, x, y, tint, rng, dmg, radius);
  updateBuddies(w, boom);
  updateChainBombs(w, boom);
  updatePunch(w, dt, (m) => {
    playPunch();
    registerHit(m, TOYS.kinds.punch.damage);
    if (m.hp <= 0) popMonster(w, m, rng);
  });

  // Bullets vs monsters.
  for (const b of w.bullets) {
    if (!b.alive) continue;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const dx = b.x - m.x, dy = b.y - m.y;
      if (dx * dx + dy * dy > (m.r + BULLETS.radius) * (m.r + BULLETS.radius)) continue;
      b.alive = false;
      registerHit(m, b.damage || BULLETS.damage);
      if (m.hp <= 0) popMonster(w, m, rng);
      break;
    }
  }

  // Monsters vs the pod.
  const p = w.player;
  if (p.invulnT <= 0 && p.alive) {
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > m.r + PLAYER.radius) continue;
      // THE SHIELD GETS FIRST REFUSAL. Checked before the heart is taken, which
      // is the only order that works -- and the monster still giggles away
      // either way, because rule 4 has no exception for being blocked.
      if (consumeShield(w)) {
        playShieldSave();
        popMonster(w, m, rng);
        break;
      }
      p.hearts--;
      p.invulnT = PLAYER.invulnS;
      w.stats.contacts++;
      playPlayerHit();
      // Being touched clears the toucher: nobody is ground down by one monster
      // parked on top of them, and the hit reads as an event rather than a
      // state.
      popMonster(w, m, rng);
      if (p.hearts <= 0) p.alive = false;
      break;
    }
  }
}

/**
 * Recruit the monster that just popped, if it is the Nth.
 *
 * It keeps its own face -- tint, eye count, horns -- so the line is visibly
 * made of the specific monsters this run happened to meet, not a row of
 * identical mascots. That is most of why it reads as "my squad".
 */
function maybeRecruit(w, m) {
  if (!SQUAD.enabled) return;
  if (w.squad.length >= SQUAD.maxMembers) return;
  if (w.stats.popped % SQUAD.everyNPops !== 0) return;
  w.squad.push({
    tint: m.tint,
    eyes: m.eyes,
    horns: m.horns,
    // Born at zero size and swelling, so joining is an event.
    joinT: SQUAD.joinS,
    armT: SQUAD.bomb.armS,
    bob: Math.random() * Math.PI * 2,
    x: m.x, y: m.y,
  });
}

/**
 * Move the squad.
 *
 * Each member reads a position the POD OCCUPIED a moment ago -- deeper into the
 * history the further back it sits. Nothing here steers or seeks: a follower
 * that chases the leader's CURRENT position cuts every corner and the line
 * collapses into a clump the first time the player weaves. Reading a delayed
 * position instead traces the player's actual route, which is what makes a lean
 * send a ripple down the whole tail.
 */
export function updateSquad(w, dt) {
  if (!SQUAD.enabled) return;
  const p = w.player;

  // Record the path, not the clock: a point is only added once the pod has
  // actually travelled `pathStepPx`. Standing still adds nothing, which is what
  // lets a stationary line keep its shape instead of collapsing.
  const last = w.trail[w.trail.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= SQUAD.pathStepPx) {
    w.trail.push({ x: p.x, y: p.y });
  }
  // Enough path to seat a full line, plus slack for the curve.
  const lineLen = SQUAD.leadPx + (SQUAD.maxMembers + 1) * SQUAD.spacingPx;
  const maxPoints = Math.ceil(lineLen / SQUAD.pathStepPx);
  while (w.trail.length > maxPoints) w.trail.shift();

  // Walk BACK along the path, dropping a member every `spacingPx` of travel.
  // One pass seats the whole line, and because the walk is by arc length the
  // spacing survives the player weaving, stopping or reversing.
  let mi = 0;
  let travelled = 0;
  // The first member sits `leadPx` back; every one after it adds `spacingPx`.
  let want = SQUAD.leadPx;
  let cx = p.x, cy = p.y;
  for (let i = w.trail.length - 1; i >= 0 && mi < w.squad.length; i--) {
    const pt = w.trail[i];
    const seg = Math.hypot(pt.x - cx, pt.y - cy);
    while (mi < w.squad.length && travelled + seg >= want) {
      // Interpolate WITHIN the segment, so spacing is exact rather than snapped
      // to whichever recorded point happens to be nearest.
      const f = seg === 0 ? 0 : (want - travelled) / seg;
      const mem = w.squad[mi];
      mem.x = cx + (pt.x - cx) * f;
      mem.y = cy + (pt.y - cy) * f;
      mi++;
      want += SQUAD.spacingPx;
    }
    travelled += seg;
    cx = pt.x; cy = pt.y;
  }
  // Any member the path is not yet long enough to seat (a fresh run) eases in
  // behind the pod rather than sitting at the origin.
  for (; mi < w.squad.length; mi++) {
    const mem = w.squad[mi];
    mem.x += (cx - mem.x) * Math.min(1, dt * 3);
    mem.y += (cy - mem.y) * Math.min(1, dt * 3);
  }

  for (const mem of w.squad) {
    if (mem.joinT > 0) mem.joinT = Math.max(0, mem.joinT - dt);
    if (mem.armT > 0) mem.armT = Math.max(0, mem.armT - dt);
    mem.bob += dt * SQUAD.bobPxS;
  }
}

/**
 * Squad members detonate on contact.
 *
 * Runs AFTER the line has been positioned, so a member blows up where it is
 * actually drawn rather than where it was last frame -- at these speeds that is
 * a visible difference on a fast weave.
 *
 * Iterated back to front and spliced, because a detonation removes the member
 * and everything behind it shifts forward a place.
 */
export function updateSquadBombs(w, rng) {
  if (!SQUAD.enabled) return;
  for (let i = w.squad.length - 1; i >= 0; i--) {
    const mem = w.squad[i];
    if (mem.armT > 0 || mem.joinT > 0) continue;

    let touched = null;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - mem.x, m.y - mem.y) > m.r + SQUAD.radius) continue;
      touched = m;
      break;
    }
    if (!touched) continue;

    w.squad.splice(i, 1);
    detonate(w, mem.x, mem.y, mem.tint, rng, SQUAD.bomb.damage, SQUAD.bomb.radiusPx);
  }
}

/**
 * The blast itself: damage everything in the radius, then the spectacle.
 *
 * Shared by the (parked) squad trail and the Buddy Bombs, with damage and radius
 * passed in rather than read from one config -- they are different weapons and
 * the only thing they have in common is what an explosion looks like.
 */
export function detonate(w, x, y, tint, rng, damage, radiusPx) {
  playBlast();
  for (const m of w.monsters) {
    if (!m.alive) continue;
    if (Math.hypot(m.x - x, m.y - y) > radiusPx + m.r) continue;
    registerHit(m, damage);
    if (m.hp <= 0) popMonster(w, m, rng);
  }
  // The ring is the readout: it says exactly how far the blast reached, which is
  // the only way a player learns the radius without being told it.
  w.blasts.push({ alive: true, x, y, t: 0.42, total: 0.42, tint, radiusPx });
  for (let i = 0; i < 18; i++) {
    const a = rng.next() * Math.PI * 2;
    const sp = 150 + rng.next() * 320;
    w.pops.push({
      alive: true, x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: 0.45 + rng.next() * 0.4,
      tint: CONFETTI[Math.floor(rng.next() * CONFETTI.length)],
      size: 6 + rng.next() * 8,
    });
  }
}

export function updateBlasts(w, dt) {
  for (const b of w.blasts) {
    b.t -= dt;
    if (b.t <= 0) b.alive = false;
  }
  w.blasts = w.blasts.filter((b) => b.alive);
}

/** What the next level costs. Super-linear, so early levels teach the popup and
 *  later ones still feel earned. */
export function xpForLevel(level) {
  return Math.round(XP.base * Math.pow(level, XP.curve));
}

/**
 * Bank experience, and fire the celebration when it crosses.
 *
 * `while`, not `if`: one big pop plus a handful of coins can cross two
 * thresholds at once, and an `if` would swallow the second level silently --
 * the player would watch the bar fill and nothing happen.
 */
export function addXp(w, amount) {
  w.xp += amount;
  let need = xpForLevel(w.level);
  while (w.xp >= need) {
    w.xp -= need;
    w.level++;
    celebrate(w, w.level);
    playLevelUp(w.level);
    need = xpForLevel(w.level);
  }
}

/**
 * Fire the celebration for a level.
 *
 * Each tier adds a new KIND of thing rather than more of the last one, because
 * a child has to be able to tell level 7 from level 3 at a glance without
 * reading the numeral -- and "more confetti" is not something anyone can see
 * the difference in once there is already confetti.
 */
export function celebrate(w, level) {
  const dur = Math.min(XP.popupMaxS, XP.popupS + (level - 1) * XP.popupPerLevelS);
  const finale = level >= XP.finaleLevel;
  w.levelPopup = {
    t: dur,
    total: dur,
    level,
    // Precomputed so the renderer never re-decides the tier mid-animation.
    rays: level >= XP.rainFromLevel ? 20 : 10,
    wash: level >= XP.washFromLevel,
    finale,
  };

  // Confetti out of the popup itself.
  if (level >= XP.confettiFromLevel) {
    const n = Math.min(XP.confettiMax, (level - XP.confettiFromLevel + 1) * XP.confettiPerLevel);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 160 + Math.random() * 520;
      w.pops.push({
        alive: true, x: DESIGN_W * 0.5, y: DESIGN_H * 0.52,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0.7 + Math.random() * 0.8,
        tint: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
        size: 6 + Math.random() * 10,
      });
    }
  }

  // Confetti raining from above. Spread across the FULL width and given a
  // spread of start times, so it falls as weather rather than as one curtain.
  if (level >= XP.rainFromLevel) {
    const n = Math.min(XP.rainMax, (level - XP.rainFromLevel + 1) * XP.rainPerLevel);
    for (let i = 0; i < n; i++) {
      w.pops.push({
        alive: true,
        x: Math.random() * DESIGN_W,
        y: -40 - Math.random() * 500,
        vx: (Math.random() - 0.5) * 120,
        vy: 90 + Math.random() * 160,
        t: 1.4 + Math.random() * 1.4,
        tint: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
        size: 6 + Math.random() * 11,
      });
    }
  }

  // The finale: a ring of bursts around the edge of the screen, so the party is
  // not just in the middle. Purely cosmetic -- these damage nothing.
  if (finale) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      w.blasts.push({
        alive: true,
        x: DESIGN_W * 0.5 + Math.cos(a) * DESIGN_W * 0.36,
        y: DESIGN_H * 0.5 + Math.sin(a) * DESIGN_H * 0.34,
        t: 0.7, total: 0.7,
        tint: CONFETTI[i % CONFETTI.length],
        radiusPx: 190,
      });
    }
  }
}

export function updateLevelPopup(w, dt) {
  if (!w.levelPopup) return;
  w.levelPopup.t -= dt;
  if (w.levelPopup.t <= 0) w.levelPopup = null;
}

/**
 * Roll for a heart where a big monster died.
 *
 * Refused outright when the player is already full: a pickup that grants nothing
 * is worse than no pickup, because a child will still fly across the screen for
 * it and be taught that hearts sometimes lie.
 */
function maybeDropHeart(w, m, rng) {
  const chance = HEARTS.dropFrom[m.tierName] || 0;
  if (!chance) return;
  if (w.player.hearts >= PLAYER.hearts) return;
  if (w.hearts.length >= HEARTS.maxLive) return;
  if (w.time - w.lastHeartT < HEARTS.minGapS) return;
  if (rng.next() >= chance) return;
  w.lastHeartT = w.time;
  w.hearts.push({ alive: true, x: m.x, y: m.y, t: HEARTS.lifeS, bob: 0 });
}

export function updateHearts(w, dt) {
  const p = w.player;
  for (const h of w.hearts) {
    if (!h.alive) continue;
    h.t -= dt;
    h.bob += dt * 3.2;
    const dx = p.x - h.x, dy = p.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < HEARTS.magnetRadius) {
      h.x += (dx / d) * HEARTS.magnetPxS * dt;
      h.y += (dy / d) * HEARTS.magnetPxS * dt;
    } else {
      h.y += HEARTS.driftPxS * dt;
    }
    if (d < PLAYER.radius + HEARTS.radius) {
      h.alive = false;
      // Clamped, not assumed: a heart collected in the same frame the cap was
      // reached must not push the player to four.
      if (p.hearts < PLAYER.hearts) p.hearts++;
      playHeart();
    }
    if (h.t <= 0) h.alive = false;
  }
  w.hearts = w.hearts.filter((h) => h.alive);
}

export function updateCoinsAndPops(w, dt) {
  const p = w.player;
  for (const c of w.coins) {
    if (!c.alive) continue;
    c.t -= dt;
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < COINS.magnetRadius) {
      // A coin that comes TO the player is a reward, not an errand -- and it
      // keeps the greed axis (drifting up for a coin) optional.
      c.x += (dx / (d || 1)) * COINS.magnetPxS * dt;
      c.y += (dy / (d || 1)) * COINS.magnetPxS * dt;
    } else {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.97;
      c.vy = c.vy * 0.97 + COINS.driftPxS * dt;
    }
    if (d < PLAYER.radius + COINS.radius) {
      c.alive = false;
      w.stats.coins++;
      w.stats.score += 5;
      addXp(w, XP.perCoin);
      playCoin();
    }
    if (c.t <= 0) c.alive = false;
  }
  w.coins = w.coins.filter((c) => c.alive);

  for (const f of w.pops) {
    if (!f.alive) continue;
    f.t -= dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vx *= 0.94;
    f.vy = f.vy * 0.94 + 120 * dt;
    if (f.t <= 0) f.alive = false;
  }
  w.pops = w.pops.filter((f) => f.alive);
}
