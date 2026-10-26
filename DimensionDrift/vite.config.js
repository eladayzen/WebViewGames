import { defineConfig } from 'vite';

// Plain Vite, deliberately. The GoBalance SDK serves this folder over a real
// local HTTP server (GOBALANCE_SDK.md, "How it actually works"), never file://,
// so the default base ('/'), real ES-module output and normal hashed multi-file
// assets are all correct and none of the file:// era workarounds apply.
//
// `public/` is the whole reason this port needed no asset-URL rewriting. Vite
// serves it at the site root, which is exactly what the SDK's server does with
// the game folder -- so `/models/rider.glb` and `/audio/theme.mp3` resolve to
// the same bytes in `npm run dev`, in `vite preview` and on a device, with
// nothing path-conditional at runtime. That identity is the property carve's
// hand-written build.mjs existed to guarantee; here it is free.
export default defineConfig({
  define: {
    // Stamped onto the title screen. Answering "is this actually the build I
    // just sent?" by looking at the screen is worth four lines; answering it by
    // inference has cost this codebase far more.
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
    // 1.6 Mpx -- the fleet's only device-validated pixel budget, inherited from
    // carve's GoBalance target rather than re-derived. `?budget=` still wins.
    __BUDGET_DEFAULT__: '1.6',
  },
});
