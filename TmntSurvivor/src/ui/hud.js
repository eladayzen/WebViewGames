// THE RUN, READ AT A GLANCE.
//
// What this replaces is one line of monospace text with everything in it:
// hearts, level, xp, kills, horde size and the whole build, comma-free, in
// 15px grey. That was instrumentation -- it was written to be read while
// debugging, by someone who already knew what the numbers meant. It is the
// wrong shape for a player, and especially wrong for THIS player: the person
// on the board is standing a couple of metres back from a phone, leaning,
// and cannot read a sentence. Everything here is therefore a bar, a pip or a
// number large enough to take in without focusing.
//
// WHAT IS ON SCREEN AND WHY:
//
//   xp bar + level   the only thing the player is working toward moment to
//                    moment; it spans the top because it is the thing they
//                    should see without looking for it.
//
// WHAT IS NOT HERE ANY MORE: the health pool. It was a row of pips in this
// corner and is now drawn over the character's own head in world space --
// see HP_BAR in src/main.js. The hit FLASH is still driven from here,
// because this file is the one place that knows the count went down.
//   timer            how long they have lasted, which is the actual score in
//                    this genre.
//   kills            the other number people compare.
//   build chips      what they have picked up, so a level-up choice can be
//                    made against what is already stacked.
//
// THE RULE THIS FILE FOLLOWS: nothing touches the DOM unless the value
// changed. The loop runs at 60Hz with up to 90 enemies and the horde is the
// frame budget; rewriting a number every frame is a cost paid 60 times a
// second for an image that changes a dozen times a run.

const el = {};
const was = {};

export function initHud() {
  for (const id of ['level-num', 'xp-fill', 'run-time', 'kill-num',
                    'build-chips', 'hud']) {
    el[id] = document.getElementById(id);
  }
  for (const k of Object.keys(was)) delete was[k];
}

/** m:ss. Past an hour nobody is still standing, so it is not handled. */
export function clock(timeS) {
  const t = Math.max(0, Math.floor(timeS));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * @param {object} w the world
 * @param {object} build ability key -> stacks
 * @param {object} abilities the ABILITIES table, for labels
 * @param {number} need xp required for the next level
 */
export function updateHud(w, build, abilities, need, katana) {
  if (!el.hud) return;

  if (was.level !== w.level) {
    was.level = w.level;
    el['level-num'].textContent = String(w.level);
  }

  // The bar is a transform, never a width: a width change lays out the page
  // every frame it moves, and this one moves on every gem.
  const frac = need > 0 ? Math.min(1, w.xp / need) : 0;
  if (was.frac === undefined || Math.abs(frac - was.frac) > 0.004) {
    was.frac = frac;
    el['xp-fill'].style.transform = `scaleX(${frac})`;
  }

  const t = clock(w.timeS);
  if (was.t !== t) {
    was.t = t;
    el['run-time'].textContent = t;
  }

  // THE HIT FLASH SURVIVED THE PIPS. The pool itself is drawn on the
  // character now, but the flash is a whole-readout reaction to losing one
  // and still belongs where the change is noticed.
  if (was.lives !== w.lives) {
    // Driven from here rather than from a timer, because the only moment it
    // should fire is the moment this number went DOWN.
    const hurt = was.lives !== undefined && w.lives < was.lives;
    was.lives = w.lives;
    if (hurt) {
      el.hud.classList.remove('hurt');
      void el.hud.offsetWidth;                  // restart the animation
      el.hud.classList.add('hurt');
    }
  }

  if (was.kills !== w.kills) {
    was.kills = w.kills;
    el['kill-num'].textContent = String(w.kills);
  }

  // The build changes a handful of times a run; serialise it and compare.
  const sig = Object.entries(build).filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}${v}`).join(',');
  if (was.sig !== sig) {
    was.sig = sig;
    el['build-chips'].innerHTML = Object.entries(build)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<i class="chip" data-k="${k}">${abilities[k].label}`
                     + `${v > 1 ? `<b>${v}</b>` : ''}`
                     + `<u class="chip-fill"></u></i>`)
      .join('');
    el.katanaChip = el['build-chips'].querySelector('.chip[data-k="katana"] .chip-fill');
  }

  // THE KATANA CHIP IS THE ONLY LIVE ONE, and it has to be.
  //
  // Every other chip states a fact that stays true. The katana is drawn and
  // sheathed on a cycle, so without this the best weapon in the build simply
  // vanishes for six seconds and comes back, which reads as a bug and not as
  // a rhythm. The same argument the PRD makes about the two-player wall: a
  // thing that stops responding with no visible reason is indistinguishable
  // from a broken game.
  //
  // Exempt from the no-DOM-unless-changed rule above, and deliberately: this
  // is one style write on one element per frame, against a horde of ninety.
  // It is also the one value on screen that is continuous rather than
  // stepped, so there is no "changed" to compare against.
  if (el.katanaChip && katana) {
    el.katanaChip.style.transform = `scaleX(${katana.out ? 1 - katana.progress : katana.progress})`;
    el.katanaChip.style.opacity = katana.out ? '0.95' : '0.45';
  }
}
