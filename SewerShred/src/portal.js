// The portal at the end of NIGHT CITY (Elad 2026-11-23: "in the end there will be a
// portal I am going into — next level inside the portal, next Dimension X").
// A glowing ring stood across the trench with a swirling energy disc in it; built in
// code (0 credits). The level clears as you ride through it.
import * as THREE from 'three';
import { frameAt } from './track.js';

export class Portal {
  constructor(scene) {
    this.g = new THREE.Group();
    this.g.visible = false;
    scene.add(this.g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.42, 12, 64), new THREE.MeshBasicMaterial({ color: 0x7ff4ff }));
    const ink = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.58, 12, 64), new THREE.MeshBasicMaterial({ color: 0x14102a }));
    ink.position.z = 0.05;
    this.uni = { uTime: { value: 0 } };
    const disc = new THREE.Mesh(new THREE.CircleGeometry(4.75, 64), new THREE.ShaderMaterial({
      uniforms: this.uni, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
          float sw = sin(a * 5.0 + r * 9.0 - uTime * 5.0) * 0.5 + 0.5;
          float sw2 = sin(a * 3.0 - r * 14.0 + uTime * 3.0) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.25, 0.1, 0.9), vec3(0.2, 0.95, 1.0), sw) + vec3(0.9, 0.2, 0.8) * sw2 * 0.5;
          float core = smoothstep(0.55, 0.0, r);
          c += vec3(1.0) * core * 0.9;
          gl_FragColor = vec4(c * (0.55 + 0.45 * sw), smoothstep(1.0, 0.85, r) * 0.95);
        }`,
    }));
    this.g.add(ink, ring, disc);
    this.ring = ring;
  }

  /** Stand it across the pipe at s (or hide it: s = null). */
  place(s) {
    if (s == null) { this.g.visible = false; return; }
    const f = frameAt(s);
    this.g.position.copy(f.C).addScaledVector(f.U, -1.2);
    this.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.T.clone().negate());
    this.g.visible = true;
  }

  update(time) {
    if (!this.g.visible) return;
    this.uni.uTime.value = time;
    this.ring.material.color.setHSL(0.5 + Math.sin(time * 2) * 0.08, 1, 0.7);
  }
}
