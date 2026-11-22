// THE WARNINGS: what makes an enemy's job readable.
//
// Every job in core/behaviors.js has a moment where the foe stands still and the
// player has a fair chance to get out of the way. That chance is only fair if
// the danger is DRAWN, exactly where it will land, and filling toward the instant
// it goes off. So the sim publishes `f.tell` and this paints it:
//
//   ring   (Elemental Golem)  a circle on the floor, the exact radius of the
//                             slam, filling from the middle. Leave it.
//   line   (Mechanical Golem) a lane from the golem along its LOCKED direction,
//                             filling toward its far end. Step out of it.
//   sigil  (Fort Golem)       a violet ring under the golem. Slayers are coming.
//   orb    (Evil God)         a glow gathering above her head, then an orb that
//                             flies. It is slower than you are.
//
// EVERYTHING IS FLAT ON THE GROUND, so it never hides a body and cannot sort
// wrongly against the floor.
//
// NORMAL BLENDING, NOT ADDITIVE -- found by looking. The first version was
// additive, like the rune ring, and on the bright sandstone floor an orange
// warning added to pale stone came out cream: it was visible and it did not read
// as a warning. The rooms now vary from sewer green to tech white, so the
// warning has to be a saturated colour that reads on ANY of them, and only
// ordinary alpha does that. (The orbs and glows stay additive: they are light,
// and sit above the floor against darker things.)
//
// `t` runs 0 to 1 over the warning. The fill is the countdown: a player who has
// never seen the enemy before can still tell how long they have by watching it
// fill, the same way the choice screen's hold ring taught itself.
//
// POOLED. Nothing is allocated per warning; a marker that is not in use is just
// not visible.
import * as THREE from 'three';
import { u } from './units.js';
import { glowTexture } from './stage.js';
import { BREEDS } from '../core/breeds.js';

const MAX_MARKS = 14;
const MAX_SHOTS = 48;
const Y = 0.045;                        // just above the floor, below everything standing on it

const COLORS = {
  ring:  0xe8420f,      // slam: hot orange-red
  line:  0xe21f2a,      // charge lane: red
  sigil: 0x8d3dff,      // summon: violet
  shock: 0xfff0b0,      // the slam going off: a pale flash
};

export function createTelegraphs(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const outlineGeo = new THREE.RingGeometry(0.925, 1.0, 72);
  const discGeo = new THREE.CircleGeometry(1, 56);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const flat = (geo, color) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    return m;
  };

  // ---- ground markers: each holds every part any kind might need ------------
  const marks = [];
  for (let i = 0; i < MAX_MARKS; i++) {
    const root = new THREE.Group();            // positioned at the foe, turned for a line
    root.visible = false;
    const outline = flat(outlineGeo, COLORS.ring);
    const fill = flat(discGeo, COLORS.ring);
    const laneBase = flat(planeGeo, COLORS.line);
    const laneFill = flat(planeGeo, COLORS.line);
    root.add(outline, fill, laneBase, laneFill);
    group.add(root);
    marks.push({ root, outline, fill, laneBase, laneFill });
  }
  let markI = 0;
  const nextMark = () => {
    const m = marks[markI++];
    m.outline.visible = m.fill.visible = m.laneBase.visible = m.laneFill.visible = false;
    m.root.rotation.y = 0;
    return m;
  };

  function show(mesh, color, opacity) {
    mesh.visible = true;
    mesh.material.color.setHex(color);
    mesh.material.opacity = opacity;
  }

  /** A ring-shaped warning, or the shockwave after one goes off. */
  function drawRing(m, x, y, r, t, color, fillOpacity, outlineOpacity) {
    m.root.visible = true;
    m.root.position.set(u(x), Y, u(y));
    const R = u(r);
    m.outline.scale.set(R, R, 1);
    show(m.outline, color, outlineOpacity);
    m.fill.scale.set(Math.max(0.001, R * t), Math.max(0.001, R * t), 1);
    show(m.fill, color, fillOpacity);
  }

  // ---- the gathering orb above a thrower's head, and the orbs in flight -----
  const glowMat = (inner, outer) => new THREE.SpriteMaterial({
    map: glowTexture(inner, outer), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, fog: false,
  });
  const charge = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(glowMat('rgba(255,170,90,1)', 'rgba(255,90,40,0)').clone());
    s.visible = false;
    group.add(s);
    charge.push(s);
  }
  let chargeI = 0;

  // a flying orb is a hot core, a wide glow, and a dark blob on the stone beneath
  const coreTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    // A hot centre with a DARK VIOLET RIM. The first orb was orange on an orange
    // floor and was easy to lose; the rim is what makes it a dodgeable object
    // on any floor, light or dark.
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,250,225,1)');
    grad.addColorStop(0.32, 'rgba(255,170,70,1)');
    grad.addColorStop(0.6, 'rgba(235,60,120,1)');
    grad.addColorStop(0.82, 'rgba(70,14,100,0.95)');
    grad.addColorStop(1, 'rgba(70,14,100,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shadowTex = glowTexture('rgba(0,0,0,0.7)', 'rgba(0,0,0,0)');
  const shots = [];
  for (let i = 0; i < MAX_SHOTS; i++) {
    const g = new THREE.Group();
    const glow = new THREE.Sprite(glowMat('rgba(255,120,60,0.9)', 'rgba(255,60,120,0)').clone());
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, transparent: true, depthWrite: false, fog: false }));
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, fog: false,
    }));
    blob.rotation.x = -Math.PI / 2;
    g.add(blob, glow, core);
    g.visible = false;
    group.add(g);
    shots.push({ g, glow, core, blob });
  }

  /**
   * Paint one frame of every warning and every orb in flight.
   * @param foes  w.foes   @param shots_ w.foeShots   @param timeS  w.timeS
   */
  function sync(foes, shots_, timeS) {
    markI = 0; chargeI = 0;
    for (const m of marks) m.root.visible = false;
    for (const s of charge) s.visible = false;

    for (const f of foes) {
      if (!f.alive) continue;
      const tell = f.tell;
      if (tell && markI < MAX_MARKS) {
        const pulse = 0.85 + 0.15 * Math.sin(timeS * 14);
        if (tell.kind === 'ring') {
          drawRing(nextMark(), tell.x, tell.y, tell.r, tell.t, COLORS.ring, (0.16 + 0.34 * tell.t) * pulse, 0.92);
        } else if (tell.kind === 'sigil') {
          drawRing(nextMark(), tell.x, tell.y, tell.r, tell.t, COLORS.sigil, (0.18 + 0.34 * tell.t) * pulse, 0.92);
        } else if (tell.kind === 'line') {
          const m = nextMark();
          m.root.visible = true;
          m.root.position.set(u(tell.x), Y, u(tell.y));
          // sim (dx, dy) lies along scene (x, z); a turn about Y of -angle puts +X on it
          m.root.rotation.y = -Math.atan2(tell.dy, tell.dx);
          const len = u(tell.len), wid = u(tell.halfW * 2);
          m.laneBase.scale.set(len, wid, 1);
          m.laneBase.position.set(len / 2, 0, 0);
          show(m.laneBase, COLORS.line, 0.2);
          const filled = Math.max(0.001, len * tell.t);
          m.laneFill.scale.set(filled, wid, 1);
          m.laneFill.position.set(filled / 2, 0.002, 0);
          show(m.laneFill, COLORS.line, (0.28 + 0.34 * tell.t) * pulse);
        } else if (tell.kind === 'orb' && chargeI < charge.length) {
          const s = charge[chargeI++];
          const h = (BREEDS[f.breed]?.height ?? 2) * 0.92;
          s.visible = true;
          s.position.set(u(f.x), h, u(f.y));
          const k = 0.25 + 0.95 * tell.t;
          s.scale.set(k, k, 1);
          s.material.opacity = 0.6 + 0.4 * pulse;
        }
      }
      // a slam that has just gone off: a ring racing outward and fading
      if (f.shock && markI < MAX_MARKS) {
        const p = 1 - f.shock.t / 0.4;
        drawRing(nextMark(), f.shock.x, f.shock.y, f.shock.r, 0.15 + 0.85 * p, COLORS.shock, 0.35 * (1 - p), 0.95 * (1 - p));
      }
    }

    let i = 0;
    for (const s of shots_) {
      if (!s.alive || i >= MAX_SHOTS) continue;
      const v = shots[i++];
      const R = u(s.r);
      v.g.visible = true;
      v.g.position.set(u(s.x), 0, u(s.y));
      const pulse = 1 + 0.18 * Math.sin(timeS * 22 + i);
      v.glow.position.y = v.core.position.y = 0.7;
      v.glow.scale.set(R * 6.4 * pulse, R * 6.4 * pulse, 1);
      v.core.scale.set(R * 3.6, R * 3.6, 1);
      v.blob.scale.set(R * 3, R * 3, 1);
      v.blob.position.y = 0.03;
    }
    for (; i < MAX_SHOTS; i++) shots[i].g.visible = false;
  }

  return { group, sync };
}
