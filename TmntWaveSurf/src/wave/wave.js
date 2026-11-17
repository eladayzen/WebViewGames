// The wave: a procedural Three.js toon wave with the barrel break, sky and ink
// drawn in one post pass. Ported from the prototype's level-1.html, which ran in
// an iframe and talked to the gameplay page through window globals. Here it is a
// module: the game loop calls update(t, heightOnFace) once per frame and gets
// back the rider point, the riding rail, the curtain arc and the crest line.
//
// SHAPE, BREAK, PALETTE AND TIMING ARE THE PROTOTYPE'S, line for line. What
// changed is plumbing only:
//   * layout(W, H) re-runs the camera fit and the per-column crest fit, so the
//     wave survives a resize (the prototype computed both once, at load).
//   * the Ooze Street palette is a runtime switch -- two post materials, one with
//     the OOZE define, swapped on the full-screen quad -- instead of a second page.
//   * meshes the prototype built but kept invisible (the 3D curtain ribbon, the
//     tumbling foam balls, the capsule rider) are gone; only the rider's position
//     was ever used, so it is kept as a point.
//   * the per-frame 1-pixel readPixels (a GPU sync used for timing) is gone.
import * as THREE from 'three';

const NX = 200, NT = 96, XW = 64, X0 = -30;
const PEEL_X = -6;             // where the lip is fully pitching
const RIDER_X = PEEL_X + 2.0;
const SEA_DROP = 0.12;         // whole sea line sits this much lower than the ref11 profile
const PROFILE_S = 0.3;
const ARCH_X = 0.205, ARCH_LIFT = 0.035;   // barrel break: apex x, and how far the lip rises above the shoulder

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t, D2R = Math.PI / 180;

function stageAt(x, time) {    // 0 = unbroken shoulder, 1 = pitching barrel, >1 = closed-out
  const wob = 0.8 * Math.sin(time * 1.0 + x * 0.2);
  return THREE.MathUtils.clamp((PEEL_X + 34 + wob - x) / 34, 0, 1.25);
}

// ---------- reference crest (ref11), in screen fractions (xf from left, yf from top) ----------
function yTopDyn(xf, t) {   // live crest = reference mean + breathing shoulder + slow swells running right-to-left
  const bump = ss(0.17, 0.24, xf) * (1 - ss(0.27, 0.58, xf)); let y = 0.29 - 0.07 * bump * (1 + 0.18 * Math.sin(6.2832 * t / 4.6));
  y += (0.011 * Math.sin(6.2832 * (xf / 0.55 + t / 5.2)) + 0.007 * Math.sin(6.2832 * (xf / 0.31 + t / 3.6) + 1.3)) * ss(0.15, 0.22, xf);
  return y + (0.25 - y) * (1 - ss(0.15, 0.19, xf)) + SEA_DROP;
}
function yTopRef(xf) { const bump = ss(0.17, 0.24, xf) * (1 - ss(0.27, 0.58, xf)); const y = 0.29 - 0.07 * bump; return y + (0.25 - y) * (1 - ss(0.15, 0.19, xf)) + SEA_DROP; }

const ARCH = `
uniform vec2 uApex, uBase, uShoulder; uniform float uAsp;
const float SEN = 2.6;
// signed distance (height units, >0 = outside/above-left of the arch), arc param s (0 apex .. 1 foot), u (>0 left of apex)
void archSpace(vec2 f, out float d, out float s, out float u){
  float rxL=(uApex.x-uBase.x)*uAsp, rxR=0.15*uAsp, ry=uBase.y-uApex.y;
  float dx=(uApex.x-f.x)*uAsp, dy=uBase.y-f.y;
  float rx = dx>0. ? rxL : rxR;
  u = dx/rx;
  if(dx < 0.){   // right of the apex: hump from the apex down onto the shoulder crest
    float k = smoothstep(0., uShoulder.x*uAsp, -dx);
    float yR = mix(uApex.y, uShoulder.y, k);
    d = yR - f.y; s = 0.; u = -k; return;
  }
  float au=abs(u), av=max(dy/ry,1e-4);
  float r=pow(pow(au,SEN)+pow(av,SEN),1./SEN);
  vec2 g=vec2(pow(au,SEN-1.)/rx, pow(av,SEN-1.)/ry)*pow(r,1.-SEN);
  d=(r-1.)/max(length(g),1e-3);
  s=atan(max(u,0.),av)/1.5708;
}`;
const NOISE = `
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}`;

const POST_FRAG = (ooze) => `
    ${ooze ? '#define OOZE' : ''}
    uniform sampler2D tC,tD,tN; uniform vec2 uRes; uniform float uTime,uScroll,near,far,uDay; varying vec2 vUv; ${NOISE} ${ARCH}
    float lin(float d){ float z=d*2.-1.; return 2.*near*far/(far+near-z*(far-near)); }
    float halftone(vec2 fc, float amt, float cell){ vec2 g=fc/cell; vec2 c=fract(vec2(g.x+0.5*mod(floor(g.y),2.),g.y))-0.5; return step(length(c), 0.62*sqrt(clamp(amt,0.,1.))); }
    vec3 oozeWater(vec3 c){   // cyan/blue/white water -> ooze greens / lime foam
      return vec3(c.r*0.85, max(c.g,c.b), c.b*0.18 + 0.5*min(c.r,c.b)); }
    vec3 skyOoze(vec2 uv){
      vec2 fc=gl_FragCoord.xy;
      vec3 c=mix(vec3(0.10,0.05,0.20),vec3(0.40,0.18,0.57),smoothstep(1.0,0.4,uv.y));
      c=mix(c, vec3(0.91,0.0,0.65), halftone(fc, 0.12+0.50*smoothstep(0.30,1.0,uv.y), 16.));
      float fx2=floor(uv.x*22.+uScroll*0.24); float fh=0.58+0.16*h21(vec2(fx2,5.));
      if(uv.y<fh) c=vec3(0.24,0.12,0.30);
      float bx=floor(uv.x*14.+uScroll*0.30); float bh=0.50+0.18*h21(vec2(bx,3.));
      if(uv.y<bh){ c=mix(vec3(0.16,0.09,0.20), vec3(0.30,0.14,0.18), step(0.5,h21(vec2(bx,8.))));
        vec2 wc2=vec2(uv.x*120.+uScroll*2.57, uv.y*60.); vec2 wcell=fract(wc2);
        float lit=step(0.55,h21(floor(wc2)));
        if(wcell.x>0.25&&wcell.x<0.75&&wcell.y>0.3&&wcell.y<0.75) c = lit>0. ? mix(vec3(1.,0.83,0.),vec3(0.,0.79,1.),step(0.6,h21(floor(wc2)+1.))) : vec3(0.08,0.05,0.12);
        if(abs(uv.y-bh)<0.006) c=vec3(0.05,0.02,0.08);
      }
      return c;
    }
    vec3 sky(vec2 uv){
#ifdef OOZE
      return skyOoze(uv);
#endif
      // uDay: 0 = evening (mission 2), 1 = sunny day (mission 1); blends, so a change can fade
      vec3 eve=mix(vec3(0.91,0.33,0.55),vec3(0.27,0.12,0.42),smoothstep(0.45,1.0,uv.y));
      eve=mix(eve,vec3(1.0,0.75,0.35),smoothstep(0.62,0.45,uv.y)*0.6);
      vec3 day=mix(vec3(0.80,0.94,1.0),vec3(0.24,0.62,0.96),smoothstep(0.50,1.0,uv.y));   // pale horizon -> deep blue
      vec3 c=mix(eve, day, uDay);
      // far skyline layer (~0.10 screen-widths/s), hazy, no windows
      float fx2=floor(uv.x*30.+uScroll*0.33); float fh=0.60+0.16*h21(vec2(fx2,5.));
      if(uv.y<fh) c=mix(c, mix(vec3(0.42,0.20,0.50), vec3(0.58,0.72,0.88), uDay), 0.85);
      // near skyline layer (~0.20 screen-widths/s) with lit windows at night, sky-reflecting ones by day
      float bx=floor(uv.x*46.+uScroll*1.0); float bh=0.55+0.13*h21(vec2(bx,3.))+0.06*step(0.85,h21(vec2(bx,9.)));
      if(uv.y<bh){ c=mix(vec3(0.20,0.09,0.32), mix(vec3(0.62,0.30,0.26), vec3(0.36,0.42,0.58), step(0.5,h21(vec2(bx,8.)))), uDay);
        vec2 wc2=vec2(uv.x*184.+uScroll*4.0, uv.y*90.);
        vec2 wcell=fract(wc2);
        float lit=step(mix(0.8,0.45,uDay),h21(floor(wc2)));
        vec3 wn=mix(mix(vec3(1.,0.83,0.),vec3(0.,0.79,1.),step(0.5,h21(floor(wc2)+1.))), vec3(0.72,0.90,1.0), uDay);
        if(wcell.x>0.3&&wcell.x<0.7&&wcell.y>0.3&&wcell.y<0.7&&lit>0.) c=wn;
      }
      return c;
    }
    void main(){
      float boil=floor(uTime*8.);                       // hand-drawn line boil at 8 fps
      float jit=vn(vUv*vec2(60.,34.)+boil*7.13);
      float w=mix(0.8,2.6,jit);                         // line width wobble (px)
      vec2 px=w/uRes;
      vec2 off=(vec2(vn(vUv*40.+boil),vn(vUv*40.+boil+5.))-0.5)*1.5/uRes;
      vec2 uv=vUv+off;
      float d0=lin(texture2D(tD,uv).r);
      vec3 n0=texture2D(tN,uv).xyz*2.-1.;
      float ed=0., en=0.;
      for(int i=0;i<4;i++){
        vec2 o = i==0?vec2(px.x,0.):i==1?vec2(-px.x,0.):i==2?vec2(0.,px.y):vec2(0.,-px.y);
        float d=lin(texture2D(tD,uv+o).r); vec3 n=texture2D(tN,uv+o).xyz*2.-1.;
        ed=max(ed,abs(d-d0)/min(d,d0)); en=max(en,1.-dot(n,n0));
      }
      float ink=max(step(0.06,ed), step(0.35,en));
      vec3 col;
      float raw=texture2D(tD,vUv).r;
      bool skyPix = raw>0.9999 && ink<0.5;
      vec2 F=vec2(vUv.x, 1.-vUv.y); float asp=uRes.x/uRes.y;
      float aD,aS,aU; archSpace(F,aD,aS,aU);
      bool inArch = aD<0. && F.y<uBase.y && aU>-1.;
      if(skyPix && !inArch){ col=sky(vUv); }
      else {
        col = skyPix ? vec3(0.30,0.80,0.88) : texture2D(tC,vUv).rgb;      // lip water fills the hood above the mesh crest
        if(skyPix) ink = 0.;
        float yf=F.y;
        // ---- under the hood: dark hollow in hard cel steps, following the arch ----
        if(inArch){
          float dd=-aD + 0.018*(fbm(vec2(aS*6. - uTime*0.5, -aD*14.))-0.5);   // hand-painted wobble on the hollow's cel bands
          float wR = aU>0. ? 1. : pow(clamp(1.+aU,0.,1.),1.6);   // right of the apex the hollow fades out along the shoulder
          vec3 t0=vec3(0.02,0.12,0.27), t1=vec3(0.03,0.27,0.45), t2=vec3(0.05,0.45,0.60);
          if(dd<0.16){
            vec3 tc = dd<0.03 ? t0 : (dd<0.08 ? t1 : mix(t2, col, 0.25));
            col = mix(col, tc, wR); ink *= 1.-wR;
          }
          // falling light streaks through the thin lip (upper hood only)
          float sx = F.x*asp*38.; float cellx=floor(sx);
          float sh = step(0.55,h21(vec2(cellx,2.)))*step(abs(fract(sx)-0.5),0.12)*step(0.03,dd)*step(dd,0.15)
                     *(1.-smoothstep(0.04,0.22,F.y-uApex.y)) * step(0.4, vn(vec2(cellx, F.y*6.-uTime*1.5)))*wR;
          col = mix(col, vec3(0.42,0.86,0.97), sh*0.55);
        }
        float bf = yf - (0.955 - 0.012*vn(vec2(vUv.x*20. + uTime*0.9, 2.)));   // white foam along the bottom edge
        if(bf > 0.) col = mix(vec3(0.98,0.99,1.0), vec3(0.75,0.92,0.97), step(0.6, vn(vec2(vUv.x*28. + uTime*0.9, yf*30.))));
        float lum=dot(col,vec3(0.3,0.59,0.11));
        // cross-hatch in dark tones
        vec2 fc=gl_FragCoord.xy;
        float h1=step(0.7,fract((fc.x+fc.y)/7.)), h2=step(0.7,fract((fc.x-fc.y)/7.));
        float hn=vn(fc/14.+boil);
#ifdef OOZE
        col = oozeWater(col); lum=dot(col,vec3(0.3,0.59,0.11));
        col = mix(col, col*0.45+vec3(0.03,0.0,0.06), halftone(fc, (0.50-lum)*2.2, 9.));
#else
        if(lum<0.30) col=mix(col,vec3(0.07,0.04,0.14),h1*(inArch?0.25:0.55)*step(0.35,hn));
        if(lum<0.18) col=mix(col,vec3(0.07,0.04,0.14),h2*0.5);
#endif
      }
      // ---- the pitching lip: thick white band riding the outside of the arch, pouring down ----
      if(F.y < uBase.y + 0.02 && aU > -1.){
        float th = aU>=0. ? mix(0.055, 0.016, pow(aS,0.8)) : 0.055*(1.-smoothstep(0.,0.9,-aU));
        float al = aU>=0. ? aS*1.9 : aU*0.25;                       // ~arc length from the apex (height units)
        float pc = al*(1. + 0.18*max(al,0.)) - uTime*0.42;          // flows DOWN the arc; static warp only (no time-growing term)
        float cell = floor(pc*15.), fr = fract(pc*15.);
        float spike = (0.0025 + 0.0035*vn(vec2(pc*3.0, 1.3))) * (1.-0.75*aS) * step(-0.75,aU);   // smooth, rounded foam wobble on the outer edge (the old sawtooth teeth read as a dragon's tail)
        float outer = th + spike*step(0.001,th);
        float lw = 2.4/uRes.y;
        if(aD >= -lw*0.5 && aD < outer){
          float rel = clamp(aD/max(th,1e-3),0.,1.);
          vec3 bc = vec3(0.97,0.99,1.0);
          float b = fbm(vec2(pc*7., rel*2.2 + cell*0.0));
          bc = b>0.66 ? vec3(0.40,0.52,0.66) : (b>0.60 ? vec3(0.66,0.78,0.88) : bc);   // grey-blue shadowed foam blobs
          if(rel < 0.20) bc = vec3(0.70,0.93,0.99);                    // translucent inner rim
#ifdef OOZE
          bc = oozeWater(bc);
#endif
          col = bc; ink = 0.;
        }
        float eo = abs(aD - outer);                                    // ink on the outer (torn) edge
        if(th > 0.002) ink = max(ink, smoothstep(lw, lw*0.35, eo) * step(-lw, aD));
      }
      // ---- spray thrown off the top of the lip ----
      for(int i=0;i<20;i++){
        float fi=float(i), per=0.9+0.7*h21(vec2(fi,3.1)), o=h21(vec2(fi,7.3));
        float ph=fract(uTime/per+o), cyc=floor(uTime/per+o), sd=h21(vec2(fi,cyc));
        vec2 p0=vec2((uApex.x + (-0.035+0.11*sd))*asp, uApex.y + 0.004 - 0.05*(1.-smoothstep(-0.03,0.03,-0.035+0.11*sd-0.07)) );
        vec2 v0=vec2(-0.05-0.20*h21(vec2(fi,cyc+3.)), -0.22-0.25*h21(vec2(fi,cyc+5.)));
        float tt=ph*per*0.75; vec2 pp=p0+v0*tt+vec2(0.,0.85)*tt*tt*0.5;
        float rad=(0.0035+0.0065*h21(vec2(fi,cyc+9.)))*(1.-ph*0.7);
        float dq=length(vec2(F.x*asp,F.y)-pp);
        if(dq<rad){ vec3 wc=vec3(0.97,0.99,1.0);
#ifdef OOZE
          wc=oozeWater(wc);
#endif
          col = dq > rad-1.5/uRes.y ? vec3(0.07,0.04,0.12) : wc; ink=0.; }
      }
      col=mix(col,vec3(0.07,0.04,0.12),ink);
      // paper grain
      float g=h21(gl_FragCoord.xy+boil)*0.08+vn(gl_FragCoord.xy/3.)*0.06;
      col*=0.93+g;
      gl_FragColor=vec4(col,1.);
    }`;

export const THEMES = ['toon', 'ooze'];

/**
 * @param {HTMLCanvasElement} canvas  the WebGL canvas (under the gameplay canvas)
 */
export function createWave(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6)); { const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(-4, 8, 6); scene.add(dl); }
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.5, 200);

  let _T = 0;
  const heightAt = (s, x = 0) => 6.0 + 1.6 * Math.min(s, 1) + 0.25 * Math.sin(x * 0.33 - _T * 1.2) + 0.1 * Math.sin(x * 0.85 + _T * 1.7);

  // profile: integrate heading angle phi along arc length; dir = (-cos phi, sin phi) in (z,y)
  function buildProfile(s, Hh, out) {
    const sc = Math.min(s, 1), L = Hh * mix(2.1, 2.7, sc), dl = L / (NT - 1);
    const phiF = mix(58, 82, sc) * D2R, C = mix(-70, 215 + 15 * Math.sin(_T * 1.3), Math.pow(sc, 0.8)) * D2R, pw = mix(1.0, 1.5, sc);
    let z = 7.5, y = 0;
    for (let i = 0; i < NT; i++) {
      const t = i / (NT - 1), u = Math.max(0, (t - 0.5) / 0.5);
      const phi = phiF * ss(0, 0.55, t) + C * Math.pow(u, pw);
      out.z[i] = z; out.y[i] = y; out.phi[i] = phi;
      z += -Math.cos(phi) * dl; y += Math.sin(phi) * dl;
    }
  }
  const newProf = () => ({ z: new Float32Array(NT), y: new Float32Array(NT), phi: new Float32Array(NT) });

  // ---------- camera: match the reference composition ----------
  // rider column at 23% width, crest at ~30% from top, trough near the bottom edge, sky above the crest
  function placeCam(dx, ly, fov) { camera.fov = fov; camera.updateProjectionMatrix();
    camera.position.set(9.0 + dx, 9.0 + (ly - 3.6) * 0.6, 44.0); camera.lookAt(-1.0 + dx, ly, 2.0); camera.updateMatrixWorld(); }
  function fitCamera() {
    const RX = PEEL_X + 2.0; const s0 = stageAt(RX, 0), H0 = heightAt(s0, RX); const P = newProf();
    buildProfile(s0, H0, P); let top = 0; for (let j = 0; j < NT; j++) if (P.y[j] > P.y[top]) top = j;
    const crest = new THREE.Vector3(RX, P.y[top], P.z[top]), trough = new THREE.Vector3(RX, 0, 7.5); const jm = Math.round(NT * 0.22), mid = new THREE.Vector3(RX, P.y[jm], P.z[jm]);
    const sy = v => (1 - v.clone().project(camera).y) / 2, sx = v => (v.clone().project(camera).x + 1) / 2;
    let dx = 0, ly = 3.6, fov = 24;
    const bs = (f, lo, hi, set, inc) => { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; set(m); if ((f() > 0) === inc) hi = m; else lo = m; } set((lo + hi) / 2); };
    for (let k = 0; k < 8; k++) {
      bs(() => (sy(trough) - sy(crest)) - 0.60, 8, 70, m => { fov = m; placeCam(dx, ly, fov); }, false);
      bs(() => sy(crest) - 0.30, -20, 30, m => { ly = m; placeCam(dx, ly, fov); }, true);
      bs(() => sx(mid) - 0.24, -60, 60, m => { dx = m; placeCam(dx, ly, fov); }, false);
    }
  }

  const colH = new Float32Array(NX), colS = new Float32Array(NX), colYb = new Float32Array(NX), colSx = new Float32Array(NX), colHd = new Float32Array(NX);
  function fitColumns() { // fit each column's height so its silhouette top lands on the reference crest line (camera is fixed)
    const P = newProf(), pv = new THREE.Vector3();
    for (let i = 0; i < NX; i++) {
      const x = X0 + (i / (NX - 1)) * XW; let H = 7, sxTop = 0;
      for (let it = 0; it < 8; it++) {
        buildProfile(PROFILE_S, H, P);
        let syTop = 1e9; for (let j = 0; j < NT; j++) { pv.set(x, P.y[j], P.z[j]).project(camera); const yy = (1 - pv.y) / 2; if (yy < syTop) { syTop = yy; sxTop = (pv.x + 1) / 2; } }
        pv.set(x, 0, 7.5).project(camera); const yb = (1 - pv.y) / 2;
        H *= Math.max(0.3, Math.min(3, (yb - yTopRef(sxTop)) / Math.max(0.02, yb - syTop)));
      }
      colH[i] = H; colS[i] = sxTop < 0.185 ? 2.0 : PROFILE_S; colSx[i] = sxTop; { pv.set(x, 0, 7.5).project(camera); colYb[i] = (1 - pv.y) / 2; }   // left of the curl = churning tube interior
    }
  }
  function liveHeights(t) {   // screen height of a column scales ~linearly with its world height
    for (let i = 0; i < NX; i++) colHd[i] = colH[i] * (colYb[i] - yTopDyn(colSx[i], t)) / Math.max(0.02, colYb[i] - yTopRef(colSx[i]));
  }
  const colHAt = x => { const f = Math.min(NX - 1, Math.max(0, (x - X0) / XW * (NX - 1))), i0 = Math.floor(f), i1 = Math.min(NX - 1, i0 + 1); return colHd[i0] + (colHd[i1] - colHd[i0]) * (f - i0); };

  function makeGrid(nx, nt) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(nx * nt * 3), aP = new Float32Array(nx * nt * 2);
    const idx = [];
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nt - 1; j++) {
      const a = i * nt + j, b = (i + 1) * nt + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aProf', new THREE.BufferAttribute(aP, 2));
    return g;
  }
  const faceGeo = makeGrid(NX, NT);
  const NB = 24;
  const backGeo = makeGrid(NX, NB);

  const uniforms = { uTime: { value: 0 }, uScroll: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) },
    uApex: { value: new THREE.Vector2(0.205, 0.27) }, uShoulder: { value: new THREE.Vector2(0.11, 0.30) }, uBase: { value: new THREE.Vector2(0.03, 0.975) }, uAsp: { value: 16 / 9 } };

  const waterMat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec2 aProf; varying vec2 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vP=aProf; vN=normalize(normalMatrix*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform float uTime,uScroll; uniform vec2 uScreen; varying vec2 vP; varying vec3 vN; varying vec3 vW; ${NOISE} ${ARCH}
      void main(){
        vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
        float t=vP.x, s=vP.y;
        vec3 L=normalize(vec3(-0.4,0.8,0.6));
        float d=dot(n,L);
        // three hard bands
        float band = d>0.55?2.:(d>0.05?1.:0.);
        vec3 deep=vec3(0.03,0.36,0.47), mid=vec3(0.0,0.62,0.74), lite=vec3(0.36,0.88,0.90);
        vec3 shade=vec3(0.16,0.10,0.36);   // purple hard shadow
        // vertical ramp: face gets lighter/translucent toward lip
        vec3 base = mix(deep, mid, smoothstep(0.15,0.55,t));
        base = mix(base, lite, step(0.62,t)*0.6);
        vec3 col = band>1.5? mix(base,lite,0.45) : band>0.5? base : mix(base,shade,0.55);
        if(!gl_FrontFacing) col = mix(col, shade, 0.35);
        float yfS = 1. - gl_FragCoord.y/uScreen.y, xfS = gl_FragCoord.x/uScreen.x;
        float aD0,aS0,aU0; archSpace(vec2(xfS,yfS),aD0,aS0,aU0);
        if(aD0 > 0.0 && aU0 > 0.){   // outside the arch (left of the falling lip): churning whitewater
          float fd = pow(max(yfS-0.2,0.), 0.6)*7.;   // fall coordinate: grows downward, compressed low -> blobs accelerate + stretch as they drop
          float ch = fbm(vec2(vW.x*0.9 + uTime*0.5, fd - uTime*2.4));   // pour DOWN over the pipe
          col = ch > 0.60 ? vec3(0.97,0.99,0.99) : ch > 0.47 ? vec3(0.62,0.90,0.96) : vec3(0.18,0.66,0.82);
        }
        // right-to-left flow: slow at the crest, fast at the trough (multiplier on the base scroll)
        float u = vW.x + uScroll*1.1;
        float row = floor(t*38.), tq = (row+0.5)/38.;
        float uq = vW.x + uScroll*mix(4.6, 1.1, pow(smoothstep(0.03, 0.85, tq), 1.5));
        // horizontal streaks that scroll (sells speed)
        float st = vn(vec2(uq*mix(0.18,0.35,tq), t*38.));
        col = mix(col, lite, step(0.83, st)*step(t,0.6)*0.7);
        // thin speed streaks on the lower face
        float srow = floor(t*120.); float sr = fract(sin(srow*12.9898)*43758.5453);
        float uqs = vW.x + uScroll*mix(5.0, 1.2, pow(smoothstep(0.03, 0.85, srow/120.), 1.5));
        float sxx = fract(uqs*0.045 + sr*13.);
        col = mix(col, mix(lite, vec3(1.), 0.4), step(0.78, sr)*step(sxx, 0.25)*smoothstep(0.5, 0.1, t)*step(0.02,t));
        // foam flecks whipping past
        vec2 fg = vec2(uqs*0.9, t*55.); vec2 fcell = floor(fg), ff = fract(fg)-0.5;
        float fleck = step(length(ff*vec2(0.5,2.2)), 0.3)*step(0.88, h21(fcell+17.))*smoothstep(0.45,0.08,t);
        col = mix(col, vec3(0.95,0.99,0.96), fleck);
        // lip foam: noise threshold, grows with stage
        float fz = fbm(vec2(u*0.8 + uTime*0.3, t*9.0 - uTime*1.0));
        float lipF = smoothstep(0.93,1.0,t) * 0.55;   // thin broken foam cap on the crest (reference)
        float foam = step(1.0 - lipF, fz*0.9+0.25);
        // whitewater near trough where closed out
        float ww = step(1.0, s) * smoothstep(0.35,0.0,t) ;
        foam = max(foam, step(0.45, fbm(vec2(u*0.5, t*6.-uTime))*ww*1.6));
        vec3 foamC = d>0.2? vec3(0.97,0.98,0.95) : vec3(0.62,0.85,0.95);
        col = mix(col, foamC, foam);
        gl_FragColor=vec4(col,1.);
      }`
  });
  scene.add(new THREE.Mesh(faceGeo, waterMat));
  scene.add(new THREE.Mesh(backGeo, waterMat));

  // flat foreground water (shore side) with scrolling foam lines
  const seaGeo = new THREE.PlaneGeometry(140, 60, 1, 1); seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.ShaderMaterial({ uniforms, vertexShader: `varying vec3 vW; void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uScroll; varying vec3 vW; ${NOISE}
      void main(){ float zl = floor(vW.z/1.5); float u=vW.x+uScroll*(4.2 + 0.25*mod(zl,3.)); vec3 c=vec3(0.03,0.36,0.47);
        float f=fbm(vec2(u*0.25, vW.z*0.9));
        c=mix(c,vec3(0.0,0.62,0.74),step(0.62,f)); c=mix(c,vec3(0.85,0.95,0.97),step(0.74,f));
        gl_FragColor=vec4(c,1.);} ` });
  const sea = new THREE.Mesh(seaGeo, seaMat); sea.position.set(0, -0.02, 30); scene.add(sea);

  // ---------- post: normal+depth edges with jittered ink, paper grain, hatch ----------
  let rtColor = null, rtNormal = null;
  const normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  const postUniforms = { tC: { value: null }, tD: { value: null }, tN: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uDay: { value: 0 }, uScroll: uniforms.uScroll, uApex: uniforms.uApex, uBase: uniforms.uBase, uShoulder: uniforms.uShoulder, uAsp: uniforms.uAsp, near: { value: camera.near }, far: { value: camera.far } };
  const postVert = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
  const postMats = {
    toon: new THREE.ShaderMaterial({ uniforms: postUniforms, vertexShader: postVert, fragmentShader: POST_FRAG(false), depthTest: false, depthWrite: false }),
    ooze: new THREE.ShaderMaterial({ uniforms: postUniforms, vertexShader: postVert, fragmentShader: POST_FRAG(true), depthTest: false, depthWrite: false }),
  };
  const postScene = new THREE.Scene(); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMats.toon);
  postScene.add(postQuad);
  let theme = 'toon';

  // ---------- update geometry ----------
  const tmpP = newProf();
  const riderPos = new THREE.Vector3(), railW0 = new THREE.Vector3(), railW1 = new THREE.Vector3(), pv = new THREE.Vector3();
  function updateWave(time, heightOnFace) {
    _T = time; liveHeights(time);
    const fp = faceGeo.attributes.position.array, fa = faceGeo.attributes.aProf.array;
    const bp = backGeo.attributes.position.array, ba = backGeo.attributes.aProf.array;
    for (let i = 0; i < NX; i++) {
      const x = X0 + (i / (NX - 1)) * XW;
      const s = colS[i], Hh = colHd[i];   // live reference crest
      buildProfile(PROFILE_S, Hh, tmpP);
      let topI = 0;
      for (let j = 0; j < NT; j++) {
        const k = (i * NT + j);
        fp[k * 3] = x; fp[k * 3 + 1] = tmpP.y[j]; fp[k * 3 + 2] = tmpP.z[j];
        fa[k * 2] = j / (NT - 1); fa[k * 2 + 1] = s;
        if (tmpP.y[j] > tmpP.y[topI]) topI = j;
      }
      // back slope: from just behind the vertical point of the face down to the sea
      let vI = 0; for (let j = 0; j < NT; j++) { if (tmpP.phi[j] <= Math.PI / 2) vI = j; }
      const cz = tmpP.z[vI] - 0.25, cy = tmpP.y[vI] * 0.98;
      const topY = Math.max(cy, tmpP.y[topI] - 0.3);
      for (let j = 0; j < NB; j++) {
        const t = j / (NB - 1), k = i * NB + j;
        bp[k * 3] = x; bp[k * 3 + 1] = topY * (0.5 + 0.5 * Math.cos(t * Math.PI)); bp[k * 3 + 2] = cz - t * Hh * 2.5;
        ba[k * 2] = 0.55 - 0.5 * t; ba[k * 2 + 1] = 0;
      }
    }
    faceGeo.attributes.position.needsUpdate = true; faceGeo.attributes.aProf.needsUpdate = true;
    backGeo.attributes.position.needsUpdate = true; backGeo.attributes.aProf.needsUpdate = true;
    faceGeo.computeVertexNormals(); backGeo.computeVertexNormals();
    // rider: sample profile at RIDER_X
    const Hh = colHAt(RIDER_X); buildProfile(PROFILE_S, Hh, tmpP);
    // ride range: trough .. the visible crest (highest point on screen before the lip turns over)
    let vI = 0; { let best = 1e9;
      for (let j = 0; j < NT; j++) { if (tmpP.phi[j] > 1.9) break; pv.set(RIDER_X, tmpP.y[j], tmpP.z[j]).project(camera); if (-pv.y < best) { best = -pv.y; vI = j; } } }
    const railPoint = (hh, out) => { const ff = 0.04 + hh * (vI / (NT - 1) - 0.04), jj = ff * (NT - 1), k0 = Math.floor(jj), k1 = Math.min(NT - 1, k0 + 1), aa = jj - k0;
      const zz = tmpP.z[k0] * (1 - aa) + tmpP.z[k1] * aa, yy = tmpP.y[k0] * (1 - aa) + tmpP.y[k1] * aa, pp = tmpP.phi[k0] * (1 - aa) + tmpP.phi[k1] * aa;
      return out.set(RIDER_X, yy + Math.cos(pp) * 0.12, zz + Math.sin(pp) * 0.12); };
    railPoint(heightOnFace, riderPos); railPoint(0, railW0); railPoint(1, railW1);
  }

  let W = 0, H = 0;
  /** Size everything to the viewport. The camera and the column fit both depend
   *  on the aspect ratio, so they are re-run here rather than once at load. */
  function layout(w, h) {
    W = Math.max(1, Math.round(w)); H = Math.max(1, Math.round(h));
    renderer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    // The prototype fitted once at load, with the wave clock at 0; buildProfile
    // and heightAt both read the clock, so pin it to 0 for a refit too.
    const keepT = _T; _T = 0; fitCamera(); fitColumns(); _T = keepT;
    if (rtColor) { rtColor.depthTexture.dispose(); rtColor.dispose(); rtNormal.dispose(); }
    rtColor = new THREE.WebGLRenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H) });
    rtNormal = new THREE.WebGLRenderTarget(W, H);
    postUniforms.tC.value = rtColor.texture; postUniforms.tD.value = rtColor.depthTexture; postUniforms.tN.value = rtNormal.texture;
    postUniforms.uRes.value.set(W, H); uniforms.uScreen.value.set(W, H); uniforms.uAsp.value = W / H;
  }

  const project = (v) => { pv.copy(v).project(camera); return { x: (pv.x + 1) / 2 * W, y: (1 - pv.y) / 2 * H }; };

  /**
   * Advance the wave to time t, with the rider at heightOnFace (0 trough .. 1
   * crest), render it, and return the screen-space geometry the gameplay layer
   * draws against. Replaces the prototype's __riderScreen / __rail / __curtain /
   * __crestLine globals.
   */
  function update(t, heightOnFace) {
    uniforms.uTime.value = t; uniforms.uScroll.value = t * 9; postUniforms.uTime.value = t;
    uniforms.uApex.value.set(ARCH_X, yTopDyn(0.26, t) - ARCH_LIFT); uniforms.uShoulder.value.set(0.11, yTopDyn(ARCH_X + 0.11, t) + 0.004);   // lip apex rides above the live shoulder
    updateWave(t, heightOnFace);
    const riderScreen = project(riderPos);
    const r0 = project(railW0), r1 = project(railW1);
    const crestLine = []; for (let i = 0; i <= 40; i++) crestLine.push(yTopDyn(i / 40, _T) * H);
    const curtain = []; { const A = uniforms.uApex.value, B = uniforms.uBase.value, n = 2.6, ry = B.y - A.y;
      for (let k = 0; k <= 30; k++) { const th = k / 30 * Math.PI / 2, u = Math.pow(Math.sin(th), 2 / n), v = Math.pow(Math.cos(th), 2 / n);
        curtain.push([(A.x - u * (A.x - B.x)) * W, (B.y - v * ry) * H]); } }
    const rail = { x0: r0.x, yTrough: r0.y, x1: r1.x, yCrest: r1.y };
    renderer.setRenderTarget(rtColor); renderer.render(scene, camera);
    scene.overrideMaterial = normalMat; renderer.setRenderTarget(rtNormal); renderer.render(scene, camera); scene.overrideMaterial = null;
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    return { riderScreen, rail, curtain, crestLine };
  }

  /** 'toon' (default) or 'ooze' (Ooze Street -- the future "double energy" mode). */
  function setTheme(name) {
    if (!postMats[name]) return;
    theme = name; postQuad.material = postMats[name];
  }

  // Compile both looks up front, so the first switch to Ooze Street does not
  // stall a frame compiling a shader mid-run.
  function precompile() {
    for (const k of THEMES) { postQuad.material = postMats[k]; renderer.compile(postScene, postCam); }
    postQuad.material = postMats[theme];
    renderer.compile(scene, camera);
  }

  /** Sky time of day: 1 = sunny day, 0 = evening. Pass fade seconds to blend instead of cutting. */
  let dayTarget = 0, dayFade = 0;
  function setDay(v, fadeS = 0) { dayTarget = v; dayFade = fadeS; if (!fadeS) postUniforms.uDay.value = v; }
  function stepDay(dt) { const u = postUniforms.uDay; if (u.value !== dayTarget) { const k = dayFade > 0 ? dt / dayFade : 1;
    u.value = u.value < dayTarget ? Math.min(dayTarget, u.value + k) : Math.max(dayTarget, u.value - k); } }
  return { layout, update, setTheme, getTheme: () => theme, precompile, renderer, setDay, stepDay };
}
