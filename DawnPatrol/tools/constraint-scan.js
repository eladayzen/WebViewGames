// STATIC SOURCE CHECKS for §9.5 rules 5 and 6 -- the two most important
// constraints in the build doc, and the two that a runtime check cannot really
// enforce.
//
//   Rule 5 -- THE ONE-AXIS RULE. No module outside /input reads a tilt vector at
//             all, and /input never references the y / forward-back component.
//             §0.2 is the most important constraint in this document and it is
//             exactly the kind of thing that gets quietly violated by a
//             well-meaning "small nudge" six weeks in.
//   Rule 6 -- THE ZERO-INPUT RULE. No keydown, pointer, touch or gesture handler
//             anywhere affects game state during riding / airborne / barrel /
//             tumbling. Screen chrome (pause, back, restart) only (§0.4).
//
// Wired into vite.config.js as a plugin, so it fails `npm run dev` and
// `npm run build` rather than being a check somebody remembers to run. Also
// runnable directly: `node tools/constraint-scan.js`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');

// Only these files may install a raw input listener at all. Everything here is
// either the one sanctioned input module or screen chrome.
const LISTENER_ALLOWLIST = [
  'input/input.js',   // the ONE lean scalar; its keyboard path is disabled under the Unity host
  'ui/hud.js',        // pause / back / restart chrome
  'ui/screens.js',    // title, drop-in, score card chrome
  'debug/instrumentation.js', // the POC-6 panel and the FAIL_MODEL toggle
  // The WebAudio one-time gesture unlock. It listens for a keydown because on
  // the board the ONLY forwarded gesture is Space/Enter, and it does nothing
  // but call ctx.resume() -- it cannot touch game state, which is what rule 6
  // is actually about. Listed here so the exception is deliberate and visible
  // rather than a hole in the scan.
  'audio/audio.js',
];

const LISTENER_RE = /addEventListener\s*\(\s*['"`](keydown|keyup|keypress|pointerdown|pointerup|pointermove|touchstart|touchend|touchmove|gesturestart|gesturechange|wheel|devicemotion|deviceorientation)['"`]/g;

const SENSOR_RE = /__gbSensor/;

function stripComments(src) {
  // Good enough for this job: block comments, then line comments. Deliberately
  // not a real parser -- the point is that a MENTION of the y axis in a comment
  // (of which this codebase has many, on purpose) is not a violation.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

export function scanSources() {
  const errors = [];
  const files = walk(SRC);

  for (const file of files) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    const raw = fs.readFileSync(file, 'utf8');
    const code = stripComments(raw);

    // -- Rule 5a: the tilt vector is read in exactly one place -------------
    const isInput = rel.startsWith('input/');
    if (!isInput && SENSOR_RE.test(code)) {
      errors.push(`[R5] ${rel} reads the tilt vector (__gbSensor). Only /input may. (§0.2, §9.5)`);
    }

    // -- Rule 5b: /input never touches the forward/back component ----------
    if (isInput) {
      const yHits = [];
      const re = /\.\s*y\b/g;
      let m;
      while ((m = re.exec(code))) {
        yHits.push(code.slice(Math.max(0, m.index - 40), m.index + 6).replace(/\s+/g, ' ').trim());
      }
      for (const hit of yHits) {
        errors.push(`[R5] ${rel} references a .y component ("...${hit}"). The forward/back tilt axis is NEVER read by this game -- not for a nudge, not for a menu, not for a debug shortcut. (§0.2, §11)`);
      }
    }

    // -- Rule 6: input listeners only where they are sanctioned ------------
    LISTENER_RE.lastIndex = 0;
    let lm;
    while ((lm = LISTENER_RE.exec(code))) {
      if (!LISTENER_ALLOWLIST.includes(rel)) {
        errors.push(`[R6] ${rel} installs a "${lm[1]}" listener. Only screen chrome and /input may handle raw input; nothing may affect game state during riding/airborne/barrel/tumbling. (§0.4, §9.5)`);
      }
    }
  }

  // -- Rule 6, the other half: the one keyboard path that does reach the
  // height model must be off whenever the Unity host is present, so on-device
  // there is no key handler affecting game state at all.
  const inputSrc = fs.readFileSync(path.join(SRC, 'input', 'input.js'), 'utf8');
  if (!/this\.keyboardEnabled\s*=\s*!window\.Unity/.test(inputSrc)) {
    errors.push('[R6] input/input.js no longer disables its desktop keyboard fallback under the Unity host. On-device that fallback would be a second input path. (§0.4, §4)');
  }

  return errors;
}

/** Vite plugin form. Fails the dev server and the production build. */
export function constraintScanPlugin() {
  return {
    name: 'dawn-patrol-constraint-scan',
    buildStart() {
      const errors = scanSources();
      if (errors.length) {
        throw new Error(
          '\n\nDawn Patrol constraint scan FAILED (§9.5 rules 5-6):\n\n'
          + errors.map((e) => '  ' + e).join('\n')
          + '\n\nThese are binding inputs from §0, not style rules.\n'
        );
      }
    },
  };
}

// Direct invocation: node tools/constraint-scan.js
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const errors = scanSources();
  if (errors.length) {
    console.error('Constraint scan FAILED:\n' + errors.map((e) => '  ' + e).join('\n'));
    process.exit(1);
  }
  console.log('Constraint scan passed (§9.5 rules 5-6).');
}
