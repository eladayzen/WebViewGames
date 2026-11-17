// CLOSING HIS FINGERS ROUND THE BLADE.
//
// The hand pose comes from the animation clip, and the clips were auditioned
// for the body: an idle and a walk both leave the fingers wherever the Mixamo
// take left them, which is loosely open. Put a weapon in that hand and he is
// holding it the way you hold a wine glass. Elad: "could you close his hands?
// (fingers) into a fist when its in his hands".
//
// COMPOSED ONTO THE ANIMATED POSE, NOT ASSIGNED OVER IT. Every bone here gets
// `quaternion.multiply(curl)`, which is a rotation in the bone's OWN frame
// applied after whatever the clip wrote. Assigning an absolute rotation
// instead would have to know each bone's bind orientation -- Mixamo's are not
// identity and are not even consistent down one finger -- and would freeze the
// fingers, so a later clip that opens a hand deliberately could not. Because
// the mixer rewrites every bone from the clip at the top of each frame, this
// multiply is applied fresh each frame and can never accumulate.
//
// THE FLEXION AXIS IS DERIVED FROM THE SKELETON ONCE, IN THE BIND POSE, and
// the reason is the whole story of this file.
//
// The first version rotated every phalanx about its own local X. That is a
// reasonable guess -- the child of each finger bone sits at local (0, 1, 0), so
// the bone runs along +Y and flexion has to be about X or Z -- and it is
// wrong, in a way that does not look like a bug. Measured on the shipped rig,
// the commanded 52 + 80 + 52 degrees of curl produced a fingertip that had
// moved 17 degrees: the first phalanx came out at +105 degrees about X and the
// second at -87 about X, because each bone's BIND orientation differs, so one
// bone's local X is another bone's local -X. The fingers closed and opened
// against each other and the hand stayed flat. A guessed axis that is right for
// one bone in a chain is the worst case, because the hand still moves.
//
// So the axis is measured instead, in world space, from the hand itself:
//
//   f = across the hand, wrist -> middle knuckle   (the fingers' direction)
//   a = across the knuckles,  middle -> index
//   n = f x a, flipped if it disagrees with the thumb -- the PALM side
//
// A finger flexes about the across-the-knuckles axis `a`, and Rodrigues says
// rotating f about a by +theta moves the tip toward a x f, which is -n -- the
// back of the hand. So the axis is -a, and then every phalanx in both hands
// turns the same way in the world however its own bind frame is oriented.
// That world axis is pulled back into each bone's own frame, because
// `quaternion.multiply` composes in the bone's frame, not the parent's.
//
// AND IT IS DONE ONCE, NOT EVERY FRAME. The version before this re-derived the
// axis from the live skeleton on every call, which sounds more careful and is
// the actual bug: by the time it looked, the pose it was measuring ALREADY
// CONTAINED the curl it was about to apply, so the palm normal it read came
// from a half-closed hand and the thumb test could flip. Measured on the rig,
// one application added 21 degrees and a second TOOK 35 BACK -- the fingers
// oscillated instead of closing.
//
// A bone's anatomical flexion axis is fixed in that bone's own frame. The
// bone's frame turns with the animation, so an axis stored in it stays correct
// for free, and nothing has to be measured again. This also means `makeFist`
// must be called while the model is still in its bind pose -- main.js builds
// the held weapons straight after `loadRig` and before `loadClips`.
//
// IT RUNS AFTER THE MIXER AND ONLY ON A HAND THAT IS HOLDING SOMETHING, which
// means the throwing hand OPENS on the release frame for free -- the blade
// leaves and the fist relaxes in the same instant, which is the one beat the
// eye wants out of a throw.
//
//   ?fist=0|1    off / on
//   ?fistamt=1   scales every angle; 0 is the clip's own pose
//   ?fistsign=1|-1   flips the curl, if a rig ever disagrees about its thumb
import * as THREE from 'three';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};
const rad = (d) => (d * Math.PI) / 180;

export const FIST = {
  on: QS.get('fist') !== '0',
  amount: num('fistamt', 1),
  sign: num('fistsign', 1),
};

// Degrees per phalanx, proximal -> distal. The middle joint carries the most,
// because that is what a closed hand does: the knuckle sets the direction and
// the middle joint does the gripping.
export const CURL = {
  Index:  [52, 78, 50],
  Middle: [55, 80, 52],
  Ring:   [55, 80, 52],
  Pinky:  [52, 78, 50],
  // The thumb crosses the others rather than curling with them, so it takes
  // much less; a straight 80 degrees on it drives it through the fingers.
  Thumb:  [22, 34, 30],
};

/**
 * Build a curler for one hand.
 * @param bones  the rig's bone map
 * @param side   'Right' | 'Left'
 * @returns      a function(amount) that closes that hand, or null if the glb
 *               has no finger bones on that side at all.
 */
export function makeFist(bones, side) {
  const P = (n) => bones[`mixamorig${side}Hand${n}`];
  const hand = bones[`mixamorig${side}Hand`];
  const knuckleM = P('Middle1') || P('Index1');
  const knuckleI = P('Index1') || P('Middle1');
  const thumb = P('Thumb1');

  const chain = [];
  for (const [finger, degs] of Object.entries(CURL)) {
    for (let i = 0; i < degs.length; i++) {
      const bone = P(`${finger}${i + 1}`);
      // Not every rig carries all five fingers -- this glb has three. A
      // missing bone is normal, not an error; skip it silently.
      if (!bone) continue;
      chain.push({ bone, angle: rad(degs[i]) * FIST.sign });
    }
  }
  if (!chain.length || !hand || !knuckleM || knuckleM === knuckleI) return null;

  // --- derived ONCE, from the bind pose (see the header).
  hand.updateWorldMatrix(true, true);
  const wHand = hand.getWorldPosition(new THREE.Vector3());
  const wMid = knuckleM.getWorldPosition(new THREE.Vector3());
  const wIdx = knuckleI.getWorldPosition(new THREE.Vector3());

  const f = wMid.clone().sub(wHand).normalize();          // along the fingers
  const a = wIdx.clone().sub(wMid).normalize();           // across the knuckles
  // The knuckles are not square to the fingers -- measured f.a = -0.24 on this
  // rig -- and the component of `a` that lies along `f` is a TWIST, not a
  // flexion. Taking it out is what makes the commanded angle the delivered one.
  a.addScaledVector(f, -a.dot(f)).normalize();

  const n = new THREE.Vector3().crossVectors(f, a).normalize();   // palm, sign TBD
  if (thumb) {
    // The thumb sits on the palm side; if the cross product disagreed, the
    // hand is the other chirality and the normal is simply flipped.
    const wThumb = thumb.getWorldPosition(new THREE.Vector3()).sub(wHand);
    if (n.dot(wThumb) < 0) n.negate();
  }
  // Flex toward the palm: we need a x f to point along +n.
  if (n.dot(new THREE.Vector3().crossVectors(a, f)) < 0) a.negate();

  const inv = new THREE.Matrix4();
  for (const e of chain) {
    e.bone.updateWorldMatrix(true, false);
    inv.extractRotation(e.bone.matrixWorld).invert();
    e.axis = a.clone().applyMatrix4(inv).normalize();
  }

  const q = new THREE.Quaternion();

  return function close(amount = 1) {
    const amt = amount * FIST.amount;
    if (!FIST.on || amt === 0) return;
    for (const e of chain) {
      q.setFromAxisAngle(e.axis, e.angle * amt);
      e.bone.quaternion.multiply(q);
    }
  };
}

/** How many phalanges a side actually has, for tests and for the HUD. */
export function fingerBoneCount(bones, side) {
  let n = 0;
  for (const [finger, degs] of Object.entries(CURL)) {
    for (let i = 0; i < degs.length; i++) {
      if (bones[`mixamorig${side}Hand${finger}${i + 1}`]) n++;
    }
  }
  return n;
}
