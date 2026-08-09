import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';

// Shared between core/sceneSetup.js (the real scene light) and
// core/toonMaterial.js (the hand-written shader's lighting term), so every
// custom-shaded surface lights consistently with the actual scene light
// without duplicating tuned values -- kept in its own module rather than in
// either of those two files so neither has to import the other.
export const KEY_LIGHT_DIRECTION = new Vector3(0.35, -0.6, 0.5);
export const KEY_LIGHT_COLOR = new Color3(1, 0.78, 0.55);
export const AMBIENT_LIGHT_COLOR = new Color3(0.4, 0.36, 0.38);
