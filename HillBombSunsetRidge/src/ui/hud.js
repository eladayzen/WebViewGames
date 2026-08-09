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

    banner(text) {
      if (!el.trickBanner) return;
      el.trickBanner.textContent = text;
      el.trickBanner.classList.add('show');
      bannerTimer = 1.1;
    },

    update(dt, { speed, score, wobble, chain, chainTimer }) {
      el.speed.textContent = `${Math.round(speed * 2.6)} km/h`;
      el.score.textContent = Math.round(score).toLocaleString();

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
      }

      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el.trickBanner.classList.remove('show');
      }
    },

    fps(value, speed) {
      el.perf.textContent = `${value.toFixed(0)} fps · ${speed.toFixed(0)} u/s`;
    },
  };
}
