// A GIANT FADES ONLY WHEN IT IS REALLY IN THE WAY. The camera is built exactly
// as render/view.js place() builds it, so these tests break if the angle changes
// in a way the rule cannot cope with.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSeeThrough, stepAlpha, insideRect, SEE } from '../src/render/seethrough.js';
import { makeFoe } from '../src/core/foes.js';

function camera(px, py) {
  const yaw = Math.PI / 4, pitch = (50 * Math.PI) / 180, dist = 22;
  const c = new THREE.PerspectiveCamera(35, 16 / 9, 0.5, 120);
  const t = new THREE.Vector3(px / 100, 0, py / 100), ch = Math.cos(pitch) * dist;
  c.position.set(t.x + Math.cos(yaw) * ch, t.y + Math.sin(pitch) * dist, t.z + Math.sin(yaw) * ch);
  c.lookAt(t);
  c.updateMatrixWorld(); c.updateProjectionMatrix();
  return c;
}
const P = { x: 2000, y: 2000 };
const giantAt = (dx, dy, breed = 'fortgolem') => makeFoe(P.x + dx, P.y + dy, 0, breed);
const wants = (g, others = [], shots = []) => createSeeThrough(camera(P.x, P.y)).update([g, ...others], P, shots).get(g);

test('a giant standing between the camera and the player is see-through', () => {
  assert.equal(wants(giantAt(180, 180)), SEE.alpha);
});
test('a giant BEHIND the player, or beside them, stays solid', () => {
  assert.equal(wants(giantAt(-180, -180)), 1, 'behind');
  assert.equal(wants(giantAt(700, -700)), 1, 'far to the side');
  assert.equal(wants(giantAt(500, 500)), 1, 'in front, but too far toward the camera to cover anyone');
});
test('a giant hiding another ENEMY fades too', () => {
  const g = giantAt(330, 330);
  const small = makeFoe(P.x + 220, P.y + 220, 0, 'slayer');
  assert.equal(wants(g, [small]), SEE.alpha);
});
test('a giant hiding an ORB fades', () => {
  const g = giantAt(330, 330);
  assert.equal(wants(g, [], [{ x: P.x + 240, y: P.y + 240, alive: true }]), SEE.alpha);
});
test('only breeds marked seeThrough ever fade', () => {
  const mech = giantAt(180, 180, 'mechgolem');
  assert.equal(createSeeThrough(camera(P.x, P.y)).update([mech], P, []).has(mech), false);
});
test('a dead giant is ignored', () => {
  const g = giantAt(180, 180); g.alive = false;
  assert.equal(createSeeThrough(camera(P.x, P.y)).update([g], P, []).has(g), false);
});
test('opacity glides rather than snaps, and settles on the target', () => {
  let a = 1;
  a = stepAlpha(a, SEE.alpha, 1 / 60);
  assert.ok(a < 1 && a > SEE.alpha, `one frame moved it to ${a}`);
  for (let i = 0; i < 120; i++) a = stepAlpha(a, SEE.alpha, 1 / 60);
  assert.ok(Math.abs(a - SEE.alpha) < 0.01);
});
test('insideRect ignores the shrunk edge', () => {
  const r = { x0: 0, x1: 1, y0: 0, y1: 1 };
  assert.equal(insideRect(r, 0.5, 0.5), true);
  assert.equal(insideRect(r, 0.02, 0.5), false);
});
