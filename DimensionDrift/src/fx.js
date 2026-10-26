// Post-processing, spray and weather.
//
// This file is the argument for the whole experiment. A bloom pyramid, a
// speed-scaled radial blur, a sun veil, split-toning, vignette and grain
// together are one downsample chain plus two full-screen passes — a millisecond
// or so on a mid phone. The nearest equivalent on Flutter's canvas is
// MaskFilter.blur, which measured about eleven milliseconds for a single glowing
// arc. That gap is why `carve` renders where it does.
//
// Effects run in linear space between the render and the OutputPass, which is
// where tone mapping and sRGB encoding happen. Doing them afterwards is what
// makes a bright sun clip to a flat white disc instead of blooming.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uSunUv: { value: new THREE.Vector2(0.5, 0.9) },
    uSunAmt: { value: 0 },
    uSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
    uShadowTint: { value: new THREE.Color(0.55, 0.68, 1.0) },
    // 0.42 cost 0.15 stops at frame centre and 0.59 in the corners, on a frame
    // that had no light to spare. With the exposure fixed it can be a vignette
    // again rather than a second exposure control.
    uVignette: { value: 0.26 },
    // Halved. This is a SCREEN-space term at a fixed amplitude, so it lands the
    // same 1.4-2.0 codes of gradient on every row of the frame regardless of how
    // far away that row's ground is — which puts a floor under every
    // depth-falloff measurement anyone makes on this game, and directly fights
    // the snow shader's whole effort to make texture recede with distance.
    // Measured with it bypassed, the terrain's own gradient falls 3.43 near to
    // 2.68 far; with it on, that ramp is largely filled in.
    uGrain: { value: 0.008 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDamage: { value: 0 },
    uBlur: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2  uSunUv;
    uniform vec3  uSunColor, uFlashColor, uShadowTint;
    uniform float uTime, uSpeed, uSunAmt, uVignette, uGrain, uFlash, uDamage, uBlur;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);

      // Radial blur outward from centre screen, scaled by speed. The single
      // strongest sensation of velocity available for six texture fetches — and
      // the branch is driven by a uniform, so it costs nothing when standing still.
      vec3 col;
      if (uBlur > 0.001) {
        vec3 sum = vec3(0.0);
        float wsum = 0.0;
        for (int i = 0; i < 6; i++) {
          float s = float(i) / 5.0;
          float w = 1.0 - s * 0.55;
          sum += texture2D(tDiffuse, vUv - c * s * uBlur).rgb * w;
          wsum += w;
        }
        col = sum / wsum;
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }

      // Aberration only at the periphery, and only when moving.
      //
      // GREEN IS DISPLACED TOO, by half a step the other way. Shifting only red
      // and blue leaves green where it was, so every high-contrast edge picked
      // up a green rim — most visibly along the carve trench, which is now the
      // sharpest dark-against-bright edge in the frame. Real lateral chromatic
      // aberration spreads the whole spectrum monotonically; splitting the ends
      // and pinning the middle is the one arrangement that guarantees a colour
      // fringe on a neutral edge.
      // Halved. At the old strength this reached 3.6 px in the corners, which
      // is wider than the features it was landing on: it shredded the piste
      // marker poles into coloured dashes with no dark core, and capped how
      // thin they were allowed to be. A lens artefact that dictates the set
      // dressing is too strong.
      float amt = r2 * (0.0006 + uSpeed * 0.0021);
      col.r = mix(col.r, texture2D(tDiffuse, vUv - c * amt).r, 0.85);
      col.g = mix(col.g, texture2D(tDiffuse, vUv + c * amt * 0.15).g, 0.85);
      col.b = mix(col.b, texture2D(tDiffuse, vUv + c * amt).b, 0.85);

      // Sun veil: light spilling across the lens from wherever the sun actually
      // is on screen, rather than a fixed centre glow.
      float sd = distance(vUv, uSunUv);
      col += uSunColor * pow(max(0.0, 1.0 - sd * 1.15), 6.0) * uSunAmt;

      // Split tone — cool shadows against the warm key. Snow is the one subject
      // where this reads as accurate rather than as a filter.
      //
      // NORMALISED TO UNIT LUMINANCE, so it rotates hue without also spending
      // exposure. The tint is derived from the sky colour, which at first light
      // has a luminance of about 0.5 — and the smoothstep below runs on LINEAR
      // luma, where 0.55 is already sRGB 0.77, so almost the entire frame was
      // being multiplied by it. That quietly cost 1.3 stops, which is most of
      // the reason the snow sat three stops under the reference. Dividing by
      // the tint's own luminance keeps the colour and returns the light.
      // AND IT SPARES WHATEVER ALREADY HAS A COLOUR. Cooling the shadows is
      // right for snow, which has no chroma of its own to lose — but the gate
      // flags are deliberately darker than the snow, so they sat at the bottom
      // of the luma ramp where the tint applies at full strength, and it rotated
      // the one warm accent in the game to blue-grey. Counted across the rounds,
      // warm pixels in the frame fell 211 → 5 while nobody was looking at the
      // flags themselves. The reference's entire colour story is 144 red pixels
      // beside the rider; this pass was quietly deleting ours.
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float mx = max(col.r, max(col.g, col.b));
      float sat = (mx - min(col.r, min(col.g, col.b))) / max(mx, 1e-4);
      vec3 tint = uShadowTint / max(dot(uShadowTint, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
      col *= mix(tint, vec3(1.0), max(smoothstep(0.05, 0.55, luma), sat * 0.85));

      col *= 1.0 - uVignette * r2 * 1.6;
      col = mix(col, vec3(1.0, 0.22, 0.30), uDamage * smoothstep(0.03, 0.40, r2));
      col += uFlashColor * uFlash;

      // Grain, weighted away from the blacks. This runs in linear space, so a
      // fixed additive amount is a rounding error on lit snow and a doubling on
      // a tree's underside — where it stopped reading as grain and started
      // reading as a checkerboard. Real film grain is a midtone phenomenon for
      // the same reason: there is nothing in the shadows for it to modulate.
      float n = hash(vUv * 1024.0 + fract(uTime) * 137.0);
      col += (n - 0.5) * uGrain * smoothstep(0.0, 0.14, luma);

      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  /**
   * @param {boolean} [withBloom] false drops the bloom pass entirely.
   *
   * ENTIRELY, not disabled in place: UnrealBloomPass allocates a five-level
   * mip chain at construction, and on the device under complaint the memory
   * is worth as much as the fill.
   *
   * Two reasons to drop it, and they arrived together. It is the fattest
   * fill item in the frame, on a build whose adaptive resolution scaler is
   * switched off (see _adaptScale -- resizing a WebView canvas mid-session is
   * what caused the original blacks bug), so a device that cannot hold the
   * frame has no way to shed pixels and sheds frames instead. And in
   * two-player it is measurably the source of the black flash: 12,000 frames
   * with the post chain bypassed gave 0, 12,000 with bloom alone disabled
   * gave 0, and the same run with it on gave 45 -- always the TRAILING
   * player's half, for four to six frames, with the scene provably identical
   * on the frame before.
   */
  constructor(renderer, scene, camera, withBloom = true) {
    this.renderer = renderer;
    this.camera = camera;
    const size = renderer.getSize(new THREE.Vector2());

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // UnrealBloomPass halves the resolution itself for its mip chain, so it gets
    // the full size — handing it a pre-halved one would quarter it.
    //
    // THRESHOLD 1.05, NOT 0.62. Lit snow sits at 0.9-1.3, so at 0.62 the entire
    // sunlit mountainside fed the bloom and dissolved into a white void — in
    // every bright mood the wall tops and each kicker's landing sheet read as
    // HOLES in the world ("a lot of the snow is see-through"). Only genuinely
    // hot pixels — the sun disc, sparkle glints, emissive goggles — should
    // bloom; the snow itself never.
    this.bloom = withBloom
      ? new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.72, 0.70, 1.05)
      : null;
    if (this.bloom) this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.flash = 0;
    this.damage = 0;
    this._sun = new THREE.Vector3();
  }

  setSize(w, h, pixelRatio) {
    if (pixelRatio != null) this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  punch(amount, color) {
    this.flash = Math.min(1.1, this.flash + amount);
    if (color) this.grade.uniforms.uFlashColor.value.copy(color);
  }

  hurt(amount = 1) {
    this.damage = Math.min(1, this.damage + amount);
  }

  /**
   * @param {number} speedNorm 0..1
   * @param {import('./mood.js').Mood} mood
   */
  update(dt, time, speedNorm, mood) {
    this.flash = Math.max(0, this.flash - dt * 4.2);
    this.damage = Math.max(0, this.damage - dt * 1.5);

    const u = this.grade.uniforms;
    u.uTime.value = time;
    u.uFlash.value = this.flash;
    u.uDamage.value = this.damage;
    u.uSpeed.value = speedNorm;
    u.uBlur.value = Math.max(0, speedNorm - 0.28) * 0.052;
    u.uSunColor.value.copy(mood.uSunColor);
    u.uShadowTint.value.copy(mood.uSkyColor).lerp(new THREE.Color(1, 1, 1), 0.45);

    // Project the sun so the veil tracks where it actually is, and fade it out
    // when it drops behind the camera.
    this._sun.copy(mood.uSunDir).multiplyScalar(800).add(this.camera.position);
    this._sun.project(this.camera);
    const front = this._sun.z < 1;
    u.uSunUv.value.set(this._sun.x * 0.5 + 0.5, this._sun.y * 0.5 + 0.5);
    const off = Math.max(Math.abs(this._sun.x), Math.abs(this._sun.y));
    u.uSunAmt.value = front ? 0.26 * Math.max(0, 1 - Math.max(0, off - 1) * 1.4) : 0;

    if (this.bloom) this.bloom.strength = mood.bloom;
    // The mood's exposure, which for a long time was interpolated every frame
    // and read by nobody: the renderer was set to 1.0 once at boot and never
    // touched again. Every value in the arc was inert, and the scene sat three
    // stops under where the palette thought it was putting it.
    this.renderer.toneMappingExposure = mood.exposure;
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose?.();
  }
}

// ── Spray ───────────────────────────────────────────────────────────────────

const PARTICLE_VERT = /* glsl */ `
attribute float aLife;
attribute float aSize;
attribute vec3 aColor;
varying float vLife;
varying vec3 vColor;
void main() {
  vLife = aLife;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (90.0 / max(-mv.z, 1.0)) * (0.35 + aLife * 0.8);
  gl_Position = projectionMatrix * mv;
}
`;

// Deliberately translucent. Thrown snow that is opaque white becomes a single
// blob the moment a few dozen sprites overlap, which is exactly where the plume
// is thickest — right in front of the rider it exists to show off.
const PARTICLE_FRAG = /* glsl */ `
precision mediump float;
varying float vLife;
varying vec3 vColor;
void main() {
  if (vLife <= 0.0) discard;
  vec2 d = gl_PointCoord - 0.5;
  float a = 1.0 - smoothstep(0.06, 0.5, length(d));
  if (a <= 0.003) discard;
  gl_FragColor = vec4(vColor, a * vLife * 0.40);
}
`;

/**
 * Thrown snow. Unlike the sparks in a neon game these have weight — gravity and
 * a strong drag — because spray that hangs in the air reads as smoke, and spray
 * that falls reads as snow.
 */
export class Particles {
  constructor(scene, capacity = 900) {
    this.capacity = capacity;
    this.cursor = 0;
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.decay = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 3);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geometry = g;

    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
  }

  emit(origin, color, { count = 12, speed = 8, size = 2.6, life = 0.8, dir = null, spread = 1, up = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const k = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const o = k * 3;
      this.position[o] = origin.x;
      this.position[o + 1] = origin.y;
      this.position[o + 2] = origin.z;

      let vx = Math.random() * 2 - 1;
      let vy = Math.random() * 2 - 1;
      let vz = Math.random() * 2 - 1;
      const len = Math.hypot(vx, vy, vz) || 1;
      vx /= len; vy /= len; vz /= len;
      if (dir) {
        vx = vx * spread + dir.x;
        vy = vy * spread + dir.y;
        vz = vz * spread + dir.z;
      }
      const sp = speed * (0.3 + Math.random() * 1.0);
      this.velocity[o] = vx * sp;
      this.velocity[o + 1] = vy * sp + up;
      this.velocity[o + 2] = vz * sp;

      this.life[k] = 1;
      this.decay[k] = 1 / (life * (0.6 + Math.random() * 0.8));
      this.size[k] = size * (0.5 + Math.random() * 1.0);
      this.color[o] = color.r;
      this.color[o + 1] = color.g;
      this.color[o + 2] = color.b;
    }
  }

  update(dt) {
    const drag = Math.exp(-3.1 * dt);
    const g = 9.81 * dt * 0.55;
    for (let k = 0; k < this.capacity; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= this.decay[k] * dt;
      if (this.life[k] < 0) this.life[k] = 0;
      const o = k * 3;
      this.velocity[o + 1] -= g;
      this.position[o] += this.velocity[o] * dt;
      this.position[o + 1] += this.velocity[o + 1] * dt;
      this.position[o + 2] += this.velocity[o + 2] * dt;
      this.velocity[o] *= drag;
      this.velocity[o + 1] *= drag;
      this.velocity[o + 2] *= drag;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.geometry.attributes.aLife.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ── Weather ─────────────────────────────────────────────────────────────────

const SNOW_VERT = /* glsl */ `
uniform float uOpacity;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = -mv.z;
  gl_PointSize = 55.0 / max(d, 1.0) + 0.9;
  // Fade the nearest flakes out: a flake two metres from the lens is a smear.
  vA = uOpacity * smoothstep(1.5, 8.0, d) * (1.0 - smoothstep(30.0, 70.0, d));
  gl_Position = projectionMatrix * mv;
}
`;

const SNOW_FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vA;
void main() {
  if (vA <= 0.004) discard;
  vec2 d = gl_PointCoord - 0.5;
  float a = 1.0 - smoothstep(0.15, 0.5, length(d));
  gl_FragColor = vec4(uColor, a * vA);
}
`;

/**
 * Falling snow, kept in a box that follows the camera and wraps at its faces —
 * so a fixed few hundred flakes look like weather over the whole mountain.
 */
export class Snowfall {
  constructor(scene, count = 900, box = 60) {
    this.count = count;
    this.box = box;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      this.pos[o] = (Math.random() - 0.5) * box;
      this.pos[o + 1] = (Math.random() - 0.5) * box;
      this.pos[o + 2] = (Math.random() - 0.5) * box;
      this.vel[o] = (Math.random() - 0.5) * 1.4;
      this.vel[o + 1] = -1.4 - Math.random() * 1.8;
      this.vel[o + 2] = (Math.random() - 0.5) * 1.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      vertexShader: SNOW_VERT,
      fragmentShader: SNOW_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 0.0 },
        uColor: { value: new THREE.Color(0xffffff) },
      },
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** Re-seed the box around the camera; without this the first frame after a
   *  restart rains the whole field in from wherever the last run ended. */
  reset(camPos) {
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      this.pos[o] = camPos.x + (Math.random() - 0.5) * this.box;
      this.pos[o + 1] = camPos.y + (Math.random() - 0.5) * this.box;
      this.pos[o + 2] = camPos.z + (Math.random() - 0.5) * this.box;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  /** @param {number} amount 0..1 — driven by the mood's cloud cover. */
  update(dt, camPos, amount, riderVel) {
    const u = this.material.uniforms.uOpacity;
    u.value += (amount * 0.5 - u.value) * Math.min(1, dt * 1.2);
    if (u.value < 0.004) return;

    const half = this.box * 0.5;
    // Flakes drift past at the rider's speed: the apparent flow past the lens is
    // what makes them read as being outside the helmet rather than stuck to it.
    const wx = -(riderVel?.x ?? 0) * 0.55;
    const wz = -(riderVel?.z ?? 0) * 0.55;
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      this.pos[o] += (this.vel[o] + wx) * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += (this.vel[o + 2] + wz) * dt;
      // Positions are absolute; the box wraps around wherever the camera is.
      for (let a = 0; a < 3; a++) {
        const rel = this.pos[o + a] - camPos.getComponent(a);
        if (rel > half) this.pos[o + a] -= this.box;
        else if (rel < -half) this.pos[o + a] += this.box;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
