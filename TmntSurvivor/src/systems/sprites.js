// Character art, and the two rules that make it cheap.
//
// ── 1. THE CAMERA IS TO THE SIDE, NOT OVERHEAD ──────────────────────────────
//
// This started as a top-down game, which meant the player sprite had to be
// drawn at every heading -- eight frames minimum, and eight frames that have
// to agree with each other or the character appears to change shape as it
// turns. The reference Elad gave on 2026-11-01 (survivor.io-style, the
// `Survivor art camera` screenshot) does not do that. The world is drawn in
// perspective but the CHARACTER is drawn flat, from the side, and it faces
// left or right by being mirrored. One drawing, one mirror, every direction.
//
// So there is no rotation anywhere in here, and there must not be: rotating a
// side-view character lays it on its back. Heading is expressed two ways
// instead --
//
//   - the sprite MIRRORS on the x axis for the left/right half of the compass;
//   - a separate arrow, drawn above the character, carries the actual heading.
//
// The arrow is not decoration. Mirroring alone collapses 360 degrees into two
// states, so with the sprite as the only cue a player walking north-east and a
// player walking south-east look identical. The reference has the same arrow
// for the same reason.
//
// ── 2. FOUR FRAMES IS A WALK, TWO IS A BREATH ───────────────────────────────
//
// Contact, passing, contact, passing. At four frames the legs read as walking
// and the generator still holds the character still between frames; the
// earlier eight-frame attempts came back with the last frames as near
// duplicates, because the model front-loads its effort across one image.
//
// The frames were sliced apart and then pinned to a shared horizontal centre
// and a shared FEET baseline, which is what stops the loop reading as a
// character jittering rather than walking -- but it also flattens the body
// lift the artist put in the passing frames. That lift is added back here, as
// BOB, where it is a number somebody can change.
//
// A character that keeps walking while standing still is the single most
// obvious tell that an animation was bolted on, so there is a separate idle:
// two frames, planted feet, a slow breath. It is a DIFFERENT SHEET and a
// different frame count, which is why a sprite carries its clip rather than
// an index into one global sheet.
//
// Art: Kolbo gpt-image-2, styled against the official TMNT style-guide patch
// art in ~/Documents/TMNT/tmnt babies/. Cut out with an edge-connected flood
// fill rather than a global white key -- these characters have big white eyes
// and a global key removes them.

import { Assets, Sprite, Texture, Rectangle, Container, Graphics } from 'pixi.js';

// EXPLICIT URLS, NOT A TEMPLATE. `new URL('../assets/' + name, ...)` makes
// Vite glob the whole folder and ship every file in it, used or not -- which
// is how 15 orphans ended up in a RoboRun bundle. One static URL per asset
// means the bundle contains exactly what is referenced.
const SRC = {
  leo:      new URL('../../assets/turtle_leo_walk.webp',  import.meta.url).href,
  don:      new URL('../../assets/turtle_don_walk.webp',  import.meta.url).href,
  mike:     new URL('../../assets/turtle_mike_walk.webp', import.meta.url).href,
  foot:     new URL('../../assets/foot_ninja_walk.webp',  import.meta.url).href,
  shooter:  new URL('../../assets/foot_shooter_walk.webp', import.meta.url).href,
  leo_idle: new URL('../../assets/turtle_leo_idle.webp',  import.meta.url).href,
  // The player, drawn to the licensed TMNT_M1 style guide's toddler sheet
  // (TMNT_M1_SG_TODDLER_RAPH_001) rather than to this game's earlier,
  // rounder house cartoon. Walk and idle were cut from ONE generation, so
  // the two sheets cannot drift apart from each other.
  raph_sg:      new URL('../../assets/turtle_raph_blaster_walk.webp', import.meta.url).href,
  raph_sg_idle: new URL('../../assets/turtle_raph_blaster_idle.webp', import.meta.url).href,
  shuriken: new URL('../../assets/shuriken.webp',         import.meta.url).href,
  katana:   new URL('../../assets/katana.webp',           import.meta.url).href,
  gem:      new URL('../../assets/gem.webp',              import.meta.url).href,
  pizza:    new URL('../../assets/pizza.webp',            import.meta.url).href,
};

/** Cells per sheet. A walk is four; an idle breath is two. */
export const FRAMES = 4;
export const IDLE_FRAMES = 2;

/**
 * Which characters have an idle sheet yet.
 *
 * THE RULE THIS ENCODES: a character may only have an idle sheet if its walk
 * sheet is holding the SAME WEAPON. Otherwise the character pops between armed
 * and empty every time the player stops moving. Leo was the first to satisfy
 * it; raph_sg satisfies it by construction, since both of its sheets were cut
 * from a single generation. The other three turtles have no idle and stay on
 * walk, which is correct rather than unfinished.
 */
const IDLE_SHEETS = { raph_sg: 'raph_sg_idle', leo: 'leo_idle' };

/**
 * WHERE THE BARREL ENDS, per sheet, as a fraction of one cell.
 *
 * MEASURED OFF THE ART, not guessed: for each frame, the right-most opaque
 * pixel inside the band the gun occupies, averaged across the frames. The
 * band matters -- taking the right-most pixel of the whole cell finds the
 * BANDANA TAIL on walk frame 3, which sits further right than the muzzle and
 * ten pixels from the top of the cell.
 *
 * Per CLIP, because the two sheets are not the same drawing: in the idle he
 * stands square and the gun sits lower and further out than it does mid-step.
 * One shared number put the shots a visible few pixels off the barrel every
 * time the player stopped.
 *
 * X is measured in the file AS DRAWN (facing right). muzzleAt() multiplies it
 * by the sprite's own scale.x, so the mirror comes out for free.
 */
const MUZZLE = {
  raph_sg:      { x: 0.974, y: 0.398 },
  raph_sg_idle: { x: 0.991, y: 0.449 },
};

/**
 * Seat order. Seat 0 is the phone's own board, so the player is always the
 * style-guide toddler Raphael.
 *
 * The old flat-cartoon Raphael is deliberately gone from this list AND from
 * SRC above: it is the same character as raph_sg, and two Raphaels in
 * different art styles standing next to each other in a co-op game is worse
 * than three turtles. Leaving it in SRC would also have shipped 63 kB of
 * unreachable art in every bundle, which is the orphan problem SRC's own
 * comment exists to prevent. `assets/turtle_raph_walk.webp` is still on disk
 * if it is ever wanted back; add the line to SRC again to use it.
 */
export const TURTLES = ['raph_sg', 'leo', 'don', 'mike'];

/**
 * WHICH WAY EACH SHEET IS DRAWN. +1 is facing right, -1 is facing left.
 *
 * NOT A DETAIL. Every turtle was generated facing right; the Foot came back
 * facing LEFT, because its walk strip was generated from the original static
 * sprite and the reference image won over the word "RIGHT" in the prompt.
 * Nothing about the file says so, and the whole horde faced away from the
 * player for it -- walking at him backwards, which looked deliberate enough
 * that it survived several screenshots.
 *
 * So the drawn direction is declared here and the mirror is derived from it.
 * The alternative -- flipping the comparison at the one call site that was
 * wrong -- fixes today's symptom and leaves the next sheet to rediscover it.
 */
export const SOURCE_FACING = { foot: -1, shooter: -1 };

/** Target heights in world px. The collision radii are 42 and 34. */
const PLAYER_H = 124;
const ENEMY_H = 96;

/**
 * Where the logical point sits inside the drawing.
 *
 * A side-view character STANDS somewhere, and that somewhere is not its
 * middle. Anchoring at 0.5 buries the feet and the character reads as
 * floating; anchoring at 1.0 puts the collision circle around the ankles.
 * 0.78 puts the point low in the body, which is both where the shadow goes
 * and close enough to the circle's centre that the hitbox still matches what
 * a player sees.
 */
const ANCHOR_Y = 0.78;

/**
 * The body lift on the passing frames, in CELL pixels (scaled with the
 * sprite). Flattened out by the baseline alignment; put back here.
 */
const BOB = [0, -5, 0, -5];

/** How far a character walks per frame of the cycle, in world px. */
const STEP_PX = 44;

const sheets = {};

/** How many cells a given sheet is cut into. */
function cellsIn(key) {
  if (['shuriken', 'katana', 'gem', 'pizza'].includes(key)) return 1;
  return key.endsWith('_idle') ? IDLE_FRAMES : FRAMES;
}

export async function loadArt() {
  const keys = Object.keys(SRC);
  const loaded = await Promise.all(keys.map((k) => Assets.load(SRC[k])));
  keys.forEach((k, i) => {
    const tex = loaded[i];
    const n = cellsIn(k);
    const cw = tex.width / n;
    sheets[k] = Array.from({ length: n }, (_, f) => new Texture({
      source: tex.source,
      frame: new Rectangle(f * cw, 0, cw, tex.height),
    }));
  });
}

function make(key, targetH) {
  const frames = sheets[key];
  const s = new Sprite(frames[0]);
  s.anchor.set(0.5, ANCHOR_Y);
  const scale = targetH / frames[0].height;
  s.scale.set(scale);
  // Remembered so the mirror can flip sign without recomputing it, and so a
  // flip never quietly changes the size.
  s.__baseScale = scale;
  s.__srcFacing = SOURCE_FACING[key] ?? 1;
  s.__walkScale = scale;
  s.__idleScale = scale;
  s.__frames = frames;
  s.__walkFrames = frames;
  s.__idle = null;
  s.__f = 0;
  return s;
}

export function makePlayer(seat = 0) {
  const key = TURTLES[seat % TURTLES.length];
  const s = make(key, PLAYER_H);
  const idle = IDLE_SHEETS[key];
  if (idle) {
    s.__idle = sheets[idle];
    // EACH CLIP KEEPS ITS OWN SCALE. The two sheets were packed to the same
    // cell height so these come out equal today, but deriving the idle's
    // scale from its own art is what stops the character resizing the moment
    // it stops walking if a future sheet is packed differently -- and that is
    // a thing nobody would think to look for.
    s.__idleScale = PLAYER_H / s.__idle[0].height;
  }
  s.__muzzleWalk = MUZZLE[key] ?? null;
  s.__muzzleIdle = MUZZLE[idle] ?? s.__muzzleWalk;
  return s;
}

/**
 * The world position of the end of the gun barrel, for whatever this sprite
 * is drawing RIGHT NOW.
 *
 * Reads the live sprite rather than the logical player, so it follows the
 * walk cycle's body bob and the clip swap automatically -- the muzzle is a
 * point in a drawing and only the drawing knows where it currently is.
 *
 * Falls back to the sprite's own origin for any character with no measured
 * muzzle, so an unarmed turtle fires from where it always did.
 */
export function muzzleAt(s) {
  const m = (s.__idle && s.__frames === s.__idle) ? s.__muzzleIdle : s.__muzzleWalk;
  if (!m) return { x: s.x, y: s.y };
  const f = s.__frames[0];
  return {
    // scale.x carries BOTH the size and the mirror sign, so a left-facing
    // player gets the muzzle on their left with no special case here.
    x: s.x + (m.x - 0.5) * f.width * s.scale.x,
    y: s.y + (m.y - ANCHOR_Y) * f.height * s.__baseScale,
  };
}

/**
 * THE KATANA, drawn along its own length.
 *
 * Unlike the characters this one IS rotated, and that is correct: a sword is
 * an object with a direction, not a side view of something that stands up.
 * The art points right, so the sprite's rotation is the sweep's tangent
 * angle directly, with no offset to remember.
 *
 * Scaled off its own art rather than a constant, so re-exporting the blade
 * at a different size cannot silently change the weapon's reach on screen.
 */
export function makeKatana(lengthPx) {
  const s = new Sprite(sheets.katana[0]);
  s.anchor.set(0.5);
  s.scale.set(lengthPx / sheets.katana[0].width);
  return s;
}

/**
 * A POOL OF PICKUPS lying on the ground.
 *
 * DRAWN BIGGER THAN THEY COLLECT, like the projectiles, and for the same
 * reason in reverse: a pickup the player can see from across the screen is
 * one they can decide to walk toward, and walking toward things is the only
 * verb this game has. Collecting is generous anyway -- the magnet does the
 * last part -- so a gem that looks slightly larger than its radius cannot
 * mislead anyone into a death.
 *
 * BOBBING, and gently. A static sprite on a scrolling floor reads as part of
 * the floor; two pixels of vertical float is enough to separate loot from
 * level art without turning the ground into a disco. The phase is seeded per
 * slot so a field of gems does not pulse in unison, which looks mechanical.
 */
export class PickupPool {
  constructor(parent, key, heightPx) {
    this.parent = parent;
    this.key = key;
    this.h = heightPx;
    this.pool = [];
  }

  sync(items, timeS) {
    let n = 0;
    for (const it of items) {
      if (!it.alive) continue;
      let s = this.pool[n];
      if (!s) {
        s = new Sprite(sheets[this.key][0]);
        s.anchor.set(0.5);
        s.scale.set(this.h / sheets[this.key][0].height);
        this.pool.push(s);
        this.parent.addChild(s);
      }
      s.visible = true;
      s.position.set(it.x, it.y + Math.sin(timeS * 2.4 + n * 1.7) * 2.5);
      n++;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}

/**
 * THE STAR SITTING IN THE BARREL -- the round that is about to be fired.
 *
 * It is the same shuriken asset the projectiles use, which is the point: the
 * thing in the gun and the thing that comes out of it are visibly one object,
 * so the gun explains itself without a tutorial or a UI element.
 *
 * HOW IT IS "INSIDE" THE BARREL. The star is MASKED at the muzzle plane, so
 * only the part that has cleared the barrel is ever visible. Nothing is faked
 * with a cut-down copy of the art -- it is one sprite and one rectangle, and
 * the barrel's lip is the mask edge.
 *
 * HOW MUCH OF IT SHOWS (Elad, 10 Nov: "it's too hidden ... it should be almost
 * completely out, so just one of its four pointed wings will be inside the
 * barrel"). That is a geometry problem with an exact answer, so it is solved
 * from the art rather than nudged by eye:
 *
 *   - shuriken.webp's four wings are AXIS-ALIGNED, at 0/90/180/270 degrees.
 *     So the star needs no tilt at all: its left-hand wing already points
 *     straight back down the bore. An earlier 0.42rad tilt put every wing at
 *     an angle to the barrel and no single one of them went in cleanly.
 *   - its hub is STAR_HUB of the drawn size from the centre, with the wings
 *     beyond that. Park the centre that far in FRONT of the mask plane and
 *     the barrel swallows about one wing's worth -- the hub and the other
 *     three wings stand clear.
 *
 * WHERE THE MASK PLANE GOES, which is the part that decides whether this
 * reads at all (Elad, 10 Nov: "the hidden point is being hidden completely by
 * the gun asset, but it needs to be hiding the TIP, so it will look like it's
 * going inside the round barrel").
 *
 * The plane is NOT the end of the barrel. Put it there and the wing is sliced
 * off flush against the muzzle's front face, the bore stays visible as a dark
 * hole beside the star, and the whole thing reads as a star floating next to
 * a gun rather than a round sitting in one. The plane belongs BARREL_STAR.bore
 * deep inside the bore, so the wing is drawn across the dark opening and only
 * its tip vanishes down the hole.
 *
 * Six world px, chosen by rendering the real sprite at 0/3/5/7/9/11 and
 * looking: under about four the wing is still cut flush, and past about nine
 * the star climbs over the muzzle's collar and goes back to looking stuck on
 * the front. Note this is only where the ART is cut -- shots still leave from
 * the true tip, which is what MUZZLE is for.
 *
 * The mask is a child of the returned container, so it inherits the same
 * position and mirror as the star and the two can never drift apart.
 *
 * Returns a Container: put it at the muzzle (see muzzleAt), set its scale.x
 * to +-1 to match which way the player faces, and drive `__star`'s scale
 * through barrelStarScale().
 */
export function makeBarrelStar() {
  const c = new Container();
  const tex = sheets.shuriken[0];
  const star = new Sprite(tex);
  star.anchor.set(0.5);
  const base = BARREL_STAR.px / tex.height;
  star.scale.set(base);
  // NOT tilted -- see above. A wing has to line up with the bore.
  star.rotation = 0;

  // Everything from inside the bore OUTWARD. Generous in every other
  // direction so a mid-pop overshoot is never clipped at the top or bottom.
  const m = new Graphics()
    .rect(-BARREL_STAR.bore, -BARREL_STAR.px * 2,
          BARREL_STAR.px * 4 + BARREL_STAR.bore, BARREL_STAR.px * 4)
    .fill({ color: 0xffffff });
  c.addChild(star, m);
  star.mask = m;

  c.__star = star;
  c.__baseScale = base;
  setBarrelStar(c, 1);
  return c;
}

/**
 * Distance from the star's centre to the root of a wing, as a fraction of its
 * drawn size. MEASURED off shuriken.webp, not chosen: sampling the art's alpha
 * radius by angle gives 64px at the four tips and 29px in the valleys between
 * them, and 29/64 of the half-size is this.
 *
 * It is what decides how much of the star the barrel eats, so if the asset is
 * ever redrawn with longer or stubbier wings, re-measure it rather than
 * tweaking the number until it looks right.
 */
const STAR_HUB = (29 / 64) / 2;

/**
 * Drive the barrel star's reload pop. `k` comes from barrelStarScale().
 *
 * The star GROWS AND SLIDES OUT TOGETHER, both from the same k, which is what
 * makes it read as a round rising up the bore rather than as a decal fading
 * in. It travels from the mask plane -- down inside the bore, where the mask
 * has nothing to show -- out to its resting place a wing deep in the muzzle.
 * The overshoot carries it momentarily further out and a touch oversized, and
 * it settles back: the recoil you would expect from a gun that just chambered
 * something.
 *
 * Starting it at the PLANE rather than at the muzzle tip matters. Anchored at
 * the tip, a half-grown star would hang in the air off the end of the barrel
 * instead of climbing out of it, and the first third of every reload would
 * look wrong.
 */
export function setBarrelStar(c, k) {
  c.__star.scale.set(c.__baseScale * k);
  const rest = BARREL_STAR.px * STAR_HUB;
  c.__star.x = -BARREL_STAR.bore + (BARREL_STAR.bore + rest) * k;
}

/**
 * How big the barrel star should be drawn, 0 when the barrel is empty.
 *
 * Pure, so the curve can be tested without a renderer.
 *
 * COMPRESSED AT HIGH FIRE RATES, which is the part that is easy to miss. The
 * animation runs 0.28s end to end, and a fully stacked fire rate puts volleys
 * closer together than that -- so at the top of a run the barrel would simply
 * never refill and the star would vanish for the rest of the game, exactly
 * when the player has earned the most firepower. Scaling the whole sequence
 * to fit inside the interval keeps it visible at every fire rate, and it
 * naturally reads as the gun working harder.
 *
 * @param {number} sinceFireS seconds since the last volley; Infinity before
 *   the first shot of a run, which must leave the barrel LOADED.
 * @param {number} intervalS the current gap between volleys.
 */
export function barrelStarScale(sinceFireS, intervalS = Infinity) {
  const span = BARREL_STAR.goneS + BARREL_STAR.popS;
  // 0.9 so the pop always finishes a little before the next shot, rather than
  // being cut off by it at exactly the moment it would have landed.
  const k = Math.min(1, (intervalS * 0.9) / span);
  const gone = BARREL_STAR.goneS * k;
  const pop = BARREL_STAR.popS * k;
  if (sinceFireS < gone) return 0;
  const t = Math.min(1, (sinceFireS - gone) / pop);
  if (t >= 1) return 1;
  const c1 = BARREL_STAR.back;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** A spinning shuriken. Rotation is fine here: it is a disc, not a side view. */
export function makeShuriken() {
  const s = new Sprite(sheets.shuriken[0]);
  s.anchor.set(0.5);
  s.scale.set(SHURIKEN_PX / sheets.shuriken[0].height);
  return s;
}

/**
 * DRAWN size of a projectile, in world px. The hitboxes are elsewhere and are
 * deliberately not these numbers -- BULLET.radius is 9, SHOT.radius is 16.
 *
 * WHY THE ART IS MUCH BIGGER THAN THE HITBOX. Elad, playing it: the stars are
 * too small to read. He is right, and the scale is what makes it obvious --
 * the player is radius 42 and the smallest enemy 58, so a 46px star was a
 * third of the thing it was flying at, on a field with up to ninety of them.
 * A projectile that cannot be seen is not a mechanic, and in a horde game the
 * stream of them is the player's only feedback that they are fighting at all.
 *
 * THE INCOMING STAR IS NOW THE BIGGEST THING IN FLIGHT, and it was previously
 * the smallest -- drawn at 0.82 of the player's while hitting with nearly
 * twice the radius. That is exactly backwards: the one that can take a heart
 * read as the lesser of the two. Whatever the player throws can afford to be
 * quieter, because losing track of your own fire costs nothing.
 *
 * GENEROUS BY CONSTRUCTION, now that the art is bigger than the hitbox. A
 * star that looks like it clipped you and did not is a gift; one that hits
 * when it visibly missed is a bug report. The asymmetry runs the right way on
 * both sides, so this is safe to leave even if the numbers move.
 *
 * TUNABLE, because the right size is a thing you see on a tablet and not at a
 * desk -- same rule as systems/input.js, and the deliverable is the number
 * that felt right rather than the one written here:
 *
 *   ?star=64   the player's shuriken        ?estar=76  the incoming one
 */
const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const px = (key, fallback) => {
  const v = Number(QS.get(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/**
 * Tuning for the star in the barrel.
 *
 *   ?bstar=40   its size in world px
 *   ?bore=6     how deep inside the barrel its tip is cut off
 */
export const BARREL_STAR = {
  px: px('bstar', 40),
  /** How far behind the muzzle tip the art is clipped. See makeBarrelStar. */
  bore: px('bore', 6),
  /** Barrel stands empty this long after a shot. */
  goneS: 0.10,
  /** And then the next round rises out of it over this long. */
  popS: 0.18,
  /**
   * Overshoot strength of the pop -- the standard ease-out-back constant.
   * At 3.0 the star swells to about 125% before settling, which is what
   * makes the reload read as a THUNK rather than as a fade-in.
   */
  back: 3.0,
};

const SHURIKEN_PX = px('star', 64);
const ENEMY_SHURIKEN_PX = px('estar', 76);

/** Full turns a shuriken makes per second in flight. */
export const SPIN_TURNS_S = 3.2;

/** Which sheet each enemy kind is drawn from. Same art, recoloured wraps. */
export const ENEMY_SHEETS = { grunt: 'foot', shooter: 'shooter' };

export function makeEnemy(kind = 'grunt') {
  return make(ENEMY_SHEETS[kind] ?? 'foot', ENEMY_H);
}

/**
 * An incoming star. The player's own shuriken, tinted amber.
 *
 * Tint MULTIPLIES, which is usually the problem with it -- but the shuriken
 * is near-white steel, so multiplying it by amber gives a genuinely amber
 * star rather than a muddy one. It matches the shooter's wraps on purpose:
 * the player should be able to look at a projectile and know instantly which
 * enemy to blame, and look at an enemy and know it throws.
 */
export function makeEnemyShot() {
  const s = new Sprite(sheets.shuriken[0]);
  s.anchor.set(0.5);
  s.scale.set(ENEMY_SHURIKEN_PX / sheets.shuriken[0].height);
  s.tint = 0xffa52b;
  return s;
}

/** Put a sprite on frame `i` of its cycle, and apply that frame's bob. */
export function setFrame(s, i, baseY) {
  const n = s.__frames.length;
  const f = ((i % n) + n) % n;
  s.__f = f;
  s.texture = s.__frames[f];
  s.y = baseY + (BOB[f] ?? 0) * s.__baseScale;
}

/**
 * Pick the clip a character should be playing and advance it.
 *
 * THE SWITCH IS ON SPEED, NOT ON WHETHER A KEY IS DOWN. On a balance board
 * there is no key: a player standing centred still produces a small nonzero
 * lean all the time, so "is input present" is never false and the character
 * would never once stand still. Actual movement is the only honest test, and
 * the threshold is generous enough to absorb board jitter.
 *
 * @param {Sprite} s
 * @param {number} speedPxS how fast the character is actually moving
 * @param {number} dt seconds this frame, for the walk clock
 * @param {number} timeS run clock, for the time-driven idle breath
 * @param {number} baseY where the feet are
 */
export function playLocomotion(s, speedPxS, dt, timeS, baseY) {
  const moving = speedPxS > MOVING_PX_S;
  if (!s.__idle) {                               // no idle sheet: always walk
    setFrame(s, advanceWalk(s, moving, dt), baseY);
    return moving;
  }
  const want = moving ? s.__walkFrames : s.__idle;
  if (s.__frames !== want) {
    s.__frames = want;
    // Keep whichever way the character is already facing: a clip change is
    // not a turn, and snapping back to facing right on every stop would be
    // the most visible bug in the game.
    const sign = s.scale.x < 0 ? -1 : 1;
    s.__baseScale = moving ? s.__walkScale : s.__idleScale;
    s.scale.set(sign * s.__baseScale, s.__baseScale);
  }
  const frame = advanceWalk(s, moving, dt);
  setFrame(s, moving ? frame : Math.floor(timeS * IDLE_FPS), baseY);
  return moving;
}

/**
 * Below this, the character is standing. Board jitter and a resting lean both
 * live under it; a deliberate step does not.
 */
const MOVING_PX_S = 18;

/** The idle breath, in frames per second. Slow on purpose -- it is a breath. */
const IDLE_FPS = 1.8;

/**
 * Steps per second while walking. Fixed, and that is the point.
 *
 *   ?wfps=12
 */
const WALK_FPS = (() => {
  const v = Number(new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search).get('wfps'));
  return Number.isFinite(v) && v > 0 ? v : 12;
})();

/**
 * Advance a character's walk clock, and say which frame that lands on.
 *
 * GATED ON MOVEMENT, PACED BY TIME -- and it needs to be both.
 *
 * It was distance-driven, deliberately: a purely time-driven cycle keeps
 * walking while the player stands still, and a character moonwalking on the
 * spot is the most obvious tell that a walk cycle was bolted on. That reason
 * is still right and the gate below is what keeps it true.
 *
 * But distance ALSO means the cadence is a function of speed, and on a
 * balance board speed is analogue: a child leaning gently moves slowly and
 * the legs crawl, a child leaning hard moves fast and the legs sprint, and
 * since nobody holds a lean steady the cadence wobbles continuously. Elad,
 * 1 Nov: the walking animation is changing speed and it should not. It reads
 * as the frame rate fluctuating rather than as the character walking.
 *
 * So the clock only runs while the character is actually moving, and when it
 * runs it runs at one rate. Standing still still freezes the cycle. What is
 * given up is foot contact -- at double speed the feet slip -- and on a
 * 124px cartoon turtle seen from above that is invisible, where a wobbling
 * cadence is not.
 *
 * 12/s is the cadence the old code happened to produce at the base walk
 * speed of 520 px/s over a 44px stride, so a turtle at full lean looks
 * exactly as it did; everything slower now matches it instead of dragging.
 */
export function advanceWalk(s, moving, dt) {
  if (moving) s.__walkT = (s.__walkT || 0) + dt;
  return Math.floor((s.__walkT || 0) * WALK_FPS);
}

/**
 * Point a side-view sprite along a heading, by mirroring.
 *
 * `facing` is the travel angle in radians, screen convention (y grows down).
 * Straight up and straight down are genuinely ambiguous -- neither is left or
 * right -- so the sign is LEFT ALONE there rather than snapped. Snapping made
 * the character flicker between mirrors while walking straight up, because
 * the angle crosses the boundary every frame.
 */
export function faceSprite(s, facing) {
  const nx = Math.cos(facing);
  if (Math.abs(nx) < 0.08) return;              // too close to vertical to call
  pointAt(s, nx < 0 ? -1 : 1);
}

/**
 * Point a sprite left (-1) or right (+1), whichever way its art was drawn.
 *
 * The mirror is `want * srcFacing`: a sheet already drawn the wanted way is
 * left alone, one drawn the other way is flipped. Every caller asks for a
 * direction in world terms and never has to know how the file was drawn.
 */
export function pointAt(s, want) {
  s.scale.x = want * (s.__srcFacing ?? 1) * s.__baseScale;
}

/**
 * A pool of enemy sprites.
 *
 * The horde caps at 90 and enemies are recycled rather than destroyed, so the
 * sprites are too: the pool only ever grows to the high-water mark and nothing
 * is allocated in a steady-state frame. Unused sprites are hidden, not
 * removed -- removing and re-adding children is the cost this avoids.
 */
export class EnemyPool {
  constructor(parent) {
    this.parent = parent;
    // ONE SUB-POOL PER KIND. A single pool would have to swap a sprite's
    // sheet whenever a slot went from grunt to shooter, and since slots are
    // handed out in whatever order the enemy array happens to be in, that is
    // most frames -- every one of them re-binding textures for no reason.
    // Keyed pools mean a sprite is created once and never changes what it is.
    this.pools = {};
    this.phases = {};
  }

  _bucket(kind) {
    if (!this.pools[kind]) {
      this.pools[kind] = [];
      this.phases[kind] = [];
    }
    return kind;
  }

  /**
   * @param {Array<{x:number,y:number,alive:boolean,hitT:number}>} enemies
   * @param {number} playerX what every enemy is walking toward
   * @param {number} timeS run clock, for the walk cycle
   */
  sync(enemies, playerX, timeS) {
    // How many of each kind this frame. Counted as we go, then used to hide
    // the tail of each sub-pool.
    const used = {};
    for (const e of enemies) {
      if (!e.alive) continue;
      const kind = this._bucket(e.kind === 'shooter' ? 'shooter' : 'grunt');
      const pool = this.pools[kind];
      const n = used[kind] ?? 0;
      used[kind] = n + 1;

      let s = pool[n];
      if (!s) {
        s = makeEnemy(kind);
        pool.push(s);
        // A PER-SLOT PHASE OFFSET, or two dozen ninjas march in lockstep
        // like a chorus line. Keyed to the slot rather than the enemy so a
        // recycled enemy keeps the gait of the sprite it is borrowing --
        // the alternative resets the cycle on every respawn and the whole
        // horde twitches whenever it tops up.
        this.phases[kind].push(Math.random() * FRAMES);
        this.parent.addChild(s);
      }

      s.visible = true;
      s.x = e.x;
      // Enemies walk at the player rather than along a heading, so their
      // cycle is time-driven: there is no travel distance tracked per
      // enemy and they are never standing still.
      setFrame(s, Math.floor(timeS * 7 + this.phases[kind][n]), e.y);
      // Which way it faces is just which side of the player it is on.
      // pointAt, not a raw sign, because both Foot sheets are drawn facing
      // LEFT while every turtle sheet faces right -- see SOURCE_FACING.
      pointAt(s, e.x > playerX ? -1 : 1);
      // Hit flash. Tint only darkens, so a white flash is impossible this way
      // -- the readable alternative is to wash the sprite toward its own
      // silhouette, which a hard red does.
      s.tint = e.hitT > 0 ? 0xff5566 : 0xffffff;
    }

    for (const kind of Object.keys(this.pools)) {
      const pool = this.pools[kind];
      for (let i = used[kind] ?? 0; i < pool.length; i++) pool[i].visible = false;
    }
  }
}

export { Container };

/**
 * A pool of spinning shuriken, one per live bullet.
 *
 * Same contract as EnemyPool: grow to the high-water mark, hide the rest,
 * never allocate in a steady-state frame. Bullets churn far faster than
 * enemies -- a RAPID FIRE build fires several a second and each lives under
 * a second -- so this is the pool that would hurt most if it were not one.
 */
export class ShurikenPool {
  constructor(parent) {
    this.parent = parent;
    this.pool = [];
    this.spin = [];
  }

  /** @param {Array<{x:number,y:number,alive:boolean}>} bullets */
  sync(bullets, timeS) {
    let n = 0;
    for (const b of bullets) {
      if (!b.alive) continue;
      let s = this.pool[n];
      if (!s) {
        s = makeShuriken();
        // A fixed phase per slot, so two stars in flight together are never
        // frozen at the same angle -- which reads as one object, not two.
        this.spin.push(Math.random() * Math.PI * 2);
        this.pool.push(s);
        this.parent.addChild(s);
      }
      s.visible = true;
      s.position.set(b.x, b.y);
      s.rotation = this.spin[n] + timeS * SPIN_TURNS_S * Math.PI * 2;
      n++;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}

/**
 * A pool of incoming stars. Spins the other way from the player's.
 *
 * Not a cosmetic choice: at speed the only thing distinguishing an incoming
 * star from one of yours is colour, and colour alone is a thin cue on a busy
 * field. Opposite spin gives it a second, and spin direction reads
 * peripherally in a way that hue does not.
 */
export class EnemyShotPool {
  constructor(parent) {
    this.parent = parent;
    this.pool = [];
    this.spin = [];
  }

  /** @param {Array<{x:number,y:number,alive:boolean}>} shots */
  sync(shots, timeS) {
    let n = 0;
    for (const b of shots) {
      if (!b.alive) continue;
      let s = this.pool[n];
      if (!s) {
        s = makeEnemyShot();
        this.spin.push(Math.random() * Math.PI * 2);
        this.pool.push(s);
        this.parent.addChild(s);
      }
      s.visible = true;
      s.position.set(b.x, b.y);
      s.rotation = this.spin[n] - timeS * SPIN_TURNS_S * Math.PI * 2;
      n++;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}
