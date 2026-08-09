import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { PostProcess } from '@babylonjs/core/PostProcesses/postProcess';
import { Effect } from '@babylonjs/core/Materials/effect';
// Side-effect import: registers Scene.prototype.enableDepthRenderer(), used below.
import '@babylonjs/core/Rendering/depthRendererSceneComponent';

// Bloom + colour grading + a hand-written ink-outline pass, kept behind an
// on/off toggle plus a naive FPS watchdog per GDD §9.4 -- "keep any
// postprocessing behind an easy on/off toggle... unverified GPU cost on real
// WebView hardware until tested on-device." Bloom is what makes neon
// signage/pickup glow read as glowing rather than flat-emissive; the outline
// pass is what turns the toon-shaded scene into an actual inked comic-panel
// look (a plain cel shader without it still reads as "smooth plastic" at
// silhouette edges).
const LOW_FPS_THRESHOLD = 40;
const LOW_FPS_SUSTAIN_SECONDS = 3;

const OUTLINE_EFFECT_NAME = 'tmntOutline';

// Depth-discontinuity edge detection: samples the scene's linear depth
// buffer at four neighbours and darkens toward black wherever depth jumps
// sharply (a silhouette edge), leaving flat/gently-curved surfaces alone.
Effect.ShadersStore[`${OUTLINE_EFFECT_NAME}FragmentShader`] = `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;
  uniform sampler2D depthSampler;
  uniform vec2 texelSize;
  uniform float depthThreshold;

  void main(void) {
    vec4 baseColor = texture2D(textureSampler, vUV);

    float dL = texture2D(depthSampler, vUV - vec2(texelSize.x, 0.0)).r;
    float dR = texture2D(depthSampler, vUV + vec2(texelSize.x, 0.0)).r;
    float dD = texture2D(depthSampler, vUV - vec2(0.0, texelSize.y)).r;
    float dU = texture2D(depthSampler, vUV + vec2(0.0, texelSize.y)).r;

    float edge = abs(dR - dL) + abs(dU - dD);
    float outline = smoothstep(depthThreshold, depthThreshold * 3.0, edge);

    vec3 color = mix(baseColor.rgb, vec3(0.04, 0.03, 0.06), outline * 0.85);
    gl_FragColor = vec4(color, baseColor.a);
  }
`;

export function createPostFx(scene, camera) {
  const pipeline = new DefaultRenderingPipeline('tmntPipeline', true, scene, [camera]);
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.55;
  pipeline.bloomWeight = 0.55;
  pipeline.bloomKernel = 48;
  pipeline.imageProcessing.contrast = 1.15;
  pipeline.imageProcessing.exposure = 1.05;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 1.4;
  pipeline.imageProcessing.vignetteColor.set(0.05, 0, 0.08, 1);

  const depthRenderer = scene.enableDepthRenderer(camera);

  const outline = new PostProcess(OUTLINE_EFFECT_NAME, OUTLINE_EFFECT_NAME, {
    uniforms: ['texelSize', 'depthThreshold'],
    samplers: ['depthSampler'],
    size: 1.0,
    camera,
    engine: scene.getEngine(),
    reusable: false,
  });
  outline.onApply = (effect) => {
    const engine = scene.getEngine();
    effect.setTexture('depthSampler', depthRenderer.getDepthMap());
    effect.setFloat2('texelSize', 1 / engine.getRenderWidth(), 1 / engine.getRenderHeight());
    effect.setFloat('depthThreshold', 0.0022);
  };

  let enabled = true;
  let lowFpsElapsed = 0;

  function setEnabled(value) {
    enabled = value;
    pipeline.bloomEnabled = value;
    pipeline.imageProcessing.vignetteEnabled = value;
    if (value) camera.attachPostProcess(outline);
    else camera.detachPostProcess(outline);
  }

  // Call once per frame with the current frame delta and engine FPS; demotes
  // to plain forward rendering if sustained low-FPS is detected, rather than
  // assuming these effects are free on real WebView hardware.
  function watchdogTick(dt, fps) {
    if (!enabled) return;
    if (fps < LOW_FPS_THRESHOLD) {
      lowFpsElapsed += dt;
      if (lowFpsElapsed > LOW_FPS_SUSTAIN_SECONDS) setEnabled(false);
    } else {
      lowFpsElapsed = 0;
    }
  }

  return { pipeline, outline, setEnabled, watchdogTick, isEnabled: () => enabled };
}
