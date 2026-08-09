import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { KEY_LIGHT_DIRECTION, KEY_LIGHT_COLOR, AMBIENT_LIGHT_COLOR } from './lightingConstants';

// A hand-written cel/toon shader: quantized (banded) diffuse lighting plus a
// fresnel rim-light, which is what actually sells the reference image's
// comic-book look -- flat StandardMaterial lighting reads as "gray plastic",
// not "inked cartoon". This is the ceiling of what's achievable purely
// through code (no baked textures/PBR authoring, no external assets).
//
// Normal transform note: this shader transforms normals by the plain world
// matrix (not an inverse-transpose normal matrix), which is only correct for
// axis-aligned box geometry under axis-aligned (non-rotated) scaling, or any
// mesh with uniform scaling. Curved geometry (capsules/spheres/cylinders)
// that needs non-uniform scaling must have that scale baked into its
// vertices first via mesh.bakeCurrentTransformIntoVertices() -- see
// entities/player.js's shell mesh for the one case that needs this.
// Babylon auto-appends "#define INSTANCES" plus world0..world3 attributes
// when a mesh has hardware instances (see PushAttributesForInstances in
// @babylonjs/core's shaderMaterial.js) -- but only if the shader source
// actually branches on it. Every obstacle/pickup/building in this project is
// a createInstance() copy, so without this the whole batch would render
// stacked at one shared transform instead of each instance's own position.
const VERTEX_SOURCE = `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;

  #ifdef INSTANCES
  attribute vec4 world0;
  attribute vec4 world1;
  attribute vec4 world2;
  attribute vec4 world3;
  #else
  uniform mat4 world;
  #endif

  uniform mat4 viewProjection;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec2 vUV;

  void main(void) {
    #ifdef INSTANCES
    mat4 finalWorld = mat4(world0, world1, world2, world3);
    #else
    mat4 finalWorld = world;
    #endif

    vec4 worldPos = finalWorld * vec4(position, 1.0);
    vPositionW = worldPos.xyz;
    vNormalW = normalize((finalWorld * vec4(normal, 0.0)).xyz);
    vUV = uv;
    gl_Position = viewProjection * worldPos;
  }
`;

const FRAGMENT_SOURCE = `
  precision highp float;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec2 vUV;

  uniform vec3 baseColor;
  uniform vec3 lightDir;
  uniform vec3 lightColor;
  uniform vec3 ambientColor;
  uniform vec3 cameraPosition;
  uniform vec3 rimColor;
  uniform float rimPower;
  uniform float useTexture;
  uniform sampler2D diffuseTex;
  uniform vec3 emissiveColor;

  void main(void) {
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(lightDir);
    float ndl = max(dot(N, L), 0.0);

    float band;
    if (ndl > 0.75) band = 1.0;
    else if (ndl > 0.35) band = 0.7;
    else band = 0.42;

    vec3 albedo = baseColor;
    if (useTexture > 0.5) {
      albedo *= texture2D(diffuseTex, vUV).rgb;
    }

    vec3 litColor = albedo * (ambientColor + lightColor * band);

    vec3 V = normalize(cameraPosition - vPositionW);
    float rim = pow(1.0 - max(dot(N, V), 0.0), rimPower);
    vec3 color = litColor + rimColor * rim * 0.28 + emissiveColor;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Direction FROM a surface point TO the light (the shader's lighting term
// wants this, whereas Babylon's DirectionalLight.direction points the other
// way -- from the light outward into the scene).
const SURFACE_TO_LIGHT = KEY_LIGHT_DIRECTION.clone().scale(-1).normalize();

export function createToonMaterial(
  scene,
  { name, baseColor, rimColor = new Color3(1, 0.96, 0.85), rimPower = 3.2, texture = null, emissiveColor = Color3.Black() }
) {
  const material = new ShaderMaterial(
    name,
    scene,
    { vertexSource: VERTEX_SOURCE, fragmentSource: FRAGMENT_SOURCE },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: [
        'world',
        'viewProjection',
        'baseColor',
        'lightDir',
        'lightColor',
        'ambientColor',
        'cameraPosition',
        'rimColor',
        'rimPower',
        'useTexture',
        'emissiveColor',
      ],
      samplers: ['diffuseTex'],
    }
  );

  material.setColor3('baseColor', baseColor);
  material.setVector3('lightDir', SURFACE_TO_LIGHT);
  material.setColor3('lightColor', KEY_LIGHT_COLOR);
  material.setColor3('ambientColor', AMBIENT_LIGHT_COLOR);
  material.setColor3('rimColor', rimColor);
  material.setFloat('rimPower', rimPower);
  material.setFloat('useTexture', texture ? 1 : 0);
  material.setColor3('emissiveColor', emissiveColor);
  material.setVector3('cameraPosition', Vector3.Zero());
  if (texture) material.setTexture('diffuseTex', texture);

  // Rim lighting depends on view direction, which changes every frame as the
  // chase cam follows the player -- refresh it right before each draw call.
  material.onBindObservable.add(() => {
    if (scene.activeCamera) material.setVector3('cameraPosition', scene.activeCamera.position);
  });

  return material;
}
