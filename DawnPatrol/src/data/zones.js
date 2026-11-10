// The five set-dressing zones (§5.9).
//
// They cycle in order along the ONE continuous track, forever. No load break,
// no level transition, no loading screen, no pause in the scroll.
//
// ZONES CHANGE THE BACKGROUND, PROP AND LIGHTING LAYERS ONLY. They never change
// the face rail, the hazard rules, the gap floor, the scroll speed or the spawn
// tables -- difficulty is authored entirely independently of set dressing
// (§5.10). That separation is what makes Post-MVP zones pure content rather
// than code.
//
// `tint` values are multiplied onto the layer containers at runtime (§9.1's "no
// custom shaders"; §9.6 rule 8's "bring anything too hot into the readability
// band with a tint, not a regeneration").
//
// WARMTH PASS. Amit on a playtest build: "most of the frame is super grey
// colored... the game feels dark instead of happy." Measured, the shipped art
// is genuinely desaturated (median saturation 0.079 across 37 assets), and the
// tints here were making it worse -- two zones were actively COOL (rock-arch
// 0xf2f3f8, rock-overhang 0xc9d3e6). They are now a warm dawn ramp.
//
// RESULT OF THE TINT-ONLY PASS, measured on a real frame: hue moved 214deg ->
// 33deg (cool to warm, as intended) but saturation stayed flat at ~0.155 and
// brightness FELL 0.594 -> 0.526. Warm multiply over grey gives brown, not
// gold. So the multiply tints below are now only a gentle warm bias, and the
// actual warmth and light come from the ADDITIVE sun wash (`wash` /
// `washAlpha`, see renderer._buildSunWash) -- additive can raise luminance and
// saturation, which multiply structurally cannot.
//
// `wash` is the colour of the light added; `washAlpha` how much of it. Turn
// washAlpha to 0 across all five zones to switch the whole effect off.
//
// KNOW THE CEILING OF THIS LEVER: Pixi tint MULTIPLIES. It can pull the blue
// channel down so neutral greys read golden, but it can never add brightness
// or put saturation back into the teal face. Warmth therefore costs a little
// luminance. If this reads muddy rather than sunny, the tint route is exhausted
// and the answer is regenerating the sky/face/trough/cloud set on a warmer
// brief -- not pushing these values further.

export const ZONES = [
  {
    id: 'open-sea',
    name: 'OPEN SEA',
    sky: 'zone-open-sea-sky',
    stacks: ['prop-sea-stack-a', 'prop-sea-stack-b'],
    headland: [],
    // Prop BASES sit just below the crest line, so they read as a horizon the
    // wave rises in front of. Their tops are clamped in code so a prop's
    // bounding box can never rise above PROP_TOP_MIN_Y at any x, which is what
    // keeps them out of the top-of-frame HUD rects as they scroll through every
    // x (§5.1). The validator checks the constant; the renderer enforces the
    // per-prop clamp.
    stackY: [0.27, 0.32],
    stackScale: [0.75, 1.15],
    stackDensity: 1.6,        // props per screen-width of scroll
    tint: 0xfff0dc,
    faceTint: 0xfff6ea,
    wash: 0xffb257,
    washAlpha: 0.30,
    skyBandCeiling: null,     // no overhang
  },
  {
    id: 'rock-arch',
    name: 'ROCK ARCH',
    sky: 'zone-open-sea-sky',
    stacks: ['prop-sea-stack-a', 'prop-sea-stack-b', 'prop-sea-stack-c'],
    headland: ['prop-rock-arch'],
    stackY: [0.27, 0.33],
    stackScale: [0.6, 1.15],
    stackDensity: 2.2,
    headlandY: [0.30, 0.34],
    headlandScale: [1.0, 1.0],
    headlandDensity: 0.7,
    tint: 0xffecd2,
    faceTint: 0xfff3e2,
    wash: 0xff9e46,
    washAlpha: 0.34,
    skyBandCeiling: null,
  },
  {
    id: 'driftwood-pier',
    name: 'DRIFTWOOD PIER',
    sky: 'zone-open-sea-sky',
    stacks: ['prop-sea-stack-b'],
    headland: ['prop-pier'],
    stackY: [0.28, 0.32],
    stackScale: [0.5, 0.8],
    stackDensity: 1.3,
    // The pier extends into frame from above right. It is scenery and is NEVER
    // collidable -- nothing in this game collides except face hazards (§5.9).
    headlandY: [0.29, 0.29],
    headlandScale: [1.0, 1.0],
    headlandDensity: 0.8,
    tint: 0xfff2e0,
    faceTint: 0xfff8ee,
    wash: 0xffc062,
    washAlpha: 0.28,
    skyBandCeiling: null,
  },
  {
    id: 'tide-pool-islet',
    name: 'TIDE-POOL ISLET',
    sky: 'zone-open-sea-sky',
    stacks: ['prop-sea-stack-a'],
    headland: ['prop-islet'],
    stackY: [0.28, 0.32],
    stackScale: [0.45, 0.75],
    stackDensity: 1.2,
    headlandY: [0.31, 0.33],
    headlandScale: [0.9, 1.1],
    headlandDensity: 0.8,
    tint: 0xfffaea,
    faceTint: 0xfefcf2,
    wash: 0xffd884,
    washAlpha: 0.24,
    skyBandCeiling: null,
  },
  {
    id: 'rock-overhang',
    name: 'ROCK OVERHANG',
    sky: 'zone-overhang-sky',
    stacks: [],
    headland: ['prop-overhang'],
    stackY: [0.28, 0.32],
    stackScale: [0.5, 0.7],
    stackDensity: 0,
    headlandY: [0.0, 0.0],
    headlandScale: [1.0, 1.0],
    headlandDensity: 1.0,
    // The one zone that visibly changes the sky band: the light goes cool.
    tint: 0xf6e2cc,
    faceTint: 0xfaead8,
    wash: 0xff8f3c,
    washAlpha: 0.20,
    // §5.9: the ceiling silhouette bottoms out at y = 0.04 so it never intrudes
    // into the airborne arc's peak at y = 0.06. Scenery, never collidable.
    //
    // DOC TENSION, RESOLVED DELIBERATELY: §5.1 says no in-world object may pass
    // behind a HUD-exclusion rect, and a full-width ceiling at y 0..0.04
    // unavoidably passes behind both top rects. §5.9 authors that geometry
    // directly, though, and the rule it is protecting is about TRACKABLE
    // objects -- the report's complaint was a pier and a pelican disappearing
    // behind the TOP RUN panel, not a frame-wide band of scenery at the very
    // top edge. This flag marks the carve-out explicitly so it is a decision
    // rather than an oversight; the validator knows about it.
    fullWidthCeiling: true,
    skyBandCeiling: 0.04,
  },
];
