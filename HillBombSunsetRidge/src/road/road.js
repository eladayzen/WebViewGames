// Road: centerline function + rolling ribbon mesh (build doc §5.1, §9.1).
//
// The rider is tracked as (s, u): s = distance travelled down the road, u =
// signed lateral offset from the centerline. World position is
// centerline(s) + right(s) * u. This is Astro_Tunnel's centerline technique with
// a flat ribbon instead of a tube, and it buys free continuous lateral
// positioning, curved sections, and cheap (s,u) collision all at once -- which
// is why the build doc calls for adopting it at POC rather than retrofitting.
//
// Geometry is a rolling WINDOW rebuilt in place each frame (a few hundred verts),
// not a pre-built track -- so the descent is effectively infinite for free.

import * as THREE from 'three';
import {
  SEG_LEN, SEGMENTS_AHEAD, SEGMENTS_BEHIND, GRADE, ROAD_HALF_WIDTH,
  ROAD_COLOR, LINE_COLOR, SHOULDER_COLOR, RAIL_COLOR,
} from '../data/constants.js';

/** Centerline position at distance s. Gentle S-curves over a constant descent. */
export function centerline(s, out = new THREE.Vector3()) {
  const x = Math.sin(s * 0.0042) * 22 + Math.sin(s * 0.00131) * 52;
  return out.set(x, -s * GRADE, -s);
}

/** Unit right-vector at s (perpendicular to the tangent, level with the world). */
export function rightVector(s, out = new THREE.Vector3()) {
  const a = centerline(s - 1, _tmpA);
  const b = centerline(s + 1, _tmpB);
  const tan = _tmpC.subVectors(b, a).normalize();
  return out.crossVectors(tan, _up).normalize();
}

/** World position of a point at (s, u). */
export function toWorld(s, u, out = new THREE.Vector3()) {
  centerline(s, out);
  rightVector(s, _tmpR);
  return out.addScaledVector(_tmpR, u);
}

const _up = new THREE.Vector3(0, 1, 0);
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
const _tmpR = new THREE.Vector3();

// A ribbon that follows the centerline at a fixed lateral band [uA, uB].
class Ribbon {
  constructor(uA, uB, color, yLift = 0, opts = {}) {
    this.uA = uA;
    this.uB = uB;
    this.yLift = yLift;
    this.count = SEGMENTS_AHEAD + SEGMENTS_BEHIND;

    const verts = (this.count + 1) * 2;
    this.positions = new Float32Array(verts * 3);
    const indices = [];
    for (let i = 0; i < this.count; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setIndex(indices);

    // Unlit on purpose: the real game's environment surfaces carry painted-in
    // shading on illustrated textures (build doc §0/§9.1), so they must not be
    // re-shaded by scene lights. Flat color here is the placeholder stand-in.
    this.material = new THREE.MeshBasicMaterial({ color, ...opts });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  update(sRider) {
    const p = this.positions;
    const s0 = Math.floor(sRider / SEG_LEN) * SEG_LEN - SEGMENTS_BEHIND * SEG_LEN;
    for (let i = 0; i <= this.count; i++) {
      const s = s0 + i * SEG_LEN;
      const a = toWorld(s, this.uA, _tmpA);
      const b = toWorld(s, this.uB, _tmpB);
      const o = i * 6;
      p[o] = a.x; p[o + 1] = a.y + this.yLift; p[o + 2] = a.z;
      p[o + 3] = b.x; p[o + 4] = b.y + this.yLift; p[o + 5] = b.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}

export function createRoad(scene) {
  const group = new THREE.Group();
  const W = ROAD_HALF_WIDTH;

  const ribbons = [
    new Ribbon(-W - 3.2, -W, SHOULDER_COLOR, -0.06), // left shoulder
    new Ribbon(W, W + 3.2, SHOULDER_COLOR, -0.06), // right shoulder
    new Ribbon(-W, W, ROAD_COLOR, 0), // tarmac
    new Ribbon(-0.28, 0.28, LINE_COLOR, 0.02), // center line
  ];
  ribbons.forEach((r) => group.add(r.mesh));

  // Guardrail posts + palms, recycled through a fixed pool positioned off the
  // nearest multiple of their spacing -- the same "place by index along s"
  // pattern HalfShellHustle's envArt buildingProfile uses, so it never needs a
  // spawn/despawn list.
  const POST_SPACING = 9;
  const POST_POOL = Math.ceil((SEGMENTS_AHEAD * SEG_LEN) / POST_SPACING) + 2;
  const postGeo = new THREE.BoxGeometry(0.28, 1.05, 0.28);
  const railGeo = new THREE.BoxGeometry(0.16, 0.34, POST_SPACING);
  const postMat = new THREE.MeshBasicMaterial({ color: RAIL_COLOR });
  const posts = [];
  for (let i = 0; i < POST_POOL; i++) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      const rail = new THREE.Mesh(railGeo, postMat);
      rail.position.set(0, 0.42, POST_SPACING * 0.5);
      post.add(rail);
      post.frustumCulled = false;
      group.add(post);
      posts.push({ mesh: post, side, idx: i });
    }
  }

  // Palms as simple stand-ins -- deliberately crude. The point of this harness
  // is the rider layer; dressing only needs to give the eye something to read
  // speed against.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 7, 5);
  const frondGeo = new THREE.SphereGeometry(1.5, 7, 5);
  const trunkMat = new THREE.MeshBasicMaterial({ color: 0x8a6b48 });
  const frondMat = new THREE.MeshBasicMaterial({ color: 0x4e7a3a });
  const PALM_SPACING = 26;
  const PALM_POOL = Math.ceil((SEGMENTS_AHEAD * SEG_LEN) / PALM_SPACING) + 2;
  const palms = [];
  for (let i = 0; i < PALM_POOL; i++) {
    for (const side of [-1, 1]) {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.5;
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.y = 7.1;
      frond.scale.set(1, 0.5, 1);
      palm.add(trunk, frond);
      palm.frustumCulled = false;
      group.add(palm);
      palms.push({ mesh: palm, side, idx: i });
    }
  }

  scene.add(group);

  function placePool(items, spacing, lateral, sRider) {
    const base = Math.floor((sRider - SEGMENTS_BEHIND * SEG_LEN) / spacing);
    const perSide = items.length / 2;
    for (const it of items) {
      const s = (base + it.idx) * spacing;
      toWorld(s, lateral * it.side, _tmpA);
      it.mesh.position.copy(_tmpA);
      // Yaw to the local road TANGENT so rail segments join end-to-end instead
      // of zigzagging (they extend along their own local +Z).
      centerline(s - 1, _tmpB);
      centerline(s + 1, _tmpC);
      it.mesh.rotation.y = Math.atan2(_tmpC.x - _tmpB.x, _tmpC.z - _tmpB.z);
      void perSide;
    }
  }

  return {
    group,
    update(sRider) {
      ribbons.forEach((r) => r.update(sRider));
      placePool(posts, POST_SPACING, ROAD_HALF_WIDTH + 1.2, sRider);
      placePool(palms, PALM_SPACING, ROAD_HALF_WIDTH + 8.5, sRider);
    },
    setLit(lit) {
      // Swap the tarmac/shoulder between unlit and lambert so the harness can
      // show what real-time lighting does to flat illustrated surfaces -- the
      // build doc's claim is that unlit is correct for painted art (§9.1), and
      // this toggle is how that gets checked rather than asserted.
      ribbons.forEach((r) => {
        const color = r.material.color.getHex();
        r.material.dispose();
        r.material = lit
          ? new THREE.MeshLambertMaterial({ color })
          : new THREE.MeshBasicMaterial({ color });
        r.mesh.material = r.material;
      });
    },
  };
}
