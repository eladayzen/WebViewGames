// Grind sparks -- the metal-on-metal shower where the board meets the rail.
//
// One fixed-size particle pool recycled forever: no allocation per spark, one
// draw call, and a hard ceiling on cost regardless of how long a grind runs.
// Dead particles are parked far below the world rather than removed, because a
// THREE.Points draw count can't be varied per-frame without reuploading the
// geometry.
//
// WHY A CUSTOM SHADER AND NOT PointsMaterial. Two things PointsMaterial cannot
// do, both of which were visible on the first attempt:
//
//  1. SQUARES. An untextured point sprite is a hard-edged quad, so the shower
//     rendered as a scatter of chunky squares. The fragment shader here
//     discards outside a radius and feathers the edge, giving round embers with
//     no texture to load.
//
//  2. PER-PARTICLE FADE. PointsMaterial has one material-wide opacity, so an
//     individual spark can't fade out on its own. The usual dodge is additive
//     blending plus darkening toward black -- which is exactly what the first
//     version did, and it failed for a reason specific to THIS game: additive
//     blending only reads as "glow" over a DARK background, and Hill Bomb's
//     palette WAS pale sand and lilac -- every spark saturated straight to
//     white. The per-particle alpha attribute below is the durable half of that
//     fix and stays. The blend mode is now back to additive, because the
//     dusk-neon repalette made the playfield dark and additive correct again.
//
// Everything is world-space on purpose. Parenting the sparks to the rider would
// drag them along with him and make the board look like it's carrying a flare;
// emitting into the scene and letting them fall behind is what reads as contact
// with a rail that is standing still.

import * as THREE from 'three';

const MAX = 260;
const LIFE = 0.34; // seconds, before the random spread below
const GRAVITY = 20; // world units/s^2 -- heavier than real gravity so embers
// arc down fast and stay a tight shower instead of drifting off across the map.

export function createSparks(scene) {
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const alphas = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX); // seconds remaining; <= 0 means free
  const maxLife = new Float32Array(MAX);

  for (let i = 0; i < MAX; i++) positions[i * 3 + 1] = -9999;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 46.0 } },
    vertexShader: `
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uSize;
      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Perspective size falloff, clamped so a spark never blows up into a
        // dinner plate when the camera happens to pass close to the rail.
        gl_PointSize = clamp(uSize / max(-mv.z, 0.5), 1.5, 15.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        // Round, soft-edged ember instead of the default hard quad.
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.12, d);
        gl_FragColor = vec4(vColor, vAlpha * soft);
      }
    `,
    vertexColors: true,
    transparent: true,
    // ADDITIVE again -- see the header note. The original version used this and
    // failed, but for a reason that no longer holds: additive reads as glow
    // only over a DARK background, and the old pastel sand blew every ember out
    // to white. On the dusk-neon playfield it does exactly what it should, and
    // hot sparks off a rail are the single best thing to have glowing.
    blending: THREE.AdditiveBlending,
    depthWrite: false, // never let a spark punch a hole in what's behind it
    depthTest: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // emission point moves every frame
  points.renderOrder = 3;
  scene.add(points);

  let cursor = 0;
  let carry = 0; // fractional particles owed from the last frame

  return {
    /**
     * Emit along a contact patch.
     * @param {THREE.Vector3} pos    world contact point (board underside)
     * @param {THREE.Vector3} back   unit vector AGAINST travel -- sparks throw
     *                               backwards off the rail
     * @param {THREE.Vector3} up     surface normal at the rail
     * @param {number} speed         rider speed, scales throw distance
     * @param {number} rate          particles per second
     * @param {number} dt
     */
    emit(pos, back, up, speed, rate, dt) {
      carry += rate * dt;
      const n = Math.floor(carry);
      carry -= n;
      for (let k = 0; k < n; k++) {
        const i = cursor;
        cursor = (cursor + 1) % MAX;
        const o = i * 3;
        // Spread the emission point ALONG the rail a little, so the shower has
        // a contact patch instead of a single point source.
        const jitter = (Math.random() - 0.5) * 0.22;
        positions[o] = pos.x + back.x * jitter;
        positions[o + 1] = pos.y + back.y * jitter;
        positions[o + 2] = pos.z + back.z * jitter;

        // Thrown backwards, scaled by how fast the board is actually moving,
        // plus a small upward kick and a modest scatter. The speed coupling is
        // deliberately weak: at 35 u/s a strong one flung embers several units
        // across the trough, which read as debris rather than friction.
        const throwBack = 1.5 + speed * 0.09;
        const kick = 0.8 + Math.random() * 1.2;
        vel[o] = back.x * throwBack + up.x * kick + (Math.random() - 0.5) * 1.0;
        vel[o + 1] = back.y * throwBack + up.y * kick + (Math.random() - 0.5) * 1.0;
        vel[o + 2] = back.z * throwBack + up.z * kick + (Math.random() - 0.5) * 1.0;

        const l = LIFE * (0.55 + Math.random() * 0.75);
        life[i] = l;
        maxLife[i] = l;
        // Hot yellow-white at birth, cooling through orange as it falls (see
        // update). Saturated enough to hold its own against a pale background.
        colors[o] = 1.0;
        colors[o + 1] = 0.82 + Math.random() * 0.18;
        colors[o + 2] = 0.45 + Math.random() * 0.25;
        alphas[i] = 1;
      }
    },

    update(dt) {
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        const o = i * 3;
        if (life[i] <= 0) {
          positions[o + 1] = -9999;
          alphas[i] = 0;
          continue;
        }
        vel[o + 1] -= GRAVITY * dt;
        positions[o] += vel[o] * dt;
        positions[o + 1] += vel[o + 1] * dt;
        positions[o + 2] += vel[o + 2] * dt;

        const t = life[i] / maxLife[i];
        // Cool from yellow-white toward deep orange over the life, and fade on
        // a squared curve so an ember holds its brightness then drops away
        // quickly rather than lingering as a grey dot.
        colors[o + 1] = 0.45 + t * 0.5;
        colors[o + 2] = t * t * 0.5;
        alphas[i] = t * t;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
    },

    get liveCount() {
      let n = 0;
      for (let i = 0; i < MAX; i++) if (life[i] > 0) n++;
      return n;
    },
  };
}
