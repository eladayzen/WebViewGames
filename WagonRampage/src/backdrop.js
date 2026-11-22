// The distant skyline: a ring of silhouettes around the camera, hazed into the horizon colour
// at their feet so they sit in the same air as the fog. One merged mesh per environment.
// The Technodrome (level 6) is a separate object fixed in the world: it sits on the line from the
// camera to its real position but at a fixed 460 m, scaled to its true angular size, so it stays
// inside the far plane and still grows as the wagon closes in.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from './world.js';

const RING = 440, SHOWN = 460;

// a part with its base at y = 0, coloured from `bot` (foot) to `top`, then placed on the ring
function part(geo, h, x, z, rotY, top, bot) {
  geo.translate(0, h / 2, 0);
  const pos = geo.attributes.position, n = pos.count, arr = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    c.copy(bot).lerp(top, Math.min(1, Math.max(0, pos.getY(i) / h)));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  geo.rotateY(rotY); geo.translate(x, 0, z);
  return geo;
}

export class Backdrop {
  constructor(stage) {
    this.group = new THREE.Group();
    this.ring = null;
    this.techno = null;
    this.kind = null;
    this.goal = 3400;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    stage.add(this.group);
  }

  // kind: see KIT.backdrop in env.js; sky: the env's sky colours (hex)
  set(kind, sky, goal) {
    this.goal = goal || 3400;
    if (this.ring) { this.group.remove(this.ring); this.ring.geometry.dispose(); this.ring = null; }
    if (this.techno) { this.group.remove(this.techno); this.techno.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.techno = null; }
    this.kind = kind;
    const H = new THREE.Color(sky.horizon), Z = new THREE.Color(sky.zenith), B = new THREE.Color(sky.band);
    // feet at the haze colour, tops darker toward the zenith: a skyline, not a wall
    const bot = H.clone().lerp(B, 0.25).multiplyScalar(0.95);
    const top = H.clone().lerp(Z, 0.8).multiplyScalar(0.7);
    const r = mulberry(kind.length * 977 + 13);
    const parts = [];
    const ringAt = (i, N) => { const a = ((i + r() * 0.8) / N) * Math.PI * 2; const d = RING + r() * 40; return [Math.cos(a) * d, Math.sin(a) * d, -a + Math.PI / 2]; };
    const tall = (N, w, h, d) => {
      for (let i = 0; i < N; i++) {
        const [x, z, ry] = ringAt(i, N), hh = h[0] + r() * (h[1] - h[0]);
        parts.push(part(new THREE.BoxGeometry(w[0] + r() * (w[1] - w[0]), hh, d[0] + r() * (d[1] - d[0])), hh, x, z, ry, top, bot));
      }
    };
    if (kind === 'docks') {
      tall(46, [30, 70], [6, 22], [20, 40]);
      for (let i = 0; i < 8; i++) {   // harbour cranes: two legs, a long jib and a counterweight
        const [x, z, ry] = ringAt(i * 6 + 2, 48), hh = 55 + r() * 25;
        for (const dz of [-9, 9]) parts.push(part(new THREE.BoxGeometry(3, hh, 3), hh, x + Math.sin(ry) * dz, z + Math.cos(ry) * dz, ry, top, bot));
        const jib = new THREE.BoxGeometry(70, 4, 4); jib.translate(0, hh, 0);
        parts.push(part(jib, hh + 2, x, z, ry + 0.2, top, top));
      }
    } else if (kind === 'pagodas') {
      tall(30, [16, 34], [30, 100], [16, 30]);
      for (let i = 0; i < 12; i++) {   // tiered Foot towers with upswept roofs
        const [x, z, ry] = ringAt(i * 3 + 1, 36);
        let y = 0;
        for (let t = 0; t < 4; t++) {
          const w = 30 - t * 5, hh = 14;
          parts.push(part(new THREE.BoxGeometry(w * 0.7, hh, w * 0.7), hh, x, z, ry, top, bot).translate(0, y, 0));
          parts.push(part(new THREE.ConeGeometry(w * 0.95, 7, 4), 7, x, z, ry + Math.PI / 4, top, bot).translate(0, y + hh, 0));
          y += hh + 7;
        }
      }
    } else if (kind === 'dusk') {
      tall(70, [20, 50], [55, 170], [22, 40]);
      for (let i = 0; i < 9; i++) {   // a few spires
        const [x, z, ry] = ringAt(i * 7 + 3, 64), hh = 160 + r() * 60;
        parts.push(part(new THREE.ConeGeometry(5, hh, 4), hh, x, z, ry, top, bot));
      }
    } else if (kind === 'techno') {
      tall(46, [22, 54], [30, 100], [22, 40]);
    } else {
      tall(64, [22, 56], [35, 125], [22, 40]);
    }
    if (parts.length) {
      this.ring = new THREE.Mesh(mergeGeometries(parts), this.mat);
      this.ring.frustumCulled = false;
      this.group.add(this.ring);
    }
    if (kind === 'techno') this.techno = this._technodrome(new THREE.Color(sky.band));
    if (this.techno) this.group.add(this.techno);
  }

  // a dark sphere with a glowing equator, a spiked crown and a red eye, built at true size
  _technodrome(glow) {
    const g = new THREE.Group();
    const body = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.1, 0.1), fog: false });
    const lit = new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(1.8), fog: false });
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.4, 0.25), fog: false });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(100, 28, 18), body));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(104, 4.5, 8, 48), lit); ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(80, 3, 8, 40), lit); ring2.rotation.x = Math.PI / 2; ring2.position.y = 58; g.add(ring2);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(7, 60, 5), body);
      sp.position.set(Math.cos(a) * 92, 70, Math.sin(a) * 92);
      sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      g.add(sp);
    }
    const e = new THREE.Mesh(new THREE.SphereGeometry(26, 14, 10), eye); e.position.set(0, 20, 92); g.add(e);
    g.traverse((o) => { o.frustumCulled = false; });
    g.userData.R = 100;
    return g;
  }

  // follow the camera; the Technodrome sits on its line to the real position (0, 0, -goal)
  update(camera) {
    this.group.position.set(camera.position.x, 0, camera.position.z);
    if (this.techno) {
      const tx = -camera.position.x, tz = -(this.goal + 260) - camera.position.z;
      const D = Math.max(60, Math.hypot(tx, tz));
      const k = SHOWN / D;
      this.techno.scale.setScalar(k);
      this.techno.position.set((tx / D) * SHOWN, 150 * k + 20, (tz / D) * SHOWN);
      this.techno.rotation.y = Math.atan2(-tx, -tz);   // the eye faces the camera
    }
  }
}
