import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { laneToX, CENTER_LANE } from '../track/lanes';
import { createToonMaterial } from '../core/toonMaterial';
import { createShellTexture } from '../core/proceduralTextures';

// Best achievable "asset" for the player without an external art pipeline or
// image/3D-generation tool: a sculpted multi-part primitive composition
// (torso, domed/textured shell, head, mask + tails, belt, back-sheathed
// sword hilts, swinging limbs) shaded with the custom cel/rim-light material
// (core/toonMaterial.js) and a procedurally-drawn shell texture, plus a
// procedural run-cycle limb swing. Still not a rigged glTF character --
// real sculpted/rigged TMNT likeness stays gated on the licensing/sourcing
// decision in GDD §12 -- but this is the ceiling of what code alone can do.
const LANE_RESPONSE = 14; // exponential-ease rate toward the target lane X
const JUMP_DURATION = 0.62; // seconds
const JUMP_HEIGHT = 1.7;
export const FORWARD_SPEED = 9; // world units/sec (constant for this pass; ramps later)

const RUN_CYCLE_SPEED = 9;
const ARM_SWING = 0.9;
const LEG_SWING = 0.75;
const BODY_BOB_AMPLITUDE = 0.05;

function createLimb(scene, parentGroup, pivotPos, size, material) {
  const pivot = new TransformNode('limbPivot', scene);
  pivot.parent = parentGroup;
  pivot.position.copyFrom(pivotPos);

  const mesh = CreateBox('limb', size, scene);
  mesh.position.y = -size.height / 2;
  mesh.parent = pivot;
  mesh.material = material;

  return pivot;
}

export function createPlayer(scene) {
  const root = new TransformNode('playerRoot', scene);
  root.position.set(laneToX(CENTER_LANE), 0, 0);

  const bodyGroup = new TransformNode('playerBodyGroup', scene);
  bodyGroup.parent = root;

  const skinMat = createToonMaterial(scene, {
    name: 'playerSkinMat',
    baseColor: new Color3(0.24, 0.56, 0.28),
    rimColor: new Color3(0.75, 1, 0.7),
  });
  const shellMat = createToonMaterial(scene, {
    name: 'playerShellMat',
    baseColor: new Color3(0.95, 0.9, 0.78),
    rimColor: new Color3(1, 0.85, 0.5),
    texture: createShellTexture(scene),
  });
  const maskMat = createToonMaterial(scene, {
    name: 'playerMaskMat',
    baseColor: new Color3(0.12, 0.42, 0.88),
    rimColor: new Color3(0.6, 0.85, 1),
  });
  const beltMat = createToonMaterial(scene, {
    name: 'playerBeltMat',
    baseColor: new Color3(0.32, 0.2, 0.08),
    rimColor: new Color3(0.8, 0.6, 0.3),
    rimPower: 3,
  });
  const hiltMat = createToonMaterial(scene, {
    name: 'playerHiltMat',
    baseColor: new Color3(0.18, 0.13, 0.1),
    rimColor: new Color3(0.7, 0.6, 0.4),
    rimPower: 3,
  });

  // Torso.
  const torso = CreateBox('playerTorso', { width: 0.82, height: 0.82, depth: 0.52 }, scene);
  torso.position.y = 0.92;
  torso.parent = bodyGroup;
  torso.material = skinMat;

  // Domed, textured shell -- built at the origin, non-uniform scale applied,
  // then baked into vertices (see core/toonMaterial.js's normal-transform
  // note) before it's positioned/parented, so the custom shader's lighting
  // stays correct under the squash.
  const shell = CreateSphere('playerShell', { diameter: 1.15, segments: 12 }, scene);
  shell.scaling.set(1, 0.62, 0.82);
  shell.bakeCurrentTransformIntoVertices();
  shell.position.set(0, 1.28, -0.05);
  shell.parent = bodyGroup;
  shell.material = shellMat;

  // Head, mostly tucked behind the mask/shell from this chase-cam angle.
  const head = CreateSphere('playerHead', { diameter: 0.46, segments: 10 }, scene);
  head.position.y = 1.62;
  head.parent = bodyGroup;
  head.material = skinMat;

  // Mask band + trailing tails (reference image's signature silhouette cue).
  const mask = CreateBox('playerMask', { width: 0.5, height: 0.16, depth: 0.5 }, scene);
  mask.position.y = 1.58;
  mask.parent = bodyGroup;
  mask.material = maskMat;

  [-1, 1].forEach((side, i) => {
    const tail = CreateBox(`maskTail${i}`, { width: 0.12, height: 0.4, depth: 0.06 }, scene);
    tail.position.set(side * 0.16, 1.35, -0.22);
    tail.rotation.x = -0.35;
    tail.rotation.z = side * 0.15;
    tail.parent = bodyGroup;
    tail.material = maskMat;
  });

  // Belt.
  const belt = CreateBox('playerBelt', { width: 0.86, height: 0.16, depth: 0.56 }, scene);
  belt.position.y = 0.56;
  belt.parent = bodyGroup;
  belt.material = beltMat;

  // Crossed sword hilts sheathed on the back, poking up over the shoulders.
  [-1, 1].forEach((side, i) => {
    const hilt = CreateCylinder(`swordHilt${i}`, { diameter: 0.09, height: 0.9, tessellation: 8 }, scene);
    hilt.position.set(side * 0.22, 1.55, -0.32);
    hilt.rotation.z = side * 0.5;
    hilt.parent = bodyGroup;
    hilt.material = hiltMat;

    const pommel = CreateBox(`swordPommel${i}`, { width: 0.16, height: 0.1, depth: 0.1 }, scene);
    pommel.position.set(side * 0.35, 1.95, -0.32);
    pommel.rotation.z = side * 0.5;
    pommel.parent = bodyGroup;
    pommel.material = hiltMat;
  });

  // Swinging limbs, each on a shoulder/hip pivot so rotation reads as a
  // real running gait rather than spinning around the limb's own centre.
  const armSize = { width: 0.22, height: 0.62, depth: 0.24 };
  const legSize = { width: 0.26, height: 0.68, depth: 0.28 };
  const leftArm = createLimb(scene, bodyGroup, { x: -0.52, y: 1.18, z: 0 }, armSize, skinMat);
  const rightArm = createLimb(scene, bodyGroup, { x: 0.52, y: 1.18, z: 0 }, armSize, skinMat);
  const leftLeg = createLimb(scene, bodyGroup, { x: -0.24, y: 0.5, z: 0 }, legSize, skinMat);
  const rightLeg = createLimb(scene, bodyGroup, { x: 0.24, y: 0.5, z: 0 }, legSize, skinMat);

  return {
    root,
    bodyGroup,
    limbs: { leftArm, rightArm, leftLeg, rightLeg },
    runPhase: 0,
    laneIndex: CENTER_LANE,
    targetLane: CENTER_LANE,
    jumpElapsed: null, // null = grounded
  };
}

export function setPlayerLane(player, laneIndex) {
  player.targetLane = laneIndex;
}

export function startPlayerJump(player) {
  if (player.jumpElapsed === null) player.jumpElapsed = 0;
}

// Used by collision.js to decide whether a "must jump" obstacle is cleared --
// true for the middle portion of the arc, not right at takeoff/landing.
export function isPlayerRisingAboveThreshold(player) {
  if (player.jumpElapsed === null) return false;
  const t = player.jumpElapsed / JUMP_DURATION;
  return t > 0.18 && t < 0.85;
}

export function resetPlayer(player) {
  player.root.position.set(laneToX(CENTER_LANE), 0, 0);
  player.targetLane = CENTER_LANE;
  player.laneIndex = CENTER_LANE;
  player.jumpElapsed = null;
  player.runPhase = 0;
}

export function updatePlayer(player, dt) {
  const targetX = laneToX(player.targetLane);
  const followT = 1 - Math.exp(-LANE_RESPONSE * dt);
  player.root.position.x += (targetX - player.root.position.x) * followT;
  player.laneIndex = player.targetLane;

  player.root.position.z += FORWARD_SPEED * dt;

  // Jump arc: a simple parametric rise/apex/fall curve, not an AnimationGroup
  // yet -- GDD explicitly allows procedural placeholder animation for now.
  if (player.jumpElapsed !== null) {
    player.jumpElapsed += dt;
    const t = Math.min(player.jumpElapsed / JUMP_DURATION, 1);
    const arc = Math.sin(Math.PI * t);
    player.root.position.y = arc * JUMP_HEIGHT;
    if (t >= 1) {
      player.jumpElapsed = null;
      player.root.position.y = 0;
    }
  }

  // Procedural run cycle: swinging limbs + a small body bob, entirely
  // transform-driven (no AnimationGroup/rig yet -- see class comment above).
  player.runPhase += dt * RUN_CYCLE_SPEED;
  const { leftArm, rightArm, leftLeg, rightLeg } = player.limbs;
  const swing = Math.sin(player.runPhase);
  leftArm.rotation.x = swing * ARM_SWING;
  rightArm.rotation.x = -swing * ARM_SWING;
  leftLeg.rotation.x = -swing * LEG_SWING;
  rightLeg.rotation.x = swing * LEG_SWING;
  player.bodyGroup.position.y = Math.abs(Math.sin(player.runPhase * 2)) * BODY_BOB_AMPLITUDE;
}
