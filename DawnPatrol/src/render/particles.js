// A lightweight custom emitter over additive sprites, with a hard global cap
// and oldest-first eviction (§9.1).
//
// Spray, foam burst, bubbles and the tumble splash are PARTICLE SYSTEMS, NOT
// AUTHORED SHEETS (§9.6 rule 3, §11). Nothing in this game requires a
// hand-drawn animation sequence.
//
// Everything is pooled: nothing allocates per-spawn in the loop.

import { Sprite, Texture } from 'pixi.js';
import { DESIGN_W, DESIGN_H } from '../data/tuning.js';

import { KINDS } from './particleKinds.js';

export class ParticleField {
  constructor(cap = 300) {
    this.cap = cap;
    this.items = [];
    this.host = null;
    this.textures = [Texture.WHITE, Texture.WHITE, Texture.WHITE];
    this._cursor = 0;
  }

  attach(host, spray, foam, bubble) {
    this.host = host;
    this.textures = [spray, foam, bubble];
    for (let i = 0; i < this.cap; i++) {
      const s = new Sprite(this.textures[0]);
      s.anchor.set(0.5, 0.5);
      s.visible = false;
      s.blendMode = 'add';
      host.addChild(s);
      this.items.push({ s, life: 0, age: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, size: 1, kind: 0, spin: 0, tintA: 1 });
    }
  }

  clear() {
    for (const p of this.items) { p.life = 0; p.s.visible = false; }
  }

  /** Oldest-first eviction: the cursor simply wraps. */
  _take() {
    const p = this.items[this._cursor];
    this._cursor = (this._cursor + 1) % this.items.length;
    return p;
  }

  emit(kind, x, y, count, opts = {}) {
    if (!this.host) return;
    for (let i = 0; i < count; i++) {
      const p = this._take();
      p.kind = kind;
      p.s.texture = this.textures[kind] || Texture.WHITE;
      p.life = (opts.life || 0.6) * (0.7 + Math.random() * 0.6);
      p.age = 0;
      p.x = x + (Math.random() - 0.5) * (opts.spread || 24);
      p.y = y + (Math.random() - 0.5) * (opts.spread || 24) * 0.5;
      const sp = opts.speed || 220;
      const ang = (opts.angle ?? Math.PI) + (Math.random() - 0.5) * (opts.cone || 1.2);
      p.vx = Math.cos(ang) * sp * (0.5 + Math.random());
      p.vy = Math.sin(ang) * sp * (0.5 + Math.random());
      p.g = opts.gravity ?? 620;
      p.size = (opts.size || 34) * (0.6 + Math.random() * 0.8);
      p.spin = (Math.random() - 0.5) * 6;
      p.tintA = opts.alpha ?? 0.85;
      p.s.tint = opts.tint ?? 0xffffff;
      p.s.blendMode = opts.blend || 'add';
      p.s.visible = true;
    }
  }

  update(dt) {
    for (const p of this.items) {
      if (p.life <= 0) continue;
      p.age += dt;
      if (p.age >= p.life) { p.life = 0; p.s.visible = false; continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw() {
    for (const p of this.items) {
      if (p.life <= 0) continue;
      const k = p.age / p.life;
      const s = p.s;
      s.x = p.x;
      s.y = p.y;
      const nat = s.texture.height || 32;
      s.scale.set((p.size * (1 - k * 0.45)) / nat);
      s.alpha = p.tintA * (1 - k) * (1 - k);
      s.rotation += p.spin * 0.016;
    }
  }
}

export { KINDS, DESIGN_W, DESIGN_H };
