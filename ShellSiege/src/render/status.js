// STATUS SHADERS: what a foe looks like when it is FROZEN (stunned) or SLOWED, painted into the
// material itself so the effect follows the body's shape instead of being a flat colour wash.
//
//   FREEZE  icy tint, a hard blue rim, and glittering frost that flickers; the animation also stops.
//   SLOW    drained of colour toward violet, a pulsing rim, and bands that sweep slowly down the body.
//
// Added to a MeshLambertMaterial with onBeforeCompile; `uMode` 0 = off, 1 = freeze, 2 = slow.
export function patchStatus(mat) {
  const uni = { uMode: { value: 0 }, uTime: { value: 0 } };
  mat.userData.status = uni;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMode = uni.uMode; sh.uniforms.uTime = uni.uTime;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uMode;\nuniform float uTime;\nvoid main() {')
      .replace('#include <opaque_fragment>', `
        if (uMode > 0.5) {
          vec3 sn = normalize(vNormal); vec3 sv = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(dot(sn, sv), 0.0, 1.0), 2.2);
          if (uMode < 1.5) {
            outgoingLight = mix(outgoingLight, vec3(0.62, 0.86, 1.0), 0.6);
            outgoingLight += vec3(0.30, 0.65, 1.0) * fr * 1.2;
            float g = fract(sin(dot(floor(gl_FragCoord.xy * 0.5), vec2(12.9898, 78.233)) + floor(uTime * 8.0)) * 43758.5453);
            outgoingLight += vec3(1.0) * step(0.985, g) * 0.9;
          } else {
            float l = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
            outgoingLight = mix(outgoingLight, vec3(l) * vec3(0.75, 0.7, 1.0), 0.6);
            float band = 0.5 + 0.5 * sin(gl_FragCoord.y * 0.06 - uTime * 4.0);
            outgoingLight += vec3(0.55, 0.35, 1.0) * (fr * (0.7 + 0.5 * sin(uTime * 6.0)) + band * 0.12);
          }
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'status-v1';
  return uni;
}

/** Set a patched material's mode (0 off, 1 freeze, 2 slow) and clock. */
export function setStatus(mat, mode, timeS) {
  const u = mat.userData.status;
  if (!u) return;
  u.uMode.value = mode; u.uTime.value = timeS;
}
