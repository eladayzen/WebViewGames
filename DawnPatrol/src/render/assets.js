// The art manifest (§9.6).
//
// Every texture the game uses, in one place, so the art pass is a checklist
// rather than a grep. Names here are the asset file's basename under
// /public/assets/.
//
// PLACEHOLDERS ARE LOUD ON PURPOSE. A missing texture renders as a flat magenta
// swatch, not as something that could be mistaken for art -- the standing rule
// for this repo is that environment surfaces must be real illustrated art, and
// the failure mode to avoid is a procedural stand-in quietly shipping (§9.1,
// the Astro_Tunnel / TmntSewerSlide anti-pattern).

export const ASSET_MANIFEST = {
  // Opaque textures ship as JPEG and anything with alpha as PNG. The face
  // alone is 6 MB lossless and ~900 KB at quality 90, and this loads over a
  // local HTTP server into a mobile WebView (GOBALANCE_SDK.md).
  //
  // -- the wave itself (§9.1: a painting, not a shader) --------------------
  'wave-face': 'assets/wave-face.jpg',            // tiles horizontally
  'wave-streaks': 'assets/wave-streaks.jpg',      // sunlight streaks, separate layer
  'wave-foam': 'assets/wave-foam.png',            // crest foam band, separate layer
  'wave-trough': 'assets/wave-trough.jpg',        // trough wash, separate layer
  'wave-lip': 'assets/wave-lip.png',              // the curling lip wall at the left edge

  // -- the barrel interior --------------------------------------------------
  'barrel-interior': 'assets/barrel-interior.jpg',
  'barrel-kelp': 'assets/barrel-kelp.png',

  // -- player (§9.6 rule 1: generated as ONE multi-panel batch) -------------
  'wren-trim': 'assets/wren-trim.png',
  'wren-climb': 'assets/wren-climb.png',
  'wren-drop': 'assets/wren-drop.png',
  'wren-air': 'assets/wren-air.png',
  'wren-tumble': 'assets/wren-tumble.png',

  // -- hazards (§9.6 rule 6: one batch, one value slot) --------------------
  'hazard-jellyfish': 'assets/hazard-jellyfish.png',
  'hazard-rock': 'assets/hazard-rock.png',
  'hazard-timber': 'assets/hazard-timber.png',
  'hazard-puffer': 'assets/hazard-puffer.png',
  'seabird': 'assets/seabird.png',

  // -- pickups --------------------------------------------------------------
  'pickup-coin': 'assets/pickup-coin.png',
  'pickup-orb': 'assets/pickup-orb.png',

  // -- sky and zone props ---------------------------------------------------
  'zone-open-sea-sky': 'assets/zone-open-sea-sky.jpg',
  'zone-overhang-sky': 'assets/zone-overhang-sky.jpg',
  'clouds': 'assets/clouds.png',
  'prop-sea-stack-a': 'assets/prop-sea-stack-a.png',
  'prop-sea-stack-b': 'assets/prop-sea-stack-b.png',
  'prop-sea-stack-c': 'assets/prop-sea-stack-c.png',
  'prop-rock-arch': 'assets/prop-rock-arch.png',
  'prop-pier': 'assets/prop-pier.png',
  'prop-islet': 'assets/prop-islet.png',
  'prop-overhang': 'assets/prop-overhang.png',

  // -- particles ------------------------------------------------------------
  'fx-spray': 'assets/fx-spray.png',
  'fx-foam': 'assets/fx-foam.png',
  'fx-bubble': 'assets/fx-bubble.png',

  // -- crew portraits (§9.6 rule 7: one batch, no coral) -------------------
  'crew-birdie': 'assets/crew-birdie.png',
  'crew-otto': 'assets/crew-otto.png',
  'crew-marisol': 'assets/crew-marisol.png',
  'crew-ghost': 'assets/crew-ghost.png',
  'crew-oldsal': 'assets/crew-oldsal.png',
};

/** Textures that must tile seamlessly in x (§9.6 rule 4, §12's flagged risk). */
export const TILING_ASSETS = [
  'wave-face', 'wave-streaks', 'wave-foam', 'wave-trough',
  'barrel-interior', 'clouds',
];
