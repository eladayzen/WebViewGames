// THE ROOM READOUT: dots, a count, and a banner.
//
// Everything here writes to the DOM ONLY WHEN THE VALUE CHANGED. The frame loop
// calls these sixty times a second and most frames nothing is different;
// rewriting innerHTML on every one of them would rebuild five elements for no
// reason and make the pulsing dot restart its animation each time.
export function createHud() {
  const pips = document.getElementById('room-pips');
  const left = document.getElementById('enemies-left');
  const banner = document.getElementById('banner');
  let pipKey = '';
  let leftText = '';

  /** `room` is 0-based; `rooms` is how many the level has; the last is the boss. */
  function setRooms(room, rooms, cleared) {
    const key = `${room}/${rooms}/${cleared ? 1 : 0}`;
    if (!pips || key === pipKey) return;
    pipKey = key;
    let html = '';
    for (let i = 0; i < rooms; i++) {
      const done = i < room || (i === room && cleared);
      const cls = ['pip', i === rooms - 1 ? 'boss' : '', done ? 'done' : i === room ? 'now' : '']
        .filter(Boolean).join(' ');
      html += `<span class="${cls}"></span>`;
    }
    pips.innerHTML = html;
  }

  function setLeft(n, show = true) {
    if (!left) return;
    const t = show ? `${n} left` : '';
    if (t !== leftText) { leftText = t; left.textContent = t; }
  }

  /** Show a banner. Re-triggering restarts the animation, which is the point. */
  function say(big, small = '') {
    if (!banner) return;
    banner.innerHTML = small ? `${big}<small>${small}</small>` : big;
    banner.classList.remove('show');
    void banner.offsetWidth;          // force a reflow so the animation restarts
    banner.classList.add('show');
  }

  function hideBanner() { banner?.classList.remove('show'); }

  /** A white pop over everything, for the last kill. Re-triggerable. */
  function flash() {
    const el = document.getElementById('flash');
    if (!el) return;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  return { setRooms, setLeft, say, hideBanner, flash };
}
