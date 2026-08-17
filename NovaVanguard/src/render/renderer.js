// ALL renderer API calls live here and nowhere else (§9.1).
//
// That isolation is not tidiness -- it is the mitigation for §12's open
// question. PixiJS is §9.1's recommendation and this game is the strongest
// case the repo has had for a batching WebGL 2D renderer (peak sprite counts,
// additive-heavy idiom, runtime rotation/tint everywhere). But the CTO's
// "what should stage 4's 2D default be" question is still open in
// WEB_MINIGAME_TECH_RETROSPECTIVE.md, and §9.1 is explicit: "the code must not
// depend on getting it." If the answer comes back "no new dependency", the
// fallback is raw Canvas 2D with pre-baked glow sprites and a hard particle
// cap -- and that swap touches only /render, because game state is plain data
// and nothing outside this directory imports pixi.js.
//
// THERE IS NO CAMERA OBJECT IN THIS GAME, and there must never be one (§0.2).
// The strict orthographic overhead view is not a camera setting -- it is
// enforced by there being no perspective projection anywhere in the codebase.
// The root container below is a uniform scale + centre offset for
// letterboxing. It has no rotation, no skew, no per-axis scale, and no z.

import { Application, Container, Sprite, TilingSprite, Graphics } from 'pixi.js';
import {
  DESIGN_W,
  DESIGN_H,
  BANDS,
  PLAYABLE_X,
  PLAYER,
  ENEMY,
  enemyDef,
  BOSS,
  SURFACE,
  FX,
  AISLE_MIN,
} from '../data/tuning.js';
import { surfaceAt } from '../data/surfaces.js';
import { bossDef } from '../data/bosses.js';
import { loadTextures, T } from './textures.js';
import { createParticles } from './particles.js';
import { emissiveIntensity } from '../surface/surface.js';
import {
  podPosition,
  corePosition,
  bossHalfH,
  bossSkirtY,
  bossHullBox,
} from '../enemies/boss.js';
import { activeAisles } from '../patterns/patterns.js';

const TWO_PI = Math.PI * 2;

export async function createRenderer(mountEl) {
  const app = new Application();
  await app.init({
    width: DESIGN_W,
    height: DESIGN_H,
    background: 0x05060a,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    // Unity drives the frame rate through the rAF shim + __pumpFrames; Pixi's
    // ticker goes through the same shimmed requestAnimationFrame, so it is
    // pumped correctly inside an occluded WKWebView (see GOBALANCE_SDK.md).
    preference: 'webgl',
  });
  mountEl.appendChild(app.canvas);

  await loadTextures();

  // --- root: one uniform scale, letterboxed (§9.1) -------------------------
  const root = new Container();
  app.stage.addChild(root);

  // --- layers, bottom to top (§9.1) ---------------------------------------
  // surface base -> surface props -> ground decals -> [ground targets ->
  // ground FX (MVP)] -> air shadows -> pickups (MVP) -> player -> enemies ->
  // projectiles -> particles/FX. HUD is DOM, above all of it.
  const layers = {
    surfaceBase: new Container(),
    surfaceProps: new Container(),
    scrim: new Container(),
    surfaceEmissive: new Container(),
    ambient: new Container(),
    airShadows: new Container(),
    player: new Container(),
    // The boss sits UNDER the ordinary enemy layer. It is the largest thing on
    // screen and it is drawn as a single wide hull, so anything sharing the
    // band with it (fleeing survivors during the warning beat) must stay
    // readable on top rather than disappearing behind it.
    boss: new Container(),
    enemies: new Container(),
    // Damage overlays and HP pips ride ABOVE every craft so a scorched
    // Emitter's state is never occluded by a neighbour's hull.
    enemyOverlays: new Container(),
    projectiles: new Container(),
    particles: new Container(),
    devGuides: new Container(),
  };
  for (const k of Object.keys(layers)) root.addChild(layers[k]);

  // --- surface base --------------------------------------------------------
  // One large seamless texture scrolled by tile offset (Mode S) or held
  // (Mode A) -- one draw call either way. Not a tileset (§9.1).
  const firstSurface = surfaceAt(0);
  const base = new TilingSprite({
    texture: T(firstSurface.baseKey),
    width: DESIGN_W,
    height: DESIGN_H,
  });
  // Scale the tile so its width matches the frame: the surface must fill the
  // frame beneath the action at all times, and a horizontal repeat inside the
  // visible width would read as wallpaper.
  let baseTex = T(firstSurface.baseKey);
  let tileScale = DESIGN_W / baseTex.width;
  base.tileScale.set(tileScale);
  base.tint = SURFACE.surfaceTint;
  layers.surfaceBase.addChild(base);

  // --- scrim (§5.4) --------------------------------------------------------
  // A global tint/scrim multiplier over the surface container, so generated
  // art that comes back too hot is brought into the readability band WITHOUT
  // regenerating it (§9.5 rule 6). Sits above base+props, below everything
  // emissive and every action layer.
  const scrim = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({
    color: SURFACE.scrimColor,
    alpha: SURFACE.scrimAlpha,
  });
  layers.scrim.addChild(scrim);

  // --- surface emissive (§5.2 anti-deadness) -------------------------------
  // Authored emissive accents are allowed to be hot, so they render ABOVE the
  // scrim; they pulse on long, slow, out-of-phase cycles. This is what stops
  // Mode A's held frame reading as a still image.
  const glow = new TilingSprite({
    texture: T(firstSurface.glowKey),
    width: DESIGN_W,
    height: DESIGN_H,
  });
  glow.tileScale.set(DESIGN_W / Math.max(1, T(firstSurface.glowKey).width));
  glow.blendMode = 'add';
  layers.surfaceEmissive.addChild(glow);

  // --- ambient overlays ----------------------------------------------------
  // Render UNDER the action layer, never above it (§5.4). "Nothing drifts over
  // the playfield" -- 1945 Air Force's cloud scrim passes over the action and
  // measurably hurts readability. The only things above the action layer are
  // particles the player caused.
  //
  // UNCHANGED, DELIBERATELY: the choice to drive these off the surface's own
  // glow texture is flagged for a second opinion and is not being revisited
  // here. The only edit below is mechanical -- the manifest key 'surfaceGlow'
  // became per-surface when the second surface landed, so the same texture is
  // now named through /data/surfaces.js. setSurface() re-points it so the
  // overlays follow the active surface; without that, Kesselring's deck would
  // keep drifting Ashfall's magma haze over it.
  const ambient = [];
  for (let i = 0; i < 2; i++) {
    const a = new TilingSprite({
      texture: T('particle'),
      width: DESIGN_W,
      height: DESIGN_H,
    });
    a.texture = T(firstSurface.glowKey);
    a.tileScale.set((DESIGN_W / Math.max(1, T(firstSurface.glowKey).width)) * (i ? 1.7 : 2.6));
    a.alpha = SURFACE.overlayAlpha[i];
    a.blendMode = 'add';
    ambient.push(a);
    layers.ambient.addChild(a);
  }

  // Mode A's scheduled surface activity: a fissure flaring, off the player's
  // line so it is scenery, not a threat.
  const eventFlare = new Sprite(T('particle'));
  eventFlare.anchor.set(0.5);
  eventFlare.blendMode = 'add';
  eventFlare.tint = 0xff7a2a;
  eventFlare.visible = false;
  layers.ambient.addChild(eventFlare);

  // --- pooled sprite banks -------------------------------------------------
  const propSprites = bank(layers.surfaceProps, 24, () => new Sprite(T('drone')));
  const shadowSprites = bank(layers.airShadows, 96, () => {
    const s = new Sprite(T('shadow'));
    s.tint = 0x000000;
    s.alpha = SURFACE.shadow.alpha;
    return s;
  });
  const enemySprites = bank(layers.enemies, 64, () => new Sprite(T('drone')));
  // Damage feedback (§6.2). One shared scorch texture, tinted and scaled per
  // craft, plus a small pip row -- both pooled like everything else.
  const scorchSprites = bank(layers.enemyOverlays, 64, () => {
    const s = new Sprite(T('scorch'));
    return s;
  });
  const pipGraphics = new Graphics();
  layers.enemyOverlays.addChild(pipGraphics);

  // --- boss (§6.4) ---------------------------------------------------------
  // One hull + four pod instances of ONE pod sprite. Nothing here is created
  // per fight: a second boss swaps three textures exactly as a surface swap
  // does, which is what makes "the other two are data over it" true.
  const bossHull = new Sprite(T('bossCinderjawHull'));
  bossHull.anchor.set(0.5);
  bossHull.visible = false;
  layers.boss.addChild(bossHull);
  // The hull's own hit acknowledgement: one additive copy of the hull texture,
  // faded in for BOSS.hullHitFlashS on each landed bolt. A tint would fight the
  // death-sequence darkening and, at 9.5 hits/second, would simply never
  // release; an additive overlay adds light without taking the base tint away.
  const bossHullFlash = new Sprite(T('bossCinderjawHull'));
  bossHullFlash.anchor.set(0.5);
  bossHullFlash.blendMode = 'add';
  bossHullFlash.visible = false;
  layers.boss.addChild(bossHullFlash);
  // Shot channels and the core shutter, UNDER the pods and the core glow so the
  // targeting furniture never draws over the thing it is pointing at.
  const bossChannels = new Graphics();
  layers.boss.addChild(bossChannels);
  const bossCore = new Sprite(T('particle'));
  bossCore.anchor.set(0.5);
  bossCore.blendMode = 'add';
  bossCore.visible = false;
  layers.boss.addChild(bossCore);
  const podSprites = bank(layers.boss, 8, () => new Sprite(T('bossPod')));
  const bossGuides = new Graphics();
  layers.boss.addChild(bossGuides);
  const boltSprites = bank(layers.projectiles, 96, () => {
    const s = new Sprite(T('bolt'));
    s.blendMode = 'add';
    return s;
  });
  const orbSprites = bank(layers.projectiles, 96, () => {
    const s = new Sprite(T('orb'));
    s.blendMode = 'add';
    return s;
  });

  const ship = new Sprite(T('shipLevel'));
  ship.anchor.set(0.5);
  layers.player.addChild(ship);

  const particles = createParticles(layers.particles, T('particle'));

  // --- dev guides (POC-1) --------------------------------------------------
  // "Render layer up, design-space scaling and letterboxing, the band overlay
  // drawn as a dev guide (§5.1) [...] Confirm the 16:9 band budget looks right
  // before anything moves."
  const guides = buildBandGuides();
  layers.devGuides.addChild(guides);
  const aisleGuide = new Graphics();
  layers.devGuides.addChild(aisleGuide);
  const hitboxGuide = new Graphics();
  layers.devGuides.addChild(hitboxGuide);

  // --- letterboxing --------------------------------------------------------
  // The canvas is sized to the 16:9 letterbox itself rather than to the whole
  // viewport, so the DOM HUD can be laid out in the SAME box with plain CSS
  // percentages. §7.1 puts every HUD element in the margins at authored
  // fractions of the frame; if the canvas and the HUD disagreed about where
  // the frame is, the HUD-exclusion rule (§5.1) would be unenforceable.
  const box = { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H, scale: 1 };
  const resizeListeners = new Set();

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    box.scale = s;
    box.w = DESIGN_W * s;
    box.h = DESIGN_H * s;
    box.x = (vw - box.w) * 0.5;
    box.y = (vh - box.h) * 0.5;
    app.renderer.resize(box.w, box.h);
    root.scale.set(s);
    root.x = 0;
    root.y = 0;
    for (const fn of resizeListeners) fn(box);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  // -------------------------------------------------------------------------
  function draw(w) {
    const s = w.surface;

    // Surface base: scrolls in Mode S, held in Mode A. Same image, same
    // framing -- the mode choice does not fork the art budget.
    base.tilePosition.y = s.scroll % (baseTex.height * tileScale);
    base.visible = !w.debug.blackSurface;
    layers.surfaceProps.visible = !w.debug.blackSurface;

    // Emissive pulse.
    const ei = emissiveIntensity(w);
    glow.tilePosition.y = base.tilePosition.y;
    glow.alpha = w.debug.blackSurface ? 0 : 0.30 + ei * 0.55;

    for (let i = 0; i < 2; i++) {
      ambient[i].tilePosition.y = s.overlay[i];
      ambient[i].tilePosition.x = s.overlayX[i];
      ambient[i].visible = !w.debug.blackSurface;
    }

    if (s.event.active) {
      const k = s.event.t / s.event.dur;
      const env = Math.sin(Math.min(1, k) * Math.PI);
      eventFlare.visible = true;
      eventFlare.x = s.event.x;
      eventFlare.y = s.event.y;
      eventFlare.alpha = env * SURFACE.surfaceEvent.peakAlpha;
      eventFlare.scale.set((SURFACE.surfaceEvent.radius / 64) * (0.7 + env * 0.5));
    } else {
      eventFlare.visible = false;
    }

    // Props. The texture key comes from the ACTIVE SURFACE's own set
    // (/data/surfaces.js), so `kind` is an index into that surface's list
    // rather than a global prop id -- which is what stops volcanic rock
    // turning up on a shipyard deck.
    const propKeys = surfaceAt(w.surfaceIndex).props;
    let pi = 0;
    for (let i = 0; i < s.props.length; i++) {
      const p = s.props[i];
      if (!p.alive || pi >= propSprites.length) continue;
      const sp = propSprites[pi++];
      sp.visible = true;
      sp.texture = T(propKeys[p.kind % propKeys.length]);
      sp.anchor.set(0.5);
      sp.x = p.x;
      sp.y = p.y;
      sp.rotation = p.rot;
      sp.scale.set(p.scale);
      sp.tint = SURFACE.propTint;
    }
    for (; pi < propSprites.length; pi++) propSprites[pi].visible = false;

    // Air shadows -- the altitude cue (§5.4), required in both modes. The boss
    // gets one too: it is the biggest thing in the air and the one most likely
    // to read as painted onto the surface without it.
    let si = 0;
    si = drawShadow(shadowSprites, si, w.player.x, w.player.y, PLAYER.spriteWidth);
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.alive) continue;
      si = drawShadow(shadowSprites, si, e.x, e.y, enemyDef(e.type).spriteWidth);
    }
    for (; si < shadowSprites.length; si++) shadowSprites[si].visible = false;

    drawBoss(w);

    // Enemies -- one image per body, ROTATED AT RUNTIME to heading (§9.5
    // rule 3). The art is authored nose-up, so the sprite's own forward is
    // -PI/2 and the offset below converts heading into sprite rotation.
    //
    // Everything type-specific is read from the type table (§6.2): the
    // texture, the on-screen width and the tint. Nothing here branches on a
    // type name, which is the property that makes the remaining four types
    // data rather than render code.
    const dmg = ENEMY.damage;
    let ei2 = 0;
    let sci = 0;
    pipGraphics.clear();
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.alive || ei2 >= enemySprites.length) continue;
      const def = enemyDef(e.type);
      const sp = enemySprites[ei2++];
      sp.visible = true;
      sp.texture = T(def.id);
      sp.anchor.set(0.5);
      sp.x = e.x;
      sp.y = e.y;
      sp.rotation = e.heading + Math.PI / 2;
      // Per-craft size variation (ENEMY.vary) multiplies the DRAWN scale only.
      // The hitbox is still def.radius, so a craft is never harder to hit than
      // it looks and §5.3's collision arithmetic is untouched.
      const k = (def.spriteWidth * (e.sizeMul || 1)) / Math.max(1, sp.texture.width);
      sp.scale.set(k);
      // A hit flashes the craft white for 90 ms. Otherwise the craft wears its
      // per-craft tint skew, which stays inside §5.4's enemy family -- the
      // ownership coding has to survive every render state, so the variation is
      // a skew within it rather than a free colour.
      sp.tint = e.hitFlashT > 0 ? 0xffd9ff : (e.tint || def.tint);
      sp.alpha = e.mode === 'fleeing' ? 0.75 : 1;

      // --- damage feedback (§6.2), for types that can take a hit at all ----
      if (e.maxHp >= dmg.pipMinMaxHp) {
        const lost = 1 - Math.max(0, e.hp) / e.maxHp;
        if (lost > 0 && sci < scorchSprites.length) {
          // The scorch fades IN with damage rather than switching on at a
          // threshold, so a craft you have half-killed looks half-killed.
          const sc = scorchSprites[sci++];
          sc.visible = true;
          sc.anchor.set(0.5);
          sc.x = e.x;
          sc.y = e.y;
          sc.rotation = sp.rotation;
          sc.scale.set(
            (def.spriteWidth * (e.sizeMul || 1) * dmg.scorchScale) /
              Math.max(1, sc.texture.width)
          );
          sc.alpha = lost * dmg.scorchMaxAlpha;
        }
        drawHpPips(pipGraphics, e, def, dmg);
      }
    }
    for (; ei2 < enemySprites.length; ei2++) enemySprites[ei2].visible = false;
    for (; sci < scorchSprites.length; sci++) scorchSprites[sci].visible = false;

    // Player. Roll is a SPRITE SWAP and nothing else -- never a rotation, or
    // the nose would stop pointing north (§0.2 rule 3).
    const p = w.player;
    ship.visible = p.alive;
    ship.texture =
      p.roll < 0 ? T('shipRollL') : p.roll > 0 ? T('shipRollR') : T('shipLevel');
    ship.x = p.x;
    ship.y = p.y;
    ship.rotation = 0;
    const shipScale = PLAYER.spriteWidth / Math.max(1, ship.texture.width);
    ship.scale.set(shipScale);
    // i-frame flicker, so a bullet cluster visibly cannot strip three
    // segments in a frame (§5.10).
    ship.alpha = p.invulnT > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(w.time * 26)) : 1;
    if (p.alive) particles.thrust(p.x, p.y + 54, p.roll);

    // Projectiles. Colour-coded ownership, carried over verbatim: player fire
    // is cyan-white, enemy fire is orange/magenta, over a dark ground. "No
    // exceptions, including for bosses." (§5.4)
    let bi = 0;
    for (let i = 0; i < w.playerBolts.length; i++) {
      const b = w.playerBolts[i];
      if (!b.alive || bi >= boltSprites.length) continue;
      const sp = boltSprites[bi++];
      sp.visible = true;
      sp.anchor.set(0.5);
      sp.x = b.x;
      sp.y = b.y;
      sp.scale.set((b.r * 2.6) / Math.max(1, sp.texture.width));
      sp.tint = 0xd8fbff;
    }
    for (; bi < boltSprites.length; bi++) boltSprites[bi].visible = false;

    // Enemy orbs BREATHE -- a scale pulse plus an additive-glow pulse over the
    // one static texture (FX.enemyBulletPulse). Runtime transform only: no new
    // art, no particles, no extra draw call, which is exactly the economy §0.3
    // bought when it fixed the rendered idiom.
    //
    // The size swing is authored one-sided -- `0.5 + 0.5*sin` is in [0,1], so
    // the multiplier is in [1, 1+scaleAmp] and NEVER below 1. That is what
    // keeps §5.3's deliberate bullet sizing intact: the drawn orb is never
    // smaller than its authored radius, and therefore never smaller than the
    // hitbox it advertises. Do not "balance" this into a +/- swing.
    //
    // Tint stays neutral: the orange/magenta is in the texture, so §5.4's
    // ownership coding is untouched. Only alpha moves.
    const pulse = FX.enemyBulletPulse;
    const pulseW = w.time * pulse.rateHz * TWO_PI;
    let oi = 0;
    for (let i = 0; i < w.enemyBullets.length; i++) {
      const b = w.enemyBullets[i];
      if (!b.alive || oi >= orbSprites.length) continue;
      const sp = orbSprites[oi++];
      const ph = pulseW + b.phase;
      const grow = 1 + pulse.scaleAmp * (0.5 + 0.5 * Math.sin(ph));
      const glow = 0.5 + 0.5 * Math.sin(ph + pulse.glowPhaseOffset);
      sp.visible = true;
      sp.anchor.set(0.5);
      sp.x = b.x;
      sp.y = b.y;
      sp.scale.set(((b.r * 2.9) / Math.max(1, sp.texture.width)) * grow);
      sp.alpha = pulse.glowMin + (pulse.glowMax - pulse.glowMin) * glow;
      sp.tint = 0xffffff;
    }
    for (; oi < orbSprites.length; oi++) orbSprites[oi].visible = false;

    particles.update(1 / 60);

    // Dev guides.
    guides.visible = w.debug.bands;
    drawAisleGuide(aisleGuide, w);
    drawHitboxGuide(hitboxGuide, w);

    // Screen shake. A uniform TRANSLATION of the root, never a rotation and
    // never a tilt (§0.2) -- and always written absolutely rather than
    // accumulated, so it cannot drift the frame off-centre over a long run.
    if (w.fx.shakeT > 0) {
      const k = w.fx.shakeT / FX.screenShake.hitDurationS;
      const mag = w.fx.shakeMag * k * root.scale.x;
      root.x = (Math.random() - 0.5) * mag;
      root.y = (Math.random() - 0.5) * mag;
    } else if (root.x !== 0 || root.y !== 0) {
      root.x = 0;
      root.y = 0;
    }
  }

  /**
   * The boss (§6.4). One wide hull, four pod instances of one pod sprite, and
   * an additive core that only lights when the core is actually takeable --
   * the light IS the tell, so it must never be on decoratively.
   */
  function drawBoss(w) {
    const b = w.boss;
    if (!b.active) {
      bossHull.visible = false;
      bossHullFlash.visible = false;
      bossCore.visible = false;
      for (const p of podSprites) p.visible = false;
      bossChannels.clear();
      bossGuides.clear();
      return;
    }

    const def = bossDef(b.id);
    bossHull.visible = true;
    bossHull.texture = T(def.hullKey);
    bossHull.x = b.x;
    bossHull.y = b.y;
    bossHull.scale.set(BOSS.width / Math.max(1, bossHull.texture.width));
    // Dying: the hull darkens and shudders as the break-up runs, so the death
    // beat is legible even before the last blast (§6.4).
    const dying = b.phase === 'dying';
    bossHull.tint = dying ? 0x6a5a6a : 0xffffff;

    // The hit flash, on the hull boss where the hull itself is the target. It is
    // deliberately faint: the loud per-shot cues are the impact spark and the
    // ticking HP integer, and a hull that strobes at the fire rate would bury
    // both while making the fight harder to look at for 25 s.
    bossHullFlash.visible = !dying && b.hitFlashT > 0;
    if (bossHullFlash.visible) {
      bossHullFlash.texture = bossHull.texture;
      bossHullFlash.x = bossHull.x;
      bossHullFlash.y = bossHull.y;
      bossHullFlash.scale.copyFrom(bossHull.scale);
      bossHullFlash.alpha =
        BOSS.hullHitFlashAlpha * (b.hitFlashT / BOSS.hullHitFlashS);
    }

    // Pods. A destroyed pod stays on the hull as wreckage rather than
    // vanishing: the player needs to see what they have already done, and an
    // empty socket would read as "nothing was ever there".
    //
    // A HULL BOSS HAS NONE, and this loop simply runs zero times -- there is no
    // "if hull boss" here. That is the point of expressing the difference as a
    // row rather than a branch.
    let pi = 0;
    for (const pod of b.pods) {
      if (pi >= podSprites.length) break;
      const sp = podSprites[pi++];
      const pp = podPosition(b, pod);
      sp.visible = true;
      sp.texture = T(pod.alive ? def.podKey : def.podDeadKey);
      sp.anchor.set(0.5);
      sp.x = pp.x;
      sp.y = pp.y;
      // A hit pops the pod slightly as well as flashing it. Scale is the cue
      // that survives a busy frame -- a tint change on an 86px sprite inside a
      // 1340px hull full of highlights is easy to miss, a silhouette that jumps
      // is not.
      const pop = pod.hitFlashT > 0 ? 1 + 0.12 * (pod.hitFlashT / 0.14) : 1;
      sp.scale.set((BOSS.podSpriteWidth / Math.max(1, sp.texture.width)) * pop);
      sp.rotation = 0;
      // A pod in the firing rotation pulses, so the player can see WHICH pod
      // is producing the pattern they are dodging. That is the whole reason
      // pod-owned patterns are worth building: the fight is legible enough to
      // have a target priority.
      if (pod.alive && pod.firing) {
        sp.tint = pod.hitFlashT > 0 ? 0xffffff : 0xffd0ee;
        sp.alpha = 0.9 + 0.1 * Math.sin(w.time * 7);
      } else {
        sp.tint = pod.hitFlashT > 0 ? 0xffffff : 0xbfb4c4;
        sp.alpha = 1;
      }
    }
    for (; pi < podSprites.length; pi++) podSprites[pi].visible = false;

    // --- targeting furniture, for POD BOSSES ONLY -------------------------
    //
    // Nothing on the hull used to tell the player where to shoot, which was half
    // of why the fight read as invulnerable: four 86px pods on a 1340px hull,
    // unmarked. Each live pod now shows its SHOT CHANNEL -- the lane a bolt can
    // actually travel up (BOSS.podHitHalfW) -- with a caret at its mouth on the
    // hull skirt, a bracket reticle round the pod, and a pip row for its HP.
    // What you see is exactly what you hit.
    //
    // CYAN, per §5.4's ownership coding: player fire is cyan-white and enemy
    // fire is orange/magenta, so the player's own aiming overlay can only be one
    // of those, and cyan can never be misread as the boss shooting back. The
    // pods themselves keep their enemy colouring underneath it.
    //
    // A hull boss draws none of this -- `b.pods` is empty and every loop below
    // runs zero times. Boss one has no weak point to mark, by design.
    bossChannels.clear();
    if (!dying && b.pods.length) {
      const TG = BOSS.targeting;
      const skirt = bossSkirtY(b);
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(w.time * TG.pulseHz));
      for (const pod of b.pods) {
        if (!pod.alive) continue;
        const pp = podPosition(b, pod);
        const half = BOSS.podHitHalfW;
        const top = pp.y;
        // The lane itself: barely-there fill, legible edges. It has to read as
        // an opening in the armour, not as a beam.
        bossChannels
          .rect(pp.x - half, top, half * 2, skirt - top)
          .fill({ color: TG.color, alpha: TG.channelFillAlpha });
        bossChannels
          .moveTo(pp.x - half, top)
          .lineTo(pp.x - half, skirt)
          .moveTo(pp.x + half, top)
          .lineTo(pp.x + half, skirt)
          .stroke({ color: TG.color, width: 2, alpha: TG.channelEdgeAlpha });
        // The caret at the lane's mouth, pointing up into it.
        bossChannels
          .moveTo(pp.x - TG.caretW, skirt)
          .lineTo(pp.x, skirt - TG.caretH)
          .lineTo(pp.x + TG.caretW, skirt)
          .stroke({ color: TG.color, width: 3, alpha: 0.5 + pulse * 0.4 });
      }
    }

    // The core. Lit only while it is genuinely damageable -- all pods gone, or
    // the vulnerable window open. §6.4 makes the window "announced", and this
    // is the announcement on the playfield itself rather than only in text.
    //
    // A hull boss has no core, so nothing here lights at all: `hullBoss` short-
    // circuits it rather than the geometry happening to be uninteresting.
    const core = corePosition(b);
    const exposed = !b.hullBoss && b.pods.every((p) => !p.alive);
    const lit = !b.hullBoss && (exposed || b.windowOpen);
    bossCore.visible = lit && !dying;
    if (bossCore.visible) {
      const beat = 0.5 + 0.5 * Math.sin(w.time * (b.windowOpen ? 9 : 4));
      bossCore.x = core.x;
      bossCore.y = core.y;
      bossCore.scale.set(
        ((BOSS.coreRadius * 3.4) / Math.max(1, bossCore.texture.width)) *
          (0.9 + beat * 0.22)
      );
      // Enemy ownership colour, no exceptions including for bosses (§5.4).
      bossCore.tint = b.windowOpen ? 0xff6ad0 : 0xff9a3c;
      bossCore.alpha = 0.55 + beat * 0.4;
    }

    // The window's climb line. Drawn only while the window is open, at the
    // core's x, so the optional vertical move has an unmistakable target --
    // §0.5 permits the vertical axis only for moves that are generously
    // signposted, and a bare timer would not be.
    bossGuides.clear();
    if (b.windowOpen && !dying) {
      const y = BOSS.window.rewardY * DESIGN_H;
      const pulse = 0.35 + 0.3 * Math.abs(Math.sin(w.time * 5));
      bossGuides
        .moveTo(core.x - 180, y)
        .lineTo(core.x + 180, y)
        .stroke({ color: 0xff8ad8, width: 4, alpha: pulse });
      bossGuides
        .moveTo(core.x, core.y + BOSS.coreRadius)
        .lineTo(core.x, y)
        .stroke({ color: 0xff8ad8, width: 2, alpha: pulse * 0.6 });
    }

    // Pod reticles and per-pod HP pips, on top of the pods themselves. Pod boss
    // only, for the same structural reason as the channels below them.
    if (!dying && b.pods.length) {
      const TG = BOSS.targeting;
      const PP = BOSS.podPips;
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(w.time * TG.pulseHz));
      for (const pod of b.pods) {
        if (!pod.alive) continue;
        const pp = podPosition(b, pod);
        const hx = BOSS.podHitHalfW;
        const hy = BOSS.podRadius + 8;
        const c = TG.reticleCorner;
        const hit = pod.hitFlashT > 0;
        const stroke = {
          color: hit ? 0xffffff : TG.color,
          width: TG.reticleWidth,
          alpha: hit ? 1 : TG.reticleAlpha * pulse,
        };
        // Four corner brackets rather than a closed box: the bracket reads as a
        // reticle at a glance, and leaving the sides open keeps the pod's own
        // silhouette (and its damage state) unobscured.
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            bossGuides
              .moveTo(pp.x + sx * hx, pp.y + sy * (hy - c))
              .lineTo(pp.x + sx * hx, pp.y + sy * hy)
              .lineTo(pp.x + sx * (hx - c), pp.y + sy * hy)
              .stroke(stroke);
          }
        }
        // HP pips above the pod -- the same language as a damaged Emitter's pip
        // row (ENEMY.damage), on purpose. The player has already learned "green
        // pips over a thing = that thing's HP", and the pods are then the only
        // parts of the boss wearing them, which is most of what makes "shoot
        // those four" legible without a line of tutorial text.
        const n = pod.maxHp;
        const total = n * PP.w + (n - 1) * PP.gap;
        const x0 = pp.x - total * 0.5;
        const py = pp.y + PP.offsetY;
        for (let i = 0; i < n; i++) {
          bossGuides.rect(x0 + i * (PP.w + PP.gap), py, PP.w, PP.h).fill({
            color: i < pod.hp ? ENEMY.damage.pipOnColor : ENEMY.damage.pipOffColor,
            alpha: i < pod.hp ? 0.95 : 0.6,
          });
        }
      }
    }
  }

  /**
   * Point the surface layers at a different sector surface (§5.4).
   *
   * This is the whole of the surface swap on the render side: three texture
   * assignments and a rescale. It is that small on purpose -- §5.2's rule that
   * "every art asset is shared" between framing modes means a surface is data,
   * not a scene, so changing one cannot require rebuilding anything. No sprite
   * is created or destroyed here and nothing is loaded: both surfaces are
   * resident from boot, which is what lets the swap happen inside a covering
   * beat short enough to feel like a cut rather than a load.
   *
   * Call it while the screen is covered -- see /surface/transition.js.
   */
  function setSurface(s) {
    baseTex = T(s.baseKey);
    tileScale = DESIGN_W / Math.max(1, baseTex.width);
    base.texture = baseTex;
    base.tileScale.set(tileScale);

    const glowTex = T(s.glowKey);
    glow.texture = glowTex;
    glow.tileScale.set(DESIGN_W / Math.max(1, glowTex.width));

    for (let i = 0; i < ambient.length; i++) {
      ambient[i].texture = glowTex;
      ambient[i].tileScale.set(
        (DESIGN_W / Math.max(1, glowTex.width)) * (i ? 1.7 : 2.6)
      );
    }
  }

  return {
    app,
    draw,
    resize,
    setSurface,
    particles,
    box,
    /** The boss hull texture's width/height.
     *
     *  §6.4 caps the boss's lowest extent at y = 0.58, and that extent is
     *  (authored width / aspect) / 2 either side of its station -- so the
     *  guarantee depends on the real proportions of the art, not on a number
     *  someone typed. Publishing the measured aspect out of /render lets both
     *  the boss controller and the boot validator work from what actually
     *  shipped, and means swapping in a differently-shaped hull cannot quietly
     *  push it into the player band. */
    bossHullAspect(bossId) {
      const def = bossDef(bossId);
      const t = def && def.hullKey ? T(def.hullKey) : null;
      return t && t.height ? t.width / t.height : 2.7;
    },
    onResize(fn) {
      resizeListeners.add(fn);
      fn(box);
      return () => resizeListeners.delete(fn);
    },
    // The FX facade the simulation is allowed to see. Systems outside /render
    // cannot address a particle (§9.1); they can only ask for one of these.
    // Anything added to /render/particles.js has to be published HERE too or the
    // caller gets a silent "not a function" -- which, inside the SDK's rAF shim,
    // is genuinely silent in a browser. See the shim note in index.html.
    fx: {
      explosion: (x, y) => particles.explosion(x, y),
      impact: (x, y) => particles.impact(x, y),
      bossImpact: (x, y) => particles.bossImpact(x, y),
      deflect: (x, y) => particles.deflect(x, y),
      playerHit: (x, y) => particles.playerHit(x, y),
    },
    clearFx: () => particles.clear(),
  };
}

// ---------------------------------------------------------------------------

function bank(container, n, factory) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) {
    const s = factory();
    s.anchor.set(0.5);
    s.visible = false;
    container.addChild(s);
    arr[i] = s;
  }
  return arr;
}

function drawShadow(pool, i, x, y, width) {
  if (i >= pool.length) return i;
  const s = pool[i];
  s.visible = true;
  s.x = x + SURFACE.shadow.offsetX;
  s.y = y + SURFACE.shadow.offsetY;
  s.scale.set((width * SURFACE.shadow.scale) / 128);
  return i + 1;
}

/** The band budget, drawn as a dev guide (§5.1, POC-1). */
function buildBandGuides() {
  const g = new Graphics();
  const rows = [
    ['hudStrip', 0xff4466],
    ['entryTelegraph', 0xffaa33],
    ['formation', 0xaa66ff],
    ['gutter', 0x33ddaa],
    ['player', 0x33aaff],
    ['bottomStrip', 0x666677],
  ];
  for (const [key, col] of rows) {
    const b = BANDS[key];
    g.rect(0, b.top * DESIGN_H, DESIGN_W, (b.bottom - b.top) * DESIGN_H).stroke({
      color: col,
      width: 2,
      alpha: 0.8,
    });
  }
  // Playable width + the 6% HUD margins.
  g.rect(PLAYABLE_X.min * DESIGN_W, 0, (PLAYABLE_X.max - PLAYABLE_X.min) * DESIGN_W, DESIGN_H)
    .stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
  // The lateral-only test line (§5.3): every wave must be clearable holding
  // this y and moving laterally only.
  g.moveTo(0, 0.82 * DESIGN_H)
    .lineTo(DESIGN_W, 0.82 * DESIGN_H)
    .stroke({ color: 0x00ff88, width: 2, alpha: 0.6 });
  g.visible = false;
  return g;
}

/** The floating HP pip row (§6.2), for types that can survive a hit.
 *
 *  Drawn as vector pips rather than a sprite because it is a COUNT, and a
 *  count wants to be crisp at any craft size. Only shown once the craft has
 *  actually been hit: a full row over every Emitter on screen would be
 *  clutter, and the question the pip answers ("have I already put bolts into
 *  that one?") only exists after the first bolt lands. */
function drawHpPips(g, e, def, dmg) {
  if (e.hp >= e.maxHp) return;
  const n = e.maxHp;
  const total = n * dmg.pipW + (n - 1) * dmg.pipGap;
  const x0 = e.x - total * 0.5;
  const y = e.y + def.spriteWidth * dmg.pipOffsetY;
  for (let i = 0; i < n; i++) {
    g.rect(x0 + i * (dmg.pipW + dmg.pipGap), y, dmg.pipW, dmg.pipH).fill({
      color: i < e.hp ? dmg.pipOnColor : dmg.pipOffColor,
      alpha: i < e.hp ? 0.95 : 0.65,
    });
  }
}

const _aisleScratch = [];

function drawAisleGuide(g, w) {
  g.clear();
  if (!w.debug.aisle) return;
  // Every live aisle, from every source -- the wave's patterns, Emitter craft
  // and boss pods alike. Reading only the wave's would silently stop showing
  // the aisle in exactly the fights where it matters most.
  for (const aisle of activeAisles(w, _aisleScratch)) {
    const x = aisle.x;
    const half = aisle.w * 0.5;
    g.rect(x - half, BANDS.formation.bottom * DESIGN_H, aisle.w, DESIGN_H * 0.3).fill({
      color: 0x00ff88,
      alpha: 0.12,
    });
    // AISLE_MIN drawn alongside, so an authored aisle can be eyeballed
    // against the floor rather than trusted.
    g.rect(x - AISLE_MIN / 2, BANDS.formation.bottom * DESIGN_H, AISLE_MIN, 8).fill({
      color: 0xffff00,
      alpha: 0.8,
    });
  }
}

function drawHitboxGuide(g, w) {
  g.clear();
  if (!w.debug.hitboxes) return;
  // The player hitbox is a 14px circle at the cockpit -- far smaller than the
  // ~120px sprite. Seeing the two together is the point of this guide (§5.10).
  g.circle(w.player.x, w.player.y, PLAYER.hitboxRadius).stroke({
    color: 0x00ffcc,
    width: 2,
  });
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive) continue;
    g.circle(e.x, e.y, enemyDef(e.type).radius).stroke({
      color: 0xff5599,
      width: 1,
      alpha: 0.7,
    });
  }
  // The boss's real damage geometry.
  //
  // THIS OVERLAY USED TO LIE, and the lie is why the unkillable fight survived
  // inspection: it drew four 43px pod discs and the full hull RECT, which looked
  // like a reasonable target layout. What it did not draw was the fact that the
  // rect was tested first and consumed the bolt at its bottom edge, 246px below
  // every disc -- so the overlay showed targets that no bolt could ever reach.
  // It now draws what /enemies/boss.js actually tests, in the order it tests it.
  if (w.boss.active) {
    const b = w.boss;
    const box = bossHullBox(b);
    const skirt = bossSkirtY(b);
    // The drawn extent (faint) against the DAMAGE silhouette (solid), so the
    // ~69px of empty texture below the visible body is visible as a gap.
    const drawnHalf = bossHalfH(b);
    g.rect(box.left, b.y - drawnHalf, BOSS.width, drawnHalf * 2).stroke({
      color: 0x8866ff,
      width: 1,
      alpha: 0.3,
    });
    g.rect(box.left, box.top, BOSS.width, box.bottom - box.top).stroke({
      color: 0x8866ff,
      width: 2,
      alpha: 0.75,
    });
    for (const pod of b.pods) {
      if (!pod.alive) continue;
      const pp = podPosition(b, pod);
      // The shot channel -- the shape a bolt is really tested against -- plus
      // the pod's own acceptance band at the top of it.
      g.rect(pp.x - BOSS.podHitHalfW, pp.y, BOSS.podHitHalfW * 2, skirt - pp.y).stroke(
        { color: 0x33ffcc, width: 1, alpha: 0.7 }
      );
      g.circle(pp.x, pp.y, BOSS.podRadius).stroke({ color: 0xffaa33, width: 2 });
    }
    if (!b.hullBoss) {
      const core = corePosition(b);
      g.rect(core.x - BOSS.coreRadius, core.y, BOSS.coreRadius * 2, skirt - core.y).stroke(
        { color: 0xff3399, width: 1, alpha: 0.5 }
      );
      g.circle(core.x, core.y, BOSS.coreRadius).stroke({ color: 0xff3399, width: 2 });
    }
  }
  for (let i = 0; i < w.enemyBullets.length; i++) {
    const b = w.enemyBullets[i];
    if (!b.alive) continue;
    g.circle(b.x, b.y, b.r).stroke({ color: 0xffaa00, width: 1, alpha: 0.6 });
  }
}
