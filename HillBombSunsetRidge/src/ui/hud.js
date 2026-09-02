// DOM/CSS HUD overlay (build doc §7). Not drawn into the 3D scene, so text
// stays crisp and updates cost nothing in render logic.
//
// Layout follows the concept art: SPEED WOBBLE bar top-left, speed + score
// top-right. The wobble warning is deliberately expressed in the WORLD as well
// (camera shake, board shimmy) so a player watching the road still feels it
// coming -- the bar must never be the only signal (§7.2).

export function createHud() {
  const el = {
    wobbleFill: document.getElementById('wobble-fill'),
    wobbleBar: document.getElementById('wobble-bar'),
    speed: document.getElementById('speed-readout'),
    score: document.getElementById('score-readout'),
    chain: document.getElementById('chain-readout'),
    perf: document.getElementById('perf-readout'),
    popups: document.getElementById('popups'),
    trickBanner: document.getElementById('trick-banner'),
  };

  let bannerTimer = 0;
  let objectiveTimer = 0;
  let lastFps = 0;
  let lastSpeed = 0;
  let shownScore = 0; // what the readout currently reads, for the count-up
  let lastChain = 1;
  let lastTarget = 0; // last frame's score, for edge-detecting an award
  let bigBoostBar = false;

  /**
   * Restart a CSS animation that may already be running. Toggling the class
   * alone does nothing if the animation is mid-flight -- the browser sees no
   * change -- so the class comes off, layout is forced to flush, and it goes
   * back on. Without the reflow read, rapid-fire events (a trick chain) would
   * animate once and then sit still for the rest of the run, which is the
   * exact opposite of feedback.
   */
  function retrigger(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  function popup(text, points) {
    if (!el.popups) return;
    const node = document.createElement('div');
    node.className = 'popup';
    node.innerHTML = points > 0
      ? `<b>${text}</b><span>+${points.toLocaleString()}</span>`
      : `<b class="miss">${text}</b>`;
    el.popups.appendChild(node);
    // Self-cleaning: the CSS animation runs once, then the node removes itself.
    setTimeout(() => node.remove(), 1100);
  }

  return {
    popup,

    /** New run: the count-up must start at zero, not roll down from the last. */
    reset() {
      shownScore = 0;
      lastTarget = 0;
      lastChain = 1;
      if (el.score) el.score.textContent = '0';
    },

    /**
     * The boost timer. Hidden entirely when no boost is running -- an empty bar
     * sitting there permanently would read as a mechanic that is broken rather
     * than one that is not currently active.
     * @param {number} frac 0..1 of the boost remaining, or 0 for none.
     */
    boost(frac, secondsLeft = 0) {
      const meter = document.getElementById('boost-meter');
      const fill = document.getElementById('boost-fill');
      const right = document.getElementById('bottomRight');
      const on = frac > 0;
      if (meter) meter.classList.toggle('hidden', !on);
      if (right) right.classList.toggle('boosting', on);
      if (fill && on) fill.style.width = `${Math.min(1, frac) * 100}%`;

      // The big one, top centre. Only present in modes that asked for it, and
      // only while a boost is actually running.
      const top = document.getElementById('boost-top');
      if (!top || !bigBoostBar) {
        if (top) top.classList.add('hidden');
        return;
      }
      top.classList.toggle('hidden', !on);
      if (!on) return;
      document.getElementById('bt-fill').style.width = `${Math.min(1, frac) * 100}%`;
      document.getElementById('bt-time').textContent = `${secondsLeft.toFixed(1)}s`;
      // Under a second is where "it is about to end" stops being information
      // and starts being urgency.
      top.classList.toggle('ending', secondsLeft <= 1.0);
    },

    /** Modes opt in to the big top-centre timer -- see showsBoostBar. */
    setBoostBarVisible(on) {
      bigBoostBar = on;
      const top = document.getElementById('boost-top');
      if (top && !on) top.classList.add('hidden');
    },

    /**
     * Show or hide the score and its chain multiplier. A mode that is not
     * decided by points should not display a running total of them.
     */
    setScoreVisible(on) {
      const block = document.getElementById('score-block');
      if (block) block.classList.toggle('hidden', !on);
    },

    /**
     * Show or hide the SPEED WOBBLE bar. A meter that is always empty is worse
     * than no meter: it reads as a mechanic that is broken rather than one that
     * is switched off, so modes without wobble drop it from the HUD entirely.
     */
    setWobbleVisible(on) {
      if (el.wobbleBar) el.wobbleBar.classList.toggle('hidden', !on);
      const label = document.getElementById('wobble-label');
      if (label) label.classList.toggle('hidden', !on);
    },

    /**
     * THE OBJECTIVE-CLEAR MOMENT -- its own call, not banner().
     *
     * banner() is the trick label: 30px, 1.1 seconds, fired several times a run
     * for BIG AIR and RAIL. Announcing the completion of the mission in that
     * same voice made the biggest event in a run indistinguishable from its
     * smallest. Amit: "the message should be bigger with stronger feedback."
     *
     * Restarted cleanly by removing and re-adding the element, so the CSS
     * animations replay if it is ever fired twice in one run.
     */
    objectiveClear() {
      const oc = document.getElementById('objective-clear');
      if (!oc) return;
      oc.classList.add('hidden');
      // Force a reflow between the two class changes, or the browser coalesces
      // them and the animation never restarts.
      void oc.offsetWidth;
      oc.classList.remove('hidden');
      clearTimeout(objectiveTimer);
      // Matches the longer of the two animations, so the element is only hidden
      // once it has finished leaving.
      objectiveTimer = setTimeout(() => oc.classList.add('hidden'), 2000);
    },

    banner(text) {
      if (!el.trickBanner) return;
      el.trickBanner.textContent = text;
      el.trickBanner.classList.add('show');
      bannerTimer = 1.1;
    },

    update(dt, { speed, score, wobble, chain, chainTimer }) {
      el.speed.textContent = `${Math.round(speed * 2.6)} km/h`;

      // THE SCORE COUNTS UP rather than snapping. A number that jumps 1,350 in
      // one frame is read as "the number changed"; one that rolls up over a
      // fifth of a second is read as "I earned that", and it keeps drawing the
      // eye for long enough to notice. The rate is proportional to the gap, so
      // small distance ticks stay smooth and a big trick still lands fast.
      // The bump fires on the EDGE -- how much the target jumped since last
      // frame -- not on how far the display still has to travel. Testing the
      // remaining gap would restart the animation every frame for the whole
      // count-up, which freezes it on its first frame and shows nothing at all.
      if (score - lastTarget > 40) retrigger(el.score, 'bump');
      lastTarget = score;

      const gap = score - shownScore;
      if (Math.abs(gap) > 0.5) shownScore += gap * Math.min(1, dt * 9);
      else shownScore = score;
      el.score.textContent = Math.round(shownScore).toLocaleString();

      if (el.wobbleFill) {
        el.wobbleFill.style.width = `${wobble}%`;
        // Colour ramps with danger, and the bar itself starts pulsing past the
        // warning threshold rather than only turning red at the very end.
        el.wobbleBar.classList.toggle('warn', wobble > 60);
        el.wobbleBar.classList.toggle('critical', wobble > 85);
      }

      if (el.chain) {
        const live = chain > 1 && chainTimer > 0;
        el.chain.classList.toggle('live', live);
        el.chain.textContent = live ? `×${chain}` : '';
        // Pop on the way UP only. Chains decay silently -- celebrating the
        // multiplier falling would read as a reward for losing it.
        if (chain > lastChain) retrigger(el.chain, 'pop');
        lastChain = chain;
        // The chain is on a timer, so it gets a bar: the last second of a
        // multiplier you are trying to keep alive is the most tense moment the
        // scoring system has, and until now it was completely invisible.
        el.chain.style.setProperty('--chain-left', live ? chainTimer / 4 : 0);
      }

      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el.trickBanner.classList.remove('show');
      }
    },

    /**
     * The on-screen fps counter is gone -- it was instrumentation parked in the
     * corner the player actually reads. The numbers still go somewhere useful:
     * the lab keeps them live, so a perf regression is still one glance away
     * from the console rather than being lost.
     */
    fps(value, speed) {
      if (el.perf) el.perf.textContent = `${value.toFixed(0)} fps · ${speed.toFixed(0)} u/s`;
      lastFps = value;
      lastSpeed = speed;
    },

    get perf() { return { fps: lastFps, speed: lastSpeed }; },
  };
}
