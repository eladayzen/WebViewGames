// ALL RENDERER API CALLS LIVE UNDER /render AND NOWHERE ELSE (§9.1).
//
// Game state is plain data, systems mutate plain data, this layer reads it.
// Nothing outside this folder imports pixi.js -- which is the entire reason the
// CTO's outstanding 2D-default call (PixiJS vs raw Canvas, §9.1/§12) does not
// block the build: swapping the renderer means rewriting this folder and
// nothing else.
//
// WHY PIXI, FOR THE RECORD. The build doc recommends it; this repo's most
// recent 2D game already ships on it, so the dependency is not new to the SDK;
// and this game leans on exactly the three things it buys over raw Canvas --
// per-container tint (the zone lighting pass, the barrel pass, and §9.6 rule
// 8's "bring hot art into the readability band with a tint, not a
// regeneration"), additive blending for spray and glow, and TilingSprite, which
// is literally §9.1's "scroll them by UV offset, not by redrawing".

import {
  Application, Assets, Container, Sprite, Graphics, Text, TilingSprite, Texture,
} from 'pixi.js';
import {
  DESIGN_W, DESIGN_H, PLAYER_X, PARALLAX, PARTICLE_CAP, ENTITY_FADE,
  PROP_TOP_MIN_Y, COIN_POP_CAP,
} from '../data/tuning.js';
import { ASSET_MANIFEST } from './assets.js';
import { ParticleField } from './particles.js';
import { KINDS } from './particleKinds.js';

// Where the painted face texture's top edge lands. Just above the highest
// crestY (0.20 at the left edge), so the mask always has paint to show.
const FACE_TOP = DESIGN_H * 0.17;

const MISSING = 0xff00aa; // loud magenta: a missing texture must never read as art

export class Renderer {
  constructor() {
    this.app = null;
    this.root = null;
    this.textures = {};
    this.missing = [];
    this.layers = {};
    this.particles = new ParticleField(PARTICLE_CAP);
    this._hazardSprites = new Map();
    this._pickupSprites = new Map();
    this._payouts = [];
    this._coinPops = [];
    this._maskDirty = true;
    this._lastRailKey = '';
  }

  async init(hostEl) {
    this.app = new Application();
    await this.app.init({
      // Deep navy, not a pale slate: it is what shows through wherever the
      // painted layers are faded out, and inside the barrel that has to read as
      // darkness beyond the tube's ceiling rather than as daylight.
      background: 0x111a2b,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      preference: 'webgl',
    });
    hostEl.appendChild(this.app.canvas);

    // The simulation is driven by our own fixed-timestep loop in /core, not by
    // Pixi's ticker -- the pacing contract in §5.3 is expressed in seconds and
    // must not drift with frame rate.
    this.app.ticker.stop();

    this.root = new Container();
    this.app.stage.addChild(this.root);

    await this._loadTextures();
    this._buildLayers();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  async _loadTextures() {
    // Assets.init() MUST be awaited before any Assets.load(). Firing several
    // concurrent loads at an uninitialised Assets deadlocks -- the promises
    // simply never settle, boot never finishes, and the title card sits there
    // forever with no error anywhere. Cost an hour; noted here so it costs
    // nobody else one.
    await Assets.init();

    // Decode on the main thread rather than in a worker. Pixi's worker decode
    // path is the faster one on a desktop browser, but this game ships into a
    // WebView (and is verified in headless Chrome), and in both of those the
    // worker route has stalled outright -- a load promise that never settles,
    // no error, boot simply never finishing. Fewer moving parts wins here; the
    // decode cost is invisible against a ~30-texture manifest.
    Assets.setPreferences({ preferWorkers: false });

    const entries = Object.entries(ASSET_MANIFEST);
    // Belt and braces: a load that wedges must never wedge the whole game. It
    // degrades to a loud magenta placeholder instead, which is visible and
    // debuggable; a black screen on device is neither.
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('asset load timeout')), ms)),
    ]);
    const results = await Promise.allSettled(
      entries.map(([, url]) => withTimeout(Assets.load(url), 15000))
    );
    entries.forEach(([key], i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        this.textures[key] = r.value;
      } else {
        this.missing.push(key);
        this.textures[key] = null;
      }
    });
    if (this.missing.length && window.Unity) {
      window.Unity.call('MISSING ART: ' + this.missing.join(', '));
    }
  }

  tex(key) {
    return this.textures[key] || Texture.WHITE;
  }

  isMissing(key) { return !this.textures[key]; }

  /**
   * THE SUN WASH (§9.6 rule 8, the additive half of it).
   *
   * Why this exists: the shipped environment art measured out genuinely
   * desaturated -- median saturation 0.079 across 37 assets, clouds at 0.036 --
   * and Amit read the result as "super grey... dark instead of happy". The
   * first attempt was a warm MULTIPLY tint per zone, which moved the frame's
   * median hue 214deg -> 33deg but left saturation flat and cost 11% of the
   * brightness: grey x warm = brown, not gold. Multiply cannot add light.
   *
   * So this layer ADDS it. A vertical warm gradient, composited additively,
   * strongest just under the horizon where the sun sits and falling off into
   * the top of the sky and down into the trough. Additive genuinely raises both
   * luminance and saturation, which is the thing the tint could not do.
   *
   * It is a LIGHTING pass, not a surface texture -- the "environment surfaces
   * must be real generated art, never procedural canvas" rule is about the
   * water/sky/ground art itself, which is untouched here and still generated.
   *
   * No shader (§9.1): a 1 x 256 canvas gradient stretched to frame, tinted per
   * zone and cross-faded exactly like the zone tints.
   */
  _buildSunWash() {
    const L = this.layers;

    const H = 256;
    const cv = document.createElement('canvas');
    cv.width = 1;
    cv.height = H;
    const ctx = cv.getContext('2d');

    // Horizon sits around y 0.24 of the frame; the wash peaks a touch below it
    // and decays both ways. Values are LIGHT being added, so they stay modest --
    // additive blows out fast.
    const HORIZON = 0.26;
    for (let i = 0; i < H; i++) {
      const y = i / (H - 1);
      const d = Math.abs(y - HORIZON);
      // Asymmetric falloff: slower downward into the water, faster up into sky.
      const fall = y < HORIZON ? d / 0.26 : d / 0.62;
      const a = Math.max(0, 1 - fall * fall);
      ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(4)})`;
      ctx.fillRect(0, i, 1, 1);
    }

    L.sunWashSprite = new Sprite(Texture.from(cv));
    L.sunWashSprite.width = DESIGN_W;
    L.sunWashSprite.height = DESIGN_H;
    L.sunWashSprite.blendMode = 'add';
    L.sunWashSprite.alpha = 0;        // resolved per zone each frame
    L.sunWashSprite.tint = 0xffffff;  // ditto
    L.sunwash.addChild(L.sunWashSprite);
  }

  // -- layer construction ---------------------------------------------------

  _buildLayers() {
    const L = this.layers;
    const add = (name) => {
      const c = new Container();
      this.root.addChild(c);
      L[name] = c;
      return c;
    };

    // Layer order, bottom to top, exactly as §9.1 specifies it.
    add('sky');
    add('clouds');
    add('stacks');
    add('headland');
    add('faceGroup');      // wave face texture + detail streaks + trough wash
    add('barrelGroup');    // replaces the face layers wholesale
    // THE SUN WASH (see _buildSunWash). Additive warm light over sky, props and
    // water, and deliberately BELOW hazards/pickups/player so it can never
    // wash out the things the player has to read.
    add('sunwash');
    add('hazards');
    add('pickups');
    add('player');
    add('foam');           // foam / lip wall
    add('particles');
    add('payouts');        // world-space payout numerals
    add('lens');           // the airborne lens, above everything in-world

    // Sky is a full-frame painted sprite, gently parallaxed.
    L.skySprite = new Sprite(this.tex('zone-open-sea-sky'));
    L.skySprite.width = DESIGN_W * 1.3;
    L.skySprite.height = DESIGN_H;
    L.sky.addChild(L.skySprite);
    L.skyNext = new Sprite(this.tex('zone-overhang-sky'));
    L.skyNext.width = DESIGN_W * 1.3;
    L.skyNext.height = DESIGN_H;
    L.skyNext.alpha = 0;
    L.sky.addChild(L.skyNext);

    L.cloudBand = new TilingSprite({
      texture: this.tex('clouds'), width: DESIGN_W, height: DESIGN_H * 0.32,
    });
    fitTileVertically(L.cloudBand, 0, DESIGN_H * 0.26);
    L.cloudBand.alpha = 0.62;
    L.clouds.addChild(L.cloudBand);

    // The wave face: three tiling layers, all masked by the wave silhouette so
    // nothing paints into the sky band.
    //
    // FACE_TOP is where the painted face texture's own top edge lands. It sits
    // just above the highest point of crestY so the pale sea-foam top of the
    // painting is the water immediately under the lip, and the deep navy bottom
    // is the trough. The mask throws away everything above the crest.
    L.faceTile = new TilingSprite({ texture: this.tex('wave-face'), width: DESIGN_W, height: DESIGN_H });
    fitTileVertically(L.faceTile, FACE_TOP, DESIGN_H - FACE_TOP);
    L.streakTile = new TilingSprite({ texture: this.tex('wave-streaks'), width: DESIGN_W, height: DESIGN_H });
    fitTileVertically(L.streakTile, FACE_TOP, DESIGN_H - FACE_TOP);
    // Generated on pure black, so additive blending IS its alpha channel -- and
    // sunlight refracting through the lip is additive light in the first place.
    L.streakTile.alpha = 0.22;
    L.streakTile.blendMode = 'add';
    L.troughTile = new TilingSprite({ texture: this.tex('wave-trough'), width: DESIGN_W, height: DESIGN_H * 0.30 });
    // Same trick: white foam painted on black, composited additively over the
    // deep water at the bottom of the face.
    L.troughTile.blendMode = 'add';
    L.troughTile.alpha = 0.34;
    fitTileVertically(L.troughTile, 0, DESIGN_H * 0.24);
    L.faceGroup.addChild(L.faceTile, L.streakTile, L.troughTile);

    this._buildSunWash();

    L.barrelTile = new TilingSprite({ texture: this.tex('barrel-interior'), width: DESIGN_W, height: DESIGN_H });
    fitTileVertically(L.barrelTile, FACE_TOP, DESIGN_H - FACE_TOP);
    L.kelpTile = new TilingSprite({ texture: this.tex('barrel-kelp'), width: DESIGN_W, height: DESIGN_H });
    fitTileVertically(L.kelpTile, FACE_TOP, DESIGN_H - FACE_TOP);
    L.kelpTile.alpha = 0.85;
    L.barrelGroup.addChild(L.barrelTile, L.kelpTile);
    L.barrelGroup.alpha = 0;

    // One mask, shared by the face and barrel groups: the silhouette is static
    // in screen space except during a barrel transition (§5.2, §5.7).
    // A mask must be in the same coordinate space as what it masks: this is a
    // child of root like every other layer, and resize() deliberately leaves it
    // alone.
    L.faceMask = new Graphics();
    this.root.addChild(L.faceMask);
    L.faceGroup.mask = L.faceMask;
    L.barrelGroup.mask = L.faceMask;

    // Foam band along the crest, and the lip wall at the left edge.
    // THE CREST FOAM BAND LIVES INSIDE THE MASKED FACE GROUP, not in the
    // top-of-everything foam layer that §9.1's layer order puts it in. The
    // reason is concrete: unmasked, a band of foam riding the crest also paints
    // into the SKY band, and the sky band is where the zone props live -- it hid
    // every sea stack, arch and pier in the game. Masked, it can only appear on
    // water, which is where foam is. The LIP WALL, which genuinely has to read
    // in front of everything, stays in the foam layer as specced.
    L.foamTile = new TilingSprite({ texture: this.tex('wave-foam'), width: DESIGN_W, height: DESIGN_H * 0.13 });
    fitTileVertically(L.foamTile, 0, DESIGN_H * 0.13);
    L.foamTile.alpha = 0.9;
    L.faceGroup.addChild(L.foamTile);
    L.lipWall = new Sprite(this.tex('wave-lip'));
    L.lipWall.anchor.set(0, 0);
    L.foam.addChild(L.lipWall);

    // Player sprite + the airborne lens.
    L.playerSprite = new Sprite(this.tex('wren-trim'));
    L.playerSprite.anchor.set(0.5, 0.82); // feet/board at the rail, not the centre
    L.player.addChild(L.playerSprite);

    // THE RED `!` ALERT BUBBLE (§5.3, §6.2, §7.2). Nothing in this game closes
    // on the player without a telegraph, and the telegraph has to be readable
    // from the middle of the screen -- §7.2: "a player watching the middle of
    // the screen should never need to check a corner readout to know what is
    // about to happen."
    L.alertBubble = new Container();
    L.alertBg = new Graphics();
    L.alertBubble.addChild(L.alertBg);
    L.alertText = new Text({
      text: '!',
      style: {
        fontFamily: 'Rockwell, "Roboto Slab", Georgia, serif',
        fontSize: 54, fontWeight: '700', fill: 0xffffff,
      },
    });
    L.alertText.anchor.set(0.5, 0.5);
    L.alertBubble.addChild(L.alertText);
    L.alertBubble.visible = false;
    L.hazards.addChild(L.alertBubble);

    L.seabirdSprite = new Sprite(this.tex('seabird'));
    L.seabirdSprite.anchor.set(0.5, 0.5);
    L.seabirdSprite.visible = false;
    L.hazards.addChild(L.seabirdSprite);

    L.lensDim = new Graphics();
    L.lensDim.rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x1b2740, alpha: 1 });
    L.lensDim.alpha = 0;
    L.lens.addChild(L.lensDim);
    L.lensRing = new Graphics();
    L.lens.addChild(L.lensRing);

    L.particleHost = new Container();
    L.particles.addChild(L.particleHost);
    this.particles.attach(L.particleHost, this.tex('fx-spray'), this.tex('fx-foam'), this.tex('fx-bubble'));

    this._propSprites = [];
    this._stackSprites = [];
  }

  /**
   * The wave silhouette mask: the usable face plus everything below it, down to
   * the bottom of the frame. Rebuilt only when the rail actually changes, which
   * outside a barrel transition is never (§5.2 -- do not animate the face rail).
   */
  _rebuildMask(wave) {
    const key = `${wave.railA.name || 'a'}|${wave.railB.name || 'b'}|${wave.railMix.toFixed(3)}`;
    if (key === this._lastRailKey) return;
    this._lastRailKey = key;

    const g = this.layers.faceMask;
    g.clear();
    const steps = 48;
    g.moveTo(-0.1 * DESIGN_W, DESIGN_H + 40);
    for (let i = 0; i <= steps; i++) {
      const x = -0.1 + (1.2 * i) / steps;
      g.lineTo(x * DESIGN_W, wave.crestY(x) * DESIGN_H);
    }
    g.lineTo(1.1 * DESIGN_W, DESIGN_H + 40);
    g.closePath();
    g.fill({ color: 0xffffff });
  }

  // -- scaling / letterboxing ----------------------------------------------

  resize() {
    if (!this.app) return;
    const host = this.app.canvas.parentElement;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    this.app.renderer.resize(w, h);
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.root.scale.set(scale);
    this.root.position.set((w - DESIGN_W * scale) / 2, (h - DESIGN_H * scale) / 2);
    // NOTHING ELSE GETS A TRANSFORM HERE. The face mask is a CHILD of root, so
    // it already inherits the letterbox scale and offset; setting them on it
    // again squared the scale and double-offset it, which showed up as the
    // painted wave ending in a hard rectangle partway across the frame.
  }

  // -- the frame ------------------------------------------------------------

  /**
   * Draw one frame from plain game state. This function reads; it never
   * mutates anything the simulation owns.
   */
  draw(state, alpha) {
    const { wave, player, hazards, pickups, seabird, zone, barrel } = state;
    const L = this.layers;

    this._rebuildMask(wave);
    this._drawBackground(state);
    this._drawWave(state);
    this._drawHazards(wave, hazards, seabird);
    this._drawPickups(wave, pickups);
    this._drawPlayer(state);
    this._drawLens(state);
    this._drawPayouts(wave);
    this.particles.draw();

    // The barrel REPLACES the face layers wholesale (§9.1's layer order) -- and
    // it has to close over the OUTSIDE WORLD too. §5.7 is "the lip closes over
    // the player": leaving the sky, the clouds and the sea stacks scrolling
    // along above the interior makes the section read as a filter over the same
    // wave rather than as being inside one. They dim to near-black instead, so
    // what is left above the tube's ceiling is darkness.
    const k = barrel.interiorMix;
    L.barrelGroup.alpha = k;
    L.faceGroup.alpha = 1 - k * 0.92;
    L.foam.alpha = 1 - k;
    const outside = 1 - k * 0.88;
    L.sky.alpha = outside;
    L.clouds.alpha = outside;
    L.stacks.alpha = outside;
    L.headland.alpha = outside;
  }

  _drawBackground(state) {
    const L = this.layers;
    const { wave, zone } = state;
    const d = wave.scrolled;

    L.skySprite.texture = this.tex(zone.current.sky);
    L.skyNext.texture = this.tex(zone.next.sky);
    L.skyNext.alpha = zone.mix;
    L.skySprite.x = -((d * PARALLAX.sky) % (DESIGN_W * 0.3));
    L.skyNext.x = L.skySprite.x;

    L.cloudBand.tilePosition.x = -d * PARALLAX.sky * 1.6;
    L.cloudBand.y = DESIGN_H * 0.02;

    // Zone tint, cross-faded. This is §9.6 rule 8's lever: generated water art
    // comes back hotter than the palette rule wants, and that is cheap to fix
    // at the layer container rather than by regenerating.
    const tint = lerpColor(zone.current.tint, zone.next.tint, zone.mix);
    L.sky.tint = tint;
    L.clouds.tint = tint;
    L.stacks.tint = tint;
    L.headland.tint = tint;

    // The additive sun wash, cross-faded on the same mix. This is the half of
    // the warmth pass that can actually ADD light rather than subtract it.
    if (L.sunWashSprite) {
      const a0 = zone.current.washAlpha ?? 0;
      const a1 = zone.next.washAlpha ?? 0;
      L.sunWashSprite.tint = lerpColor(zone.current.wash ?? 0xffffff, zone.next.wash ?? 0xffffff, zone.mix);
      L.sunWashSprite.alpha = a0 + (a1 - a0) * zone.mix;
    }

    this._placeProps(state);
  }

  /**
   * Zone props are parallax scenery, never collidable, and are placed so their
   * bounding box top can never rise above PROP_TOP_MIN_Y -- which is what keeps
   * them out of the top-of-frame HUD rects at every x. The report's one
   * explicit HUD criticism of the reference is a TOP RUN panel overlapping a
   * pier and a pelican (§5.1); this is where we do not repeat it.
   */
  _placeProps(state) {
    const { wave, zone } = state;
    const L = this.layers;
    const d = wave.scrolled;

    const ensure = (host, cache, count) => {
      while (cache.length < count) {
        const s = new Sprite(Texture.WHITE);
        s.anchor.set(0.5, 1);
        host.addChild(s);
        cache.push(s);
      }
      for (let i = count; i < cache.length; i++) cache[i].visible = false;
    };

    const z = zone.current;
    const stackCount = z.stacks.length ? 8 : 0;
    ensure(L.stacks, this._stackSprites, stackCount);
    const spanPx = DESIGN_W / Math.max(0.01, z.stackDensity || 0.3);
    for (let i = 0; i < stackCount; i++) {
      const s = this._stackSprites[i];
      const key = z.stacks[i % z.stacks.length];
      s.texture = this.tex(key);
      s.visible = !!z.stacks.length;
      const seed = hash01(i * 37 + zone.index * 101);
      const worldSlot = Math.floor((d * PARALLAX.stacks) / spanPx) + i;
      const x = worldSlot * spanPx - d * PARALLAX.stacks + seed * spanPx * 0.6;
      s.x = x;
      // Based on the CREST LINE at the prop's own x, so the horizon reads as
      // something the wave rises in front of rather than a row of rocks
      // floating at a fixed screen height.
      const crest = state.wave.crestY(Math.max(0, Math.min(1, x / DESIGN_W))) * DESIGN_H;
      const baseY = crest + DESIGN_H * (lerp(z.stackY[0], z.stackY[1], seed) - 0.27);
      s.y = baseY;
      const nat = s.texture.height || 200;
      const wantScale = lerp(z.stackScale[0], z.stackScale[1], seed) * (DESIGN_H * 0.22 / nat);
      // Clamp so the top edge never rises above PROP_TOP_MIN_Y.
      const maxH = baseY - PROP_TOP_MIN_Y * DESIGN_H;
      s.scale.set(Math.min(wantScale, maxH / nat));
    }

    const headCount = (z.headland && z.headland.length) ? 4 : 0;
    ensure(L.headland, this._propSprites, headCount);
    const hSpan = DESIGN_W / Math.max(0.01, z.headlandDensity || 0.2);
    for (let i = 0; i < headCount; i++) {
      const s = this._propSprites[i];
      s.texture = this.tex(z.headland[i % z.headland.length]);
      s.visible = true;
      const seed = hash01(i * 53 + zone.index * 211);
      const slot = Math.floor((d * PARALLAX.headland) / hSpan) + i;
      s.x = slot * hSpan - d * PARALLAX.headland + seed * hSpan * 0.4;
      const nat = s.texture.height || 240;
      if (z.skyBandCeiling != null) {
        // The overhang hangs from the TOP of the frame. It bottoms out at
        // skyBandCeiling and is scenery, never collidable (§5.9).
        s.anchor.set(0.5, 0);
        s.y = 0;
        s.scale.set((z.skyBandCeiling * DESIGN_H) / nat * 2.4);
      } else {
        s.anchor.set(0.5, 1);
        const crest = state.wave.crestY(Math.max(0, Math.min(1, s.x / DESIGN_W))) * DESIGN_H;
        const baseY = crest + DESIGN_H * (lerp(z.headlandY[0], z.headlandY[1], seed) - 0.30);
        s.y = baseY;
        const wantScale = lerp(z.headlandScale[0], z.headlandScale[1], seed) * (DESIGN_H * 0.20 / nat);
        const maxH = baseY - PROP_TOP_MIN_Y * DESIGN_H;
        s.scale.set(Math.min(wantScale, maxH / nat));
      }
    }
  }

  _drawWave(state) {
    const { wave, zone, barrel } = state;
    const L = this.layers;
    const d = wave.scrolled;

    // UV OFFSET, NOT A REDRAW (§9.1). The wave silhouette is static in screen
    // space; what moves is the texture under it.
    L.faceTile.tilePosition.x = -d * PARALLAX.face;
    L.streakTile.tilePosition.x = -d * PARALLAX.face * 0.92;
    L.troughTile.tilePosition.x = -d * PARALLAX.foam;
    L.troughTile.y = DESIGN_H * 0.80;

    const faceTint = lerpColor(zone.current.faceTint, zone.next.faceTint, zone.mix);
    L.faceGroup.tint = faceTint;

    L.barrelTile.tilePosition.x = -d * PARALLAX.face;
    L.kelpTile.tilePosition.x = -d * PARALLAX.foam;

    // Foam band rides the crest. It is a SEPARATE LAYER from the face texture
    // on purpose (§9.6 rule 5): it scrolls at a different rate and is tinted
    // per zone.
    L.foamTile.tilePosition.x = -d * PARALLAX.foam;
    L.foamTile.y = wave.crestY(0.5) * DESIGN_H - DESIGN_H * 0.045;

    // The lip wall: the LAUNCH RAMP, not a boundary and not a hazard (§5.1).
    // Scaled by height and pushed mostly off-frame to the left, so only the
    // curl itself shows and it never reaches the player column at x = 0.25 --
    // it draws above the player in the layer order, and a lip wall that covered
    // her would hide the one thing the player is reading.
    const lipTex = this.tex('wave-lip');
    L.lipWall.texture = lipTex;
    const lipScale = (DESIGN_H * 0.98) / (lipTex.height || 400);
    L.lipWall.scale.set(lipScale);
    L.lipWall.x = DESIGN_W * 0.19 - lipTex.width * lipScale;
    L.lipWall.y = wave.crestY(0.0) * DESIGN_H - DESIGN_H * 0.10;
    L.lipWall.alpha = 1 - barrel.interiorMix;
  }

  _drawHazards(wave, pool, seabird) {
    const L = this.layers;
    const seen = new Set();

    for (const e of pool.live) {
      let s = this._hazardSprites.get(e);
      if (!s) {
        s = new Sprite(Texture.WHITE);
        s.anchor.set(0.5, 0.5);
        L.hazards.addChild(s);
        this._hazardSprites.set(e, s);
      }
      seen.add(e);
      const key = 'hazard-' + (e.type === 'jellyfish' ? 'jellyfish' : e.type);
      s.texture = this.tex(key);
      if (this.isMissing(key)) s.tint = MISSING;
      const x = wave.screenX(e.worldX);
      s.x = x * DESIGN_W;
      s.y = wave.faceY(x, e.h) * DESIGN_H;
      const nat = s.texture.height || 120;
      // A hazard's drawn size follows its OCCUPIED BAND, so what you see is
      // what collides -- "no hazard is ever smaller than the player's sprite".
      const wantH = e.band * (wave.troughY(x) - wave.crestY(x)) * DESIGN_H * 1.35;
      const sc = wantH / nat;
      s.scale.set(e.type === 'timber' ? sc * 1.0 : sc, sc);
      if (e.type === 'timber') s.width = e.xHalf * 2;
      s.alpha = entityAlpha(x) * (e.type === 'puffer' && e.state === 'telegraph' ? 0.85 + 0.15 * Math.sin(e.t * 12) : 1);
      s.visible = s.alpha > 0.01;
      s.rotation = e.type === 'jellyfish' ? Math.sin(e.bob * 1.4) * 0.10 : 0;
    }

    for (const [e, s] of this._hazardSprites) {
      if (!seen.has(e)) { s.destroy(); this._hazardSprites.delete(e); }
    }

    // The alert bubble rides the one station-keeping puffer, if any.
    const puffer = pool.live.find((e) => e.type === 'puffer' && e.state === 'telegraph');
    const ab = L.alertBubble;
    ab.visible = !!puffer;
    if (puffer) {
      const x = wave.screenX(puffer.worldX);
      const pulse = 1 + Math.sin(puffer.t * 11) * 0.10;
      ab.x = x * DESIGN_W;
      ab.y = wave.faceY(x, puffer.h) * DESIGN_H - DESIGN_H * 0.13;
      ab.scale.set(pulse);
      L.alertBg.clear();
      L.alertBg.circle(0, 0, 42).fill({ color: 0xd8544c, alpha: 0.94 });
      L.alertBg.circle(0, 0, 42).stroke({ color: 0xffe9e6, width: 5, alpha: 0.95 });
      L.alertBg.moveTo(-14, 34).lineTo(14, 34).lineTo(0, 62).closePath().fill({ color: 0xd8544c, alpha: 0.94 });
    }

    // The seabird: scenery on the face, a target in the air.
    const bs = L.seabirdSprite;
    bs.visible = seabird.active;
    if (seabird.active) {
      const x = wave.screenX(seabird.worldX);
      bs.texture = this.tex('seabird');
      bs.x = x * DESIGN_W;
      bs.y = wave.faceY(x, seabird.h) * DESIGN_H;
      const nat = bs.texture.height || 100;
      bs.scale.set((DESIGN_H * 0.075) / nat);
      bs.rotation = seabird.hit ? seabird.hitT * 7 : Math.sin(seabird.phase) * 0.12;
      bs.alpha = entityAlpha(x);
    }
  }

  _drawPickups(wave, pool) {
    const L = this.layers;
    const seen = new Set();
    for (const p of pool.live) {
      let s = this._pickupSprites.get(p);
      if (!s) {
        s = new Sprite(Texture.WHITE);
        s.anchor.set(0.5, 0.5);
        L.pickups.addChild(s);
        this._pickupSprites.set(p, s);
      }
      seen.add(p);
      const key = p.kind === 'coin' ? 'pickup-coin' : 'pickup-orb';
      s.texture = this.tex(key);
      if (this.isMissing(key)) s.tint = MISSING;
      const x = wave.screenX(p.worldX);
      s.x = x * DESIGN_W;
      s.y = wave.faceY(x, p.h) * DESIGN_H;
      const nat = s.texture.height || 64;
      const base = (p.kind === 'coin' ? DESIGN_H * 0.055 : DESIGN_H * 0.062) / nat;
      // Coin spin and orb pulse are CODE OVER A STATIC TEXTURE -- no authored
      // animation frames anywhere in this game (§9.6 rule 3).
      const squash = p.kind === 'coin' ? Math.abs(Math.cos(p.spin)) * 0.85 + 0.15 : 1;
      const pulse = p.kind === 'orb' ? 1 + Math.sin(p.spin * 2) * 0.07 : 1;
      s.scale.set(base * squash * pulse, base * pulse);
      s.alpha = entityAlpha(x);
      s.visible = s.alpha > 0.01;
    }
    for (const [p, s] of this._pickupSprites) {
      if (!seen.has(p)) { s.destroy(); this._pickupSprites.delete(p); }
    }
  }

  _drawPlayer(state) {
    const { wave, player } = state;
    const s = this.layers.playerSprite;
    let key = 'wren-trim';
    if (player.state === 'airborne') key = 'wren-air';
    else if (player.state === 'tumbling') key = 'wren-tumble';
    else if (player.carve === 'climb') key = 'wren-climb';
    else if (player.carve === 'drop') key = 'wren-drop';
    s.texture = this.tex(key);
    if (this.isMissing(key)) s.tint = MISSING;

    const x = player.screenX;
    s.x = x * DESIGN_W;
    if (player.state === 'airborne') {
      s.y = player.screenY * DESIGN_H;
      s.rotation = (player.spinDeg * Math.PI) / 180;
    } else if (player.state === 'tumbling') {
      s.y = wave.faceY(x, player.h) * DESIGN_H;
      s.rotation = player.tumbleT * 9;
    } else {
      s.y = wave.faceY(x, player.h) * DESIGN_H;
      // The carve animation is the mapping's tutorial: she leans INTO the
      // direction she is going, so lean-left-climbs is self-teaching (§0.2).
      s.rotation = -player.lean * 0.22;
    }
    const nat = s.texture.height || 220;
    s.scale.set((DESIGN_H * 0.20) / nat);
    // A brief shimmer while immune, so the grace window is visible (§5.4).
    s.alpha = player.immunity > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(player.immunity * 18)) : 1;
  }

  /**
   * The airborne lens (§5.4, §7.2) -- a large translucent bubble with a soft
   * rim that dims the background. The reference's very clean way of saying
   * "something special is happening" without a full-screen flash.
   */
  _drawLens(state) {
    const { player } = state;
    const L = this.layers;
    const on = player.state === 'airborne';
    const target = on ? 0.30 : 0;
    L.lensDim.alpha += (target - L.lensDim.alpha) * 0.18;

    L.lensRing.clear();
    if (L.lensDim.alpha < 0.01) return;
    const cx = player.screenX * DESIGN_W;
    const cy = player.screenY * DESIGN_H;
    const r = DESIGN_H * 0.19;
    const a = L.lensDim.alpha / 0.30;
    // Punch the lens out of the dim by drawing the bubble over it, then a rim.
    L.lensRing.circle(cx, cy, r).fill({ color: 0xcfe6f2, alpha: 0.16 * a });
    L.lensRing.circle(cx, cy, r).stroke({ color: 0xeaf6ff, width: 5, alpha: 0.55 * a });
    L.lensRing.circle(cx, cy, r * 0.82).stroke({ color: 0xffffff, width: 2, alpha: 0.22 * a });
  }

  // -- world-space payout numerals (§5.4, §7.1) -----------------------------

  /** Big chunky slab numerals with a soft glow, floating under the surfer. */
  addPayout(worldX, h, text, big = true) {
    const t = new Text({
      text,
      style: {
        fontFamily: 'Rockwell, "Roboto Slab", Georgia, serif',
        fontSize: big ? 120 : 46,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x27405e, width: big ? 10 : 5 },
        dropShadow: { color: 0xbfe4ff, blur: big ? 22 : 8, distance: 0, alpha: 0.9 },
      },
    });
    t.anchor.set(0.5, 0.5);
    this.layers.payouts.addChild(t);
    const rec = { t, worldX, h, life: big ? 1.9 : 0.9, age: 0, big };
    if (big) this._payouts.push(rec);
    else {
      this._coinPops.push(rec);
      // Capped so coin pops never become a second visual layer (§7.1).
      while (this._coinPops.length > COIN_POP_CAP) {
        const old = this._coinPops.shift();
        old.t.destroy();
      }
    }
  }

  _drawPayouts(wave) {
    for (const list of [this._payouts, this._coinPops]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += 1 / 60;
        const k = p.age / p.life;
        if (k >= 1) { p.t.destroy(); list.splice(i, 1); continue; }
        const x = wave.screenX(p.worldX);
        p.t.x = x * DESIGN_W;
        p.t.y = wave.faceY(x, p.h) * DESIGN_H + (p.big ? 96 : 0) - k * (p.big ? 90 : 54);
        p.t.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        p.t.scale.set(p.big ? 1 + Math.min(0.12, k * 0.6) : 1);
      }
    }
  }

  clearTransients() {
    for (const list of [this._payouts, this._coinPops]) {
      for (const p of list) p.t.destroy();
      list.length = 0;
    }
    this.particles.clear();
  }

  render() {
    this.app.renderer.render(this.app.stage);
  }
}

// ---------------------------------------------------------------------------

/**
 * Entities fade out before they reach the left-edge multiplier slots, so no
 * in-world object is ever drawn behind a HUD-exclusion rect (§5.1). By then
 * they are inside the lip wall's whitewater anyway.
 */
function entityAlpha(x) {
  if (x >= ENTITY_FADE.start) return 1;
  if (x <= ENTITY_FADE.end) return 0;
  return (x - ENTITY_FADE.end) / (ENTITY_FADE.start - ENTITY_FADE.end);
}

/**
 * Map a tiling texture's own height onto a band of the frame, so a 4096x1024
 * painting reads as ONE painted band rather than tiling vertically as well as
 * horizontally. Horizontal tiling -- the scroll -- is left at 1:1 so the
 * seam-verified 4096 px period is exactly what ships (§9.6 rule 4).
 */
function fitTileVertically(tile, topPx, bandPx) {
  const th = tile.texture.height || 1;
  tile.tileScale.y = bandPx / th;
  tile.tilePosition.y = 0;
  tile.y = topPx;
  tile.height = bandPx;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (((ar + (br - ar) * t) | 0) << 16) | (((ag + (bg - ag) * t) | 0) << 8) | ((ab + (bb - ab) * t) | 0);
}

function hash01(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
