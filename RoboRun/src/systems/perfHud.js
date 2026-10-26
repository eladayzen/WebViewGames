// A frame-cost readout you can see ON THE DEVICE.
//
// WHY THIS EXISTS. The iPad is slow and the desktop is not, so every number that
// matters has to be read where the problem is. Safari's Web Inspector can do it
// over a cable, but you cannot stand on a balance board and watch a laptop, and
// tethering changes the iPad's thermal behaviour. This draws the numbers on the
// glass instead.
//
// HOW TO OPEN IT. Add ?perf=1 to the URL. That is deliberate rather than a
// gesture: gestures on a touchscreen fight the game's own input, and a query
// param cannot be triggered by accident in a shipped build.
//
// THE HEADLINE NUMBER IS PIXELS, NOT FPS. FPS tells you that it is slow; pixels
// tell you why. A capped devicePixelRatio does not cap pixels, because a tablet's
// logical viewport is larger than a phone's -- so a DPR of 2 that costs 1.3M
// pixels on a phone costs 3.1M on an iPad, on a slower GPU. That ratio is the
// whole diagnosis, and it is the first line of this panel.

const QS = new URLSearchParams(location.search);

/** Sampled, not per-frame: reading layout every frame is itself a frame cost. */
const REDRAW_MS = 250;

/**
 * How often a sample is shipped to the collector on the Mac.
 *
 * Far slower than the on-screen redraw on purpose. The panel is for the person
 * holding the device and wants to feel live; the collector is for comparing
 * devices afterwards and wants not to be a source of frame cost itself.
 */
const REPORT_MS = 3000;

/** Where the collector listens. Same host that served the page, fixed port. */
const COLLECTOR = `http://${location.hostname}:5300/s`;

/** Frames kept for the rolling average. ~1s at 60fps, ~2s at 30. */
const WINDOW = 60;

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas  the drawing surface to measure
 * @param {() => string[]} [opts.probe]    extra lines (draw calls, triangles...)
 * @param {string} [opts.label]            which game this is
 */
export function installPerfHud({ canvas, probe, label = 'game' } = {}) {
  if (QS.get('perf') !== '1') return { frame() {}, mark() {} };

  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'z-index:2147483647',
    'font:11px/1.35 ui-monospace,Menlo,monospace',
    'background:rgba(8,8,10,.82)', 'color:#e8e8e6',
    'padding:6px 8px', 'margin:0',
    'white-space:pre', 'pointer-events:none',
    'border-bottom-right-radius:6px',
    // A tablet held at arm's length in a bright room is the viewing condition.
    'text-shadow:0 1px 0 #000',
  ].join(';');
  document.body.appendChild(box);

  const times = [];
  /**
   * Time spent inside OUR per-frame work, as opposed to the whole frame.
   *
   * This is the split that separates the two worlds a slow frame can live in:
   *
   *   js ~= frame   -> we are the cost. Look at the game's own code.
   *   js << frame   -> the time is going somewhere we do not control --
   *                    GPU wait, compositing, vsync. No amount of JS tuning
   *                    will move it, and the fix is to ask the GPU for less.
   *
   * Without it, a 39ms frame is just a number and every explanation for it
   * sounds equally plausible -- which is exactly how a day gets spent.
   */
  const jsTimes = [];
  let markedAt = 0;
  let last = performance.now();
  let worst = 0;
  let painted = 0;
  let reported = 0;
  // Worst frame since the last REPORT, kept separately: the on-screen worst
  // resets every 250ms so the panel stays readable, but a sample that only ever
  // saw a quarter second would hide exactly the stutters we are hunting.
  let worstSinceReport = 0;

  // Reported once -- this does not change mid-run, and re-reading it every sample
  // is the kind of thing that makes a perf tool cost what it measures.
  const screenLine = `${label}  screen ${screen.width}x${screen.height}`;

  function redraw() {
    const n = times.length;
    const avg = n ? times.reduce((a, b) => a + b, 0) / n : 0;
    const fps = avg ? 1000 / avg : 0;

    // THE number: what the GPU actually fills, per frame.
    const bw = canvas ? canvas.width : 0;
    const bh = canvas ? canvas.height : 0;
    const mpx = (bw * bh) / 1e6;

    const cssW = canvas ? Math.round(canvas.clientWidth) : 0;
    const cssH = canvas ? Math.round(canvas.clientHeight) : 0;

    const jsAvg = jsTimes.length ? jsTimes.reduce((a, b) => a + b, 0) / jsTimes.length : 0;
    const lines = [
      screenLine,
      `${mpx.toFixed(2)} Mpx   ${bw}x${bh}`,
      `css ${cssW}x${cssH}  dpr ${(window.devicePixelRatio || 1).toFixed(2)}`,
      `${fps.toFixed(1)} fps  avg ${avg.toFixed(1)}ms  worst ${worst.toFixed(0)}ms`,
      `js ${jsAvg.toFixed(1)}ms  =  ${avg ? Math.round((jsAvg / avg) * 100) : 0}% of frame`,
    ];
    if (probe) {
      try { lines.push(...probe()); } catch { /* a probe must never break the run */ }
    }
    box.textContent = lines.join('\n');

    worst = 0;
  }

  /**
   * Ship one sample to the Mac. Fire-and-forget in the strongest sense: a
   * collector that is not running, or a network that drops, must cost the run
   * nothing and must never surface an error to the player.
   */
  function report() {
    const n = times.length;
    const avg = n ? times.reduce((a, b) => a + b, 0) / n : 0;
    const jsAvg = jsTimes.length ? jsTimes.reduce((a, b) => a + b, 0) / jsTimes.length : 0;
    const bw = canvas ? canvas.width : 0;
    const bh = canvas ? canvas.height : 0;
    let extra = '';
    if (probe) { try { extra = probe().join('  '); } catch { /* ignore */ } }

    const body = JSON.stringify({
      label,
      screen: `${screen.width}x${screen.height}`,
      backing: `${bw}x${bh}`,
      mpx: (bw * bh) / 1e6,
      dpr: window.devicePixelRatio || 1,
      css: canvas ? `${Math.round(canvas.clientWidth)}x${Math.round(canvas.clientHeight)}` : '',
      fps: avg ? 1000 / avg : 0,
      avgMs: avg,
      jsMs: jsAvg,
      worst: worstSinceReport,
      extra,
    });
    worstSinceReport = 0;

    try {
      // sendBeacon does not block the frame and survives the page going away,
      // which matters because "it got slow and I closed it" is a real sample.
      //
      // text/plain, NOT application/json, and that is not cosmetic. The page is
      // served from one port and the collector listens on another, so every one
      // of these is cross-origin; application/json is not a CORS-safelisted
      // content type, so it forces a preflight, and sendBeacon cannot preflight.
      // It just returns false and the sample vanishes without an error anywhere.
      // The collector parses the body itself and never reads the header.
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      if (!navigator.sendBeacon || !navigator.sendBeacon(COLLECTOR, blob)) {
        fetch(COLLECTOR, { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch { /* never break a run over telemetry */ }
  }

  /** Call at the TOP of the per-frame work, before updating or drawing. */
  function mark() { markedAt = performance.now(); }

  /** Call once per rendered frame, as late in the frame as you can. */
  function frame() {
    const now = performance.now();
    if (markedAt) {
      const js = now - markedAt;
      if (js >= 0 && js < 1000) {
        jsTimes.push(js);
        if (jsTimes.length > WINDOW) jsTimes.shift();
      }
      markedAt = 0;
    }
    const dt = now - last;
    last = now;
    // Ignore the first frame and any backgrounding gap -- a 4000ms "frame" is not
    // a frame, and one of them poisons the average for a full second.
    if (dt > 0 && dt < 1000) {
      times.push(dt);
      if (times.length > WINDOW) times.shift();
      if (dt > worst) worst = dt;
      if (dt > worstSinceReport) worstSinceReport = dt;
    }
    if (now - painted > REDRAW_MS) { painted = now; redraw(); }
    if (now - reported > REPORT_MS) { reported = now; report(); }
  }

  redraw();
  return { frame, mark };
}
