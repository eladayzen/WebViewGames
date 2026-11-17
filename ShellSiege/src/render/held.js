// THE SAI HE IS ACTUALLY HOLDING.
//
// Until now the weapon existed only once it had left him: a blade appeared out
// of nowhere at the moment of release and vanished when it was caught. That
// reads as a magic trick rather than as a ninja, and it is the one thing that
// makes a throw-and-return weapon feel like it belongs to the character --
// Elad: "would be nice if i could see the daggers in is hands while they are
// not flying out."
//
// WHAT HIDES A BLADE IS THE THROW, NOT THE BULLET COUNT -- and the first cut
// got this wrong in a way worth recording, because the wrong version is the
// one that sounds more principled.
//
// The obvious rule is "he carries two, so hide one blade per bullet in the
// air": it reads the simulation, it can never disagree with the screen, and it
// needs no timer. It also makes him empty-handed essentially all the time. He
// throws every 0.55s and a blade's round trip is about as long, so two or more
// are in flight almost continuously -- which produced a character holding
// nothing, which is the exact opposite of what was asked for.
//
// The fix is to stop modelling an ammo count the game does not have. The
// combat system fires an unlimited stream; two blades in his fists are the
// FANTASY, not the inventory. So: both are visible, and the right one -- the
// hand the throw animation swings and the hand the muzzle is measured from --
// disappears at the moment of release and is back when the throw animation
// ends, about a third of a second later. The eye gets the one beat it actually
// needs, which is seeing the blade leave him.
//
// PARENTED TO THE BONE, NOT FOLLOWED EACH FRAME. A mesh added as a child of
// the hand bone inherits the skinned pose for free and cannot lag it, which a
// per-frame copy of the bone's world matrix always can by exactly one frame.
//
// THE SCALE HAS TO BE DIVIDED OUT. The hand bone sits under the glb's own root
// scale and then under the rig's `scaler`, so a child of it is multiplied by
// both. Asking for "the same size as the flying sai" therefore means dividing
// the world size by the bone's world scale -- the same class of mistake as the
// femur that measured 36 units on a 1.55-unit character.
//
// IT ROLLS ABOUT ITS OWN LENGTH TO FACE THE CAMERA. A blade drawn as a flat
// quad has a side and an edge, and the hand turns through the whole walk
// cycle, so for a good part of every stride the camera was looking straight
// down the edge and the weapon became a one-pixel sliver -- present, correct,
// and invisible, which is the one outcome this whole file exists to avoid.
// Each frame the quad is rolled around the blade axis by the angle that turns
// its face toward the camera. The blade still points wherever the fist points
// -- only the roll is taken, so it never looks like a sprite that has detached
// from the hand. ?heldbill=0 turns it off.
//
//   ?held=0|1       off / on            ?heldsize=0.5   x the flying blade
//   ?heldbill=0|1   axis billboarding   ?heldgrip=0.13  where the fist closes
//   ?heldrx/ry/rz   degrees, in bone space
//   ?heldx/y/z      offset, in bone-local units
import * as THREE from 'three';
import { WEAPON } from '../core/weapon.js';
import { THROW, THROW_SPAN } from '../core/throwing.js';
import { u } from './units.js';
import { makeFist } from './fist.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};
const rad = (d) => (d * Math.PI) / 180;

export const HELD = {
  on: QS.get('held') !== '0',
  // SMALLER THAN THE ONE IN THE AIR, and that is deliberate rather than sloppy.
  // The flying blade is sized to be legible as it crosses a cluttered floor at
  // 2.6x speed; at that size in his fist it is 0.73 of his own height, which
  // is a sword. A real sai is about 0.3 of its owner; half the flying blade
  // puts it at 0.37 of his height, which clears his shell when the arm hangs.
  // ?heldsize= scales it. Turning it the other way round (?heldry=180, blade
  // out past the pinky in a reverse grip) buries both blades inside the body
  // mesh -- measured, not guessed: they stay visible and stay at the hands,
  // they are simply inside him.
  size: num('heldsize', 0.5),
  // MEASURED, not guessed. Both finger chains leave the hand bone along local
  // (+-0.25, 0.97, 0) and the thumb along (0.63, 0.71, 0.33), so in the hand's
  // own space +Y runs down the fingers and the thumb side is +X. A weapon held
  // in a FIST does not point along the fingers -- the fingers curl around it --
  // it runs through the tunnel they make, across the palm, which is the X axis.
  // The first cut had it along +Y and the blade ran straight through his chest.
  rot: [rad(num('heldrx', 0)), rad(num('heldry', 0)), rad(num('heldrz', 0))],
  off: [num('heldx', 0), num('heldy', 0), num('heldz', 0)],
  billboard: QS.get('heldbill') !== '0',
};

// Where along the art the hand actually closes, as a fraction of the image
// width from the pommel end. The sai is drawn handle-left, blade-right, and a
// PlaneGeometry is centred on its middle -- so without this the fist grips the
// blade halfway up and a third of the handle sticks out the back of his wrist.
const GRIP = num('heldgrip', 0.13);

/**
 * Put a blade in each hand.
 * @param rig   the loaded rig (needs `bones`)
 * @param tex   { sai, shuriken } -- the same art the projectiles use
 */
export function createHeld(rig, tex, camera) {
  const art = WEAPON.name === 'sai' ? tex.sai : tex.shuriken;
  art.colorSpace = THREE.SRGBColorSpace;

  const held = [];
  const fists = [];
  if (!HELD.on) return { held, fists, sync() {} };

  // Move the art so the GRIP sits on the origin, rather than moving the mesh
  // afterwards: every rotation below then turns the blade about the point the
  // hand is actually holding, which is the only pivot that stays put when the
  // wrist moves.
  const geo = new THREE.PlaneGeometry(WEAPON.aspect, 1);
  geo.translate(WEAPON.aspect * (0.5 - GRIP), 0, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: art, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    // Lit would be correct and is wrong here: these are a few pixels across
    // and the hand shadows them for most of the walk cycle, so a lit quad
    // spends half its life as a black smear. Unlit keeps them readable, which
    // is the entire point of drawing them.
    fog: false,
  });

  const world = new THREE.Vector3();
  for (const boneName of ['mixamorigRightHand', 'mixamorigLeftHand']) {
    const bone = rig.bones?.[boneName];
    if (!bone) continue;
    bone.getWorldScale(world);
    const s = (u(WEAPON.sizePx) * HELD.size) / (world.x || 1);
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(s);
    m.rotation.set(HELD.rot[0], HELD.rot[1], HELD.rot[2]);
    m.position.set(HELD.off[0] / (world.x || 1), HELD.off[1] / (world.x || 1), HELD.off[2] / (world.x || 1));
    m.frustumCulled = false;
    bone.add(m);
    held.push(m);
    fists.push(makeFist(rig.bones, boneName.includes('Right') ? 'Right' : 'Left'));
  }

  const _cam = new THREE.Vector3();

  /** Empty the right hand from the release frame to the end of the throw. */
  function sync(rigState = rig) {
    const t = rigState.throwPhase();
    const gone = t >= THROW.preS && t < THROW_SPAN;
    if (held[0]) held[0].visible = !gone;   // right -- the throwing hand
    if (held[1]) held[1].visible = true;    // left  -- never thrown from

    // THE FIST GOES ON AFTER THE MIXER HAS WRITTEN THE FRAME, which is why it
    // lives in sync() and not in the rig's own update(): main.js runs the rig
    // first, so by the time we get here the clip's hand pose is on the bones
    // and can be composed with rather than fought.
    //
    // Only a hand that is holding something closes, so the throwing hand opens
    // on the release frame without a line of code saying so.
    for (let i = 0; i < held.length; i++) {
      if (held[i].visible) fists[i]?.(1);
    }

    if (!HELD.billboard || !camera) return;
    for (const m of held) {
      if (!m.visible) continue;
      // The camera, in the BONE's own space. The blade sits at the bone, so
      // this doubles as the direction from the blade to the eye.
      m.parent.worldToLocal(_cam.copy(camera.position));
      // Rolling by theta about local X turns the quad's normal, (0,0,1), to
      // (0, -sin, cos). Point that at the camera's y/z component -- the x
      // component is along the blade and no roll can ever face it.
      m.rotation.x = Math.atan2(-_cam.y, _cam.z) + HELD.rot[0];
    }
  }

  return { held, fists, sync };
}
