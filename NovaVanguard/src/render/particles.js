// Particle emitter (§9.1) -- a lightweight custom system over additive
// sprites, with a hard global cap and oldest-first eviction.
//
// Explosions are particle systems, not authored sheets (§0.3, §9.5 rule 3):
// "Nothing in this game requires a hand-drawn animation sequence." That is
// what keeps the MVP inventory at ~202 images instead of the pixel-art
// alternative's ~674, so it is a production-cost decision as much as a
// technical one.
//
// Lives in /render because it only ever produces pixels -- no system outside
// this directory can see or address a particle.

import { Sprite } from 'pixi.js';
import { FX } from '../data/tuning.js';

export function createParticles(container, texture) {
  const cap = FX.particleCap;
  const p = new Array(cap);
  const sprites = new Array(cap);
  let cursor = 0; // ring cursor -> oldest-first eviction, for free

  for (let i = 0; i < cap; i++) {
    p[i] = { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, drag: 1 };
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.visible = false;
    // The neon/bloom idiom is built on additive blending (§0.3) -- effectively
    // free in a batching WebGL renderer, expensive in Canvas 2D. That contrast
    // is the strongest single argument in §9.1's PixiJS recommendation.
    s.blendMode = 'add';
    sprites[i] = s;
    container.addChild(s);
  }

  function spawn(x, y, vx, vy, life, size, tint, drag) {
    const i = cursor;
    cursor = (cursor + 1) % cap;
    const q = p[i];
    q.alive = true;
    q.x = x;
    q.y = y;
    q.vx = vx;
    q.vy = vy;
    q.life = life;
    q.max = life;
    q.size = size;
    q.drag = drag === undefined ? 0.94 : drag;
    sprites[i].tint = tint;
  }

  return {
    /** Enemy destroyed: a hot core flash plus outward embers. */
    explosion(x, y) {
      spawn(x, y, 0, 0, 0.26, 3.4, 0xfff2d0, 0.86);
      for (let i = 0; i < FX.explosionParticles; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 120 + Math.random() * 460;
        spawn(
          x,
          y,
          Math.cos(a) * sp,
          Math.sin(a) * sp,
          0.32 + Math.random() * 0.42,
          0.5 + Math.random() * 0.75,
          Math.random() < 0.45 ? 0xff9a3c : 0xffd9a0
        );
      }
    },

    /** A bolt landed but did not kill. */
    impact(x, y) {
      for (let i = 0; i < FX.impactParticles; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 90 + Math.random() * 260;
        spawn(
          x,
          y,
          Math.cos(a) * sp,
          Math.sin(a) * sp,
          0.14 + Math.random() * 0.16,
          0.28 + Math.random() * 0.3,
          0xbdfaff
        );
      }
    },

    /**
     * A player bolt struck the boss hull. A SMALL EXPLOSION AT THE POINT OF
     * CONTACT, not a flash on the boss.
     *
     * Amit, after the fight became winnable: "I would add a bit more feedback
     * when I'm attacking and hitting the boss. So we will see small explosions
     * where my projectiles hit. Because right now it feels too dull."
     *
     * POSITIONAL IS THE WHOLE POINT. The burst spawns at the bolt's own contact
     * coordinates, so leaning left and right walks a line of impacts along the
     * armour and sustained fire reads as sustained work. A single centred flash
     * would carry the same information and none of the feeling -- it would say
     * "a hit happened" rather than "you are cutting into it there".
     *
     * SIZED AGAINST §5.4 RATHER THAN AGAINST DRAMA. This fires 9.5 times a
     * second for ~25 s, so it is the one effect in the game with a genuine duty
     * cycle, and two rules bound it:
     *   * It must not compete with enemy fire. Enemy orbs are the thing the
     *     player has to read and dodge, they are orange/magenta, 21-24px, slow
     *     and pulsing. So this is small (0.2-0.45 against an explosion's
     *     0.5-1.25), short (~0.2 s against ~0.6 s), lives up at the hull rather
     *     than in the gutter, and is mostly CYAN-WHITE -- the player's own
     *     ownership colour, which cannot be mistaken for ordnance coming down.
     *     A third of the embers run warm to sell "explosion" rather than
     *     "spark"; that is deliberately the minority so the frame never gains a
     *     second population of orange dots.
     *   * It must not starve the effects that carry more information. Measured:
     *     6 particles per hit at 9.52 hits/s with a ~0.22 s mean life is ~13
     *     live particles in steady state, against FX.particleCap of 400. Even
     *     with a player-hit burst (55) and two enemy deaths (46) landing on the
     *     same frame the total is under 120. The cap does NOT need raising, and
     *     oldest-first eviction is never reached by this.
     */
    bossImpact(x, y) {
      const d = FX.bossImpact;
      // A hot white core. White is neither ownership colour, so the brightest
      // part of the effect stays out of the orange/magenta read entirely.
      spawn(x, y, 0, 0, d.coreLifeS, d.coreSize, 0xfff2d0, 0.84);
      for (let i = 0; i < d.embers; i++) {
        // Fanned DOWNWARD and outward -- away from the armour, back toward the
        // player. Debris off a struck plate goes the way the shot came from,
        // and it also keeps the sparks off the hull's own art.
        const a = Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        const sp = d.emberSpeed[0] + Math.random() * (d.emberSpeed[1] - d.emberSpeed[0]);
        spawn(
          x + (Math.random() - 0.5) * 10,
          y + (Math.random() - 0.5) * 8,
          Math.cos(a) * sp,
          Math.sin(a) * sp * 0.7,
          d.emberLifeS[0] + Math.random() * (d.emberLifeS[1] - d.emberLifeS[0]),
          d.emberSize[0] + Math.random() * (d.emberSize[1] - d.emberSize[0]),
          Math.random() < d.warmFraction ? 0xffc07a : 0xcdf6ff
        );
      }
    },

    /**
     * A bolt rang off armour -- boss hull, or the core's closed shutter.
     *
     * WHY THIS IS NOT `impact`. The two have to be told apart at a glance,
     * because they mean opposite things: `impact` is "that landed, keep doing
     * it", this is "that went nowhere, aim somewhere else". A player who cannot
     * tell them apart is in exactly the state Amit's report describes -- "it's
     * actually impossible to damage" -- even on a boss that is working.
     *
     * Three things separate them, and all three run the same direction:
     *   * DIRECTION. `impact` throws its sparks UP, with the shot, the way a
     *     penetrating hit continues. These fan DOWN and outward, back the way
     *     the bolt came, which is what a ricochet does.
     *   * COLOUR. Steel white, not the cyan of `impact`. §5.4 colour-codes
     *     BULLET OWNERSHIP -- player cyan, enemy orange/magenta -- and a
     *     ricochet is neither side's ordnance; making it cyan would read as the
     *     player's shot succeeding, which is the precise wrong message.
     *   * SHAPE. A tight flat fan with a bright flat core, rather than a spray.
     *
     * No screen shake and no sound hook: at rank 1 this can fire nine times a
     * second, and anything heavier would punish the player for the game's own
     * failure to say where the pods are.
     */
    deflect(x, y) {
      // The flash sits at the point of contact and dies fast -- it is the "tink",
      // not an explosion.
      spawn(x, y, 0, 0, 0.1, 2.2, 0xdfe8f2, 0.82);
      for (let i = 0; i < 9; i++) {
        // Downward hemisphere, weighted to the sides, so the fan reads as a
        // shallow bounce off a flat plate rather than a splash.
        const a = Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const sp = 150 + Math.random() * 320;
        spawn(
          x,
          y,
          Math.cos(a) * sp,
          Math.sin(a) * sp * 0.55,
          0.13 + Math.random() * 0.14,
          0.24 + Math.random() * 0.26,
          Math.random() < 0.6 ? 0xdfe8f2 : 0x9fb3c8
        );
      }
    },

    /**
     * The player lost a shield segment.
     *
     * WHAT WAS WRONG WITH THE OLD ONE. This used to be a cyan flash and cyan
     * sparks, on the reasoning that §5.4 colour-codes ownership and the player
     * is cyan. That reasoning is right about bullets and wrong about this: the
     * player is ALREADY emitting cyan constantly -- a cyan engine plume every
     * frame and cyan bolts ten times a second -- so a cyan burst on the player
     * is camouflage. Amit's report was blunt about the result: "it's not clear
     * that the projectiles are bad for me."
     *
     * So it now reuses the ENEMY DEATH explosion, on the player's hull, which
     * is what he asked for by name. It costs no new art, and the hot orange
     * against the player's own cyan is the contrast the old version lacked.
     *
     * MADE DISTINCT FROM AN ENEMY DYING NEARBY, which is the obvious risk of
     * reusing the effect, by three things at once:
     *   * SCALE -- a bigger core, more embers, thrown further;
     *   * A WHITE SHOCKWAVE RING -- an expanding ring of uniform-speed
     *     particles. Nothing else in the game draws one, so the ring alone
     *     says "that was you";
     *   * and the two cues that already existed and now have something to
     *     agree with: FX.screenShake fires from damagePlayer, and the i-frame
     *     flicker starts on the same frame.
     *
     * ~55 particles against FX.particleCap of 400, with oldest-first
     * eviction -- affordable even in a cluster of simultaneous deaths.
     */
    playerHit(x, y) {
      const d = FX.playerHitBurst;
      // Hot core, same family as an enemy death but larger and longer.
      spawn(x, y, 0, 0, 0.34, d.coreSize, 0xfff2d0, 0.86);
      for (let i = 0; i < d.embers; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = d.emberSpeed[0] + Math.random() * (d.emberSpeed[1] - d.emberSpeed[0]);
        spawn(
          x,
          y,
          Math.cos(a) * sp,
          Math.sin(a) * sp,
          0.34 + Math.random() * 0.44,
          0.6 + Math.random() * 0.85,
          Math.random() < 0.45 ? 0xff7a2a : 0xffd9a0
        );
      }
      // The shockwave ring: evenly spaced, identical speed, no drag, short
      // life. Uniformity is what makes it read as one expanding circle rather
      // than as more debris.
      for (let i = 0; i < d.ring; i++) {
        const a = (i / d.ring) * Math.PI * 2;
        spawn(
          x,
          y,
          Math.cos(a) * d.ringSpeed,
          Math.sin(a) * d.ringSpeed,
          d.ringLifeS,
          d.ringSize,
          0xffffff,
          1
        );
      }
    },

    /** Continuous engine plume, called every frame while the craft lives. */
    thrust(x, y, roll) {
      if (Math.random() > 0.6) return;
      spawn(
        x + roll * 6 + (Math.random() - 0.5) * 16,
        y,
        (Math.random() - 0.5) * 40,
        180 + Math.random() * 130,
        0.16 + Math.random() * 0.1,
        0.42,
        0x66e6ff
      );
    },

    update(dt) {
      for (let i = 0; i < cap; i++) {
        const q = p[i];
        const s = sprites[i];
        if (!q.alive) {
          if (s.visible) s.visible = false;
          continue;
        }
        q.life -= dt;
        if (q.life <= 0) {
          q.alive = false;
          s.visible = false;
          continue;
        }
        const d = Math.pow(q.drag, dt * 60);
        q.vx *= d;
        q.vy *= d;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        const k = q.life / q.max;
        s.visible = true;
        s.x = q.x;
        s.y = q.y;
        s.alpha = k * k;
        s.scale.set(q.size * (0.45 + (1 - k) * 0.85));
      }
    },

    clear() {
      for (let i = 0; i < cap; i++) {
        p[i].alive = false;
        sprites[i].visible = false;
      }
    },
  };
}
