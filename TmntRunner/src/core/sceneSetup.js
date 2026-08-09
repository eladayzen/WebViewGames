import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { createToonMaterial } from './toonMaterial';
import { KEY_LIGHT_DIRECTION, KEY_LIGHT_COLOR } from './lightingConstants';

// Third-person chase cam: fixed offset behind/above the player, locked to the
// player's lane X + a constant forward look -- a scripted follow cam, not an
// ArcRotateCamera, per GDD §9.1 ("this is a lane-slot state machine, not open
// 3D movement").
const CAMERA_HEIGHT = 3.4;
const CAMERA_BACK_OFFSET = 7.5;
const CAMERA_LOOK_AHEAD = 14;

const ROAD_WIDTH = 8;
const ROAD_LENGTH = 400;
const SKY_AHEAD_DISTANCE = 260;

export function createEngine(canvas) {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
}

export function createScene(engine) {
  const scene = new Scene(engine);
  // Fallback clear colour behind the gradient sky plane (visible briefly
  // before assets settle, and on any gap the sky mesh doesn't cover).
  scene.clearColor = new Color4(0.16, 0.08, 0.18, 1);
  return scene;
}

export function createCamera(scene, canvas) {
  const camera = new UniversalCamera(
    'chaseCam',
    new Vector3(0, CAMERA_HEIGHT, -CAMERA_BACK_OFFSET),
    scene
  );
  camera.setTarget(new Vector3(0, CAMERA_HEIGHT * 0.55, CAMERA_LOOK_AHEAD));
  camera.fov = 0.9;
  // Default far-clip (10000) wastes depth-buffer precision on a world that
  // never extends past ~300 units ahead of the camera -- tightening it
  // matters for postfx.js's depth-based ink-outline edge detection.
  camera.maxZ = 500;
  // No attachControl(): this is a scripted follow cam driven every frame by
  // core/main.js's tick loop, never by user pointer/keyboard input.
  return camera;
}

// Moves the camera to follow the player's current world position, keeping
// the same fixed offset/look-ahead. Called once per frame from the game loop.
export function updateCameraFollow(camera, playerPosition) {
  camera.position.x = playerPosition.x;
  camera.position.y = playerPosition.y + CAMERA_HEIGHT;
  camera.position.z = playerPosition.z - CAMERA_BACK_OFFSET;
  camera.setTarget(
    new Vector3(playerPosition.x, playerPosition.y + CAMERA_HEIGHT * 0.55, playerPosition.z + CAMERA_LOOK_AHEAD)
  );
}

export function createLighting(scene) {
  // Soft warm ambient fill -- kept flat/toon-ish (no strong specular) so the
  // saturated placeholder colours read clearly rather than photoreal.
  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.diffuse = new Color3(1, 0.92, 0.85);
  ambient.groundColor = new Color3(0.35, 0.2, 0.35);
  ambient.intensity = 0.85;

  // Single warm key light, low sun-angle to match the sunset reference.
  const key = new DirectionalLight('key', KEY_LIGHT_DIRECTION.clone(), scene);
  key.diffuse = KEY_LIGHT_COLOR.clone();
  key.specular = new Color3(0.15, 0.12, 0.1);
  key.intensity = 1.1;

  return { ambient, key };
}

// Warm sunset gradient "sky wall": a single large plane positioned far ahead
// of the track. The camera never rotates (fixed forward-looking follow cam),
// so a static backdrop plane is enough to sell depth without a full skybox.
export function createSky(scene) {
  const fragmentSource = `
    precision highp float;
    varying vec2 vUV;
    void main(void) {
      vec3 topColor = vec3(0.10, 0.05, 0.20);
      vec3 midColor = vec3(0.85, 0.35, 0.35);
      vec3 horizonColor = vec3(1.0, 0.72, 0.35);
      vec3 glowColor = vec3(1.0, 0.92, 0.7);

      float t = vUV.y;
      vec3 color = mix(horizonColor, topColor, smoothstep(0.28, 0.85, t));
      color = mix(color, midColor, smoothstep(0.0, 0.32, t) * (1.0 - smoothstep(0.32, 0.6, t)));

      float dist = distance(vUV, vec2(0.5, 0.22));
      float glow = smoothstep(0.45, 0.0, dist);
      color = mix(color, glowColor, glow * 0.85);

      gl_FragColor = vec4(color, 1.0);
    }
  `;
  const vertexSource = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 world;
    uniform mat4 viewProjection;
    varying vec2 vUV;
    void main(void) {
      vUV = uv;
      gl_Position = viewProjection * world * vec4(position, 1.0);
    }
  `;

  const skyMat = new ShaderMaterial('skyGradient', scene, { vertexSource, fragmentSource }, {
    attributes: ['position', 'uv'],
    uniforms: ['world', 'viewProjection'],
  });
  skyMat.backFaceCulling = false;
  skyMat.disableDepthWrite = true;

  const sky = CreatePlane('skyWall', { width: 220, height: 110 }, scene);
  sky.position = new Vector3(0, 40, SKY_AHEAD_DISTANCE);
  sky.material = skyMat;
  sky.renderingGroupId = 0;
  sky.isPickable = false;
  return sky;
}

// Ground/stripes are untextured solid colour, so silently re-centering them
// under the player every frame (rather than pooling, like the chunk system
// does for obstacles/dressing) is visually seamless and much simpler for a
// featureless flat surface.
export function createGround(scene) {
  const group = new TransformNode('roadGroup', scene);

  const ground = CreateGround('road', { width: ROAD_WIDTH, height: ROAD_LENGTH, subdivisions: 2 }, scene);
  ground.parent = group;
  ground.material = createToonMaterial(scene, {
    name: 'roadMat',
    baseColor: new Color3(0.24, 0.22, 0.26),
    rimColor: new Color3(0.6, 0.5, 0.7),
    rimPower: 3.5,
  });
  ground.isPickable = false;

  // Cheap lane-divider strips (cosmetic only -- lane logic itself lives in
  // track/lanes.js and never touches these meshes).
  const stripeMat = createToonMaterial(scene, {
    name: 'stripeMat',
    baseColor: new Color3(0.9, 0.85, 0.3),
    rimColor: new Color3(1, 1, 0.8),
    emissiveColor: new Color3(0.15, 0.13, 0.02),
  });
  [-1.1, 1.1].forEach((x, i) => {
    const stripe = CreateGround(`stripe${i}`, { width: 0.12, height: ROAD_LENGTH, subdivisions: 1 }, scene);
    stripe.parent = group;
    stripe.position.x = x;
    stripe.position.y = 0.01;
    stripe.isPickable = false;
    stripe.material = stripeMat;
  });

  return group;
}

// Keeps the ground group and the distant sky wall centred on/ahead of the
// player regardless of how far they've travelled.
export function updateEnvironmentFollow(groundGroup, sky, playerZ) {
  groundGroup.position.z = playerZ;
  sky.position.z = playerZ + SKY_AHEAD_DISTANCE;
}
