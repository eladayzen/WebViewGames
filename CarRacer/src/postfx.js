import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Real bloom/vignette/color-grade instead of faking glow with emissive
// materials alone -- the neon-void look was built to read as "glowing" even
// without this (per the earlier plan), so this is a quality lift, not a
// fix for something broken. GPU headroom on a real mobile WebView is still
// unverified, so every effect is gated behind FX flags and a QUALITY tier
// that can drop the whole composer, not just assumed safe.
//
// Dev-time default is 'high' so the look can actually be evaluated right
// now. Before this ships inside the Unity WebView, flip DEFAULT_QUALITY to
// 'low' (or wire up real device detection) -- 'high' is unverified there.
const DEFAULT_QUALITY = 'high';

const vignetteShader = {
  uniforms: { tDiffuse: { value: null }, offset: { value: 1.2 }, darkness: { value: 1.1 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * offset;
      float vig = clamp(1.0 - dot(uv, uv) * darkness, 0.0, 1.0);
      gl_FragColor = vec4(texel.rgb * vig, texel.a);
    }
  `,
};

const colorGradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.18 }, contrast: { value: 1.08 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 gray = vec3(dot(texel.rgb, vec3(0.299, 0.587, 0.114)));
      vec3 sat = mix(gray, texel.rgb, saturation);
      vec3 graded = (sat - 0.5) * contrast + 0.5;
      gl_FragColor = vec4(clamp(graded, 0.0, 1.0), texel.a);
    }
  `,
};

function readQualityOverride() {
  const q = new URLSearchParams(window.location.search).get('quality');
  return q === 'low' || q === 'high' ? q : DEFAULT_QUALITY;
}

export function createPostFX(renderer, scene, camera, width, height) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.45, 0.5, 0.2);
  composer.addPass(bloomPass);

  const vignettePass = new ShaderPass(vignetteShader);
  composer.addPass(vignettePass);

  const gradePass = new ShaderPass(colorGradeShader);
  composer.addPass(gradePass);

  composer.addPass(new OutputPass());

  const fx = {
    renderer, composer, bloomPass, vignettePass, gradePass,
    quality: readQualityOverride(),
    fps: 60,
    lowFrameTime: 0,
    demoted: false,
    flags: { bloom: true, vignette: true, colorGrade: true },
  };
  applyFlags(fx);
  return fx;
}

function applyFlags(fx) {
  fx.bloomPass.enabled = fx.flags.bloom;
  fx.vignettePass.enabled = fx.flags.vignette;
  fx.gradePass.enabled = fx.flags.colorGrade;
}

export function setPostFXFlag(fx, name, enabled) {
  fx.flags[name] = enabled;
  applyFlags(fx);
}

export function resizePostFX(fx, width, height) {
  fx.composer.setSize(width, height);
  fx.bloomPass.setSize(width, height);
}

// Rolling-average FPS watchdog: demote high -> low once if sustained low
// framerate suggests the composer is too expensive here. Never re-promotes
// (avoids thrashing); this is the safety net called for in the plan.
const DEMOTE_FPS_THRESHOLD = 40;
const DEMOTE_AFTER_SECONDS = 3;

export function updatePostFXWatchdog(fx, dt) {
  if (fx.quality !== 'high' || fx.demoted) return;
  const instantFps = dt > 0 ? 1 / dt : 60;
  fx.fps += (instantFps - fx.fps) * 0.05;
  if (fx.fps < DEMOTE_FPS_THRESHOLD) {
    fx.lowFrameTime += dt;
    if (fx.lowFrameTime > DEMOTE_AFTER_SECONDS) {
      fx.quality = 'low';
      fx.demoted = true;
      console.warn('postfx: sustained low framerate, demoting quality to "low"');
    }
  } else {
    fx.lowFrameTime = 0;
  }
}

export function renderPostFX(fx, scene, camera) {
  if (fx.quality === 'high') {
    fx.composer.render();
  } else {
    fx.renderer.render(scene, camera);
  }
}
