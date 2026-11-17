// WHICH BONES BELONG TO THE THROW, AND HOW MUCH.
//
// Two layers: the legs keep walking while the arms throw. three.js has no
// concept of an animation layer or a bone mask, so this builds one the only
// way the mixer allows -- by SPLITTING EACH CLIP INTO SUB-CLIPS that carry
// only some of its tracks. A sub-clip with no leg tracks cannot move a leg,
// whatever weight it is given.
//
// WHY WEIGHTS AND NOT A BOOLEAN. A hard line at the waist makes the hips
// follow the walk while the spine directly above them follows the throw, and
// the join reads as a break. Grading the three spine bones (0.5, 0.75, 1.0)
// lets the torso twist most of the way into the throw while still carrying
// some of the walk's sway, which is what a body does. Everything above the
// spine is the throw's outright; everything from the hips down is the walk's
// outright.
//
// THE FALLBACK IS THE WALK, by construction. The throw contributes `w x mask`
// and the locomotion contributes `1 - w x mask`, in every bucket. With no
// throw playing, w is 0, and the walk drives every bone at full strength --
// which is the behaviour asked for, and it is arithmetic rather than a
// special case that could be forgotten.

/** Mask weight per bone: 0 = the walk owns it, 1 = the throw owns it. */
export const MASK_RULES = [
  // The walk's, outright.
  [/^mixamorigHips$/, 0],
  [/^mixamorig(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End)$/, 0],
  // The join, graded so the waist does not read as a break.
  [/^mixamorigSpine$/, 0.5],
  [/^mixamorigSpine1$/, 0.75],
  [/^mixamorigSpine2$/, 1],
  // The throw's, outright.
  [/^mixamorig(Neck|Head|HeadTop_End)$/, 1],
  [/^mixamorig(Left|Right)(Shoulder|Arm|ForeArm)$/, 1],
  [/^mixamorig(Left|Right)Hand([A-Za-z]+[0-9]*)?$/, 1],
];

/**
 * The mask weight for one bone, or null if no rule claims it.
 *
 * NULL RATHER THAN A DEFAULT. A bone nobody classified is a rig that changed,
 * and quietly defaulting it either freezes a limb or hands it to the throw --
 * both of which look like a different bug entirely. test/mask.test.mjs asserts
 * that every bone in the shipped clips is claimed, so this returning null is a
 * red test rather than a mystery on a board.
 */
export function maskFor(bone) {
  for (const [re, w] of MASK_RULES) if (re.test(bone)) return w;
  return null;
}

/** The bone a track drives: `mixamorigSpine.quaternion` -> `mixamorigSpine`. */
export function boneOf(trackName) {
  const i = trackName.indexOf('.');
  return i < 0 ? trackName : trackName.slice(0, i);
}

/**
 * Group bones by mask weight.
 *
 * One bucket per DISTINCT weight, derived from the rules rather than fixed at
 * two, so changing the spine grading above needs no change here. Each bucket
 * becomes one sub-clip per animation and one action per sub-clip.
 */
export function bucketize(bones) {
  const byWeight = new Map();
  for (const b of bones) {
    const w = maskFor(b);
    if (w === null) continue;
    if (!byWeight.has(w)) byWeight.set(w, new Set());
    byWeight.get(w).add(b);
  }
  return [...byWeight.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, set]) => ({ m, bones: set }));
}

/** Every bone mentioned by any clip in a clips.json payload. */
export function bonesIn(data) {
  const out = new Set();
  for (const clip of Object.values(data)) {
    for (const t of clip.tracks || []) out.add(boneOf(t.name));
  }
  return out;
}

/**
 * A copy of a clip carrying only the tracks for `bones`.
 *
 * A FRESH UUID IS NOT OPTIONAL. AnimationMixer caches actions by clip uuid, so
 * four sub-clips sharing their parent's uuid would all resolve to the same
 * action and three of the four layers would silently do nothing.
 */
export function sliceClip(json, bones, tag) {
  return {
    ...json,
    uuid: `${json.uuid}#${tag}`,
    name: `${json.name}#${tag}`,
    tracks: (json.tracks || []).filter((t) => bones.has(boneOf(t.name))),
  };
}
