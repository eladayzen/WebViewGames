// Dev panel (wrench button, top-right chrome row).
//
// WHAT THIS IS FOR. Reaching level 4 legitimately means clearing three levels
// and three bosses first -- several minutes before you can look at the thing
// you actually changed. Amit asked for a way to skip straight there, in the
// same spirit as the settings panels the other games in this repo carry
// (HillBombSunsetRidge/src/ui/settingsPanel.js, HalfShellHustle's steering
// panel). This is the equivalent for Nova Vanguard, plus the shortcuts that
// matter for a shmup: jump to a level, jump to its boss, stop dying.
//
// DEV ONLY, AND IT SAYS SO. Every row here either skips content or removes a
// failure condition, so nothing in this file may be reachable by accident
// during a real run: the panel starts closed, opens only on a deliberate
// press, and the invincibility row paints the HUD so a "why am I not dying"
// question can never survive more than a glance.
//
// WHO OWNS WHAT. This file renders controls and calls back into main.js. It
// owns no game state of its own -- the actions it invokes (jumpToLevel,
// skipToBoss, restart) are the game's own functions, passed in, so the panel
// cannot drift from what the game actually does. `world.debug.*` flags are
// read and written directly because that object IS the debug contract, and
// /render already reads it every frame.
//
// KEYBOARD PARITY. Inside the Unity WebView there is no pointer at all --
// WebGameController forwards Space and Enter (plus synthetic steering arrows)
// and never forwards a click. That makes every button here unreachable on
// device, exactly as HillBomb's panel documents for itself. This panel is a
// desktop-development tool and does not pretend otherwise; the existing debug
// keys (N, M, I, P, B, H, L, K) remain the on-device path and are listed in
// the panel so they are discoverable rather than folklore.

const WRENCH = '&#128295;'; // 🔧

/**
 * @param {Document} doc
 * @param {object} actions
 *   @param {(index:number)=>void} actions.jumpToLevel
 *   @param {()=>void}             actions.skipToBoss
 *   @param {(kind:string)=>void}  actions.spawnPickup
 *   @param {string[]}             actions.weaponKinds
 *   @param {string[]}             actions.effectKinds  subset that are not weapons
 *   @param {()=>void}             actions.restart
 *   @param {object}               actions.world      live world, for debug flags
 *   @param {Array}                actions.surfaces   SURFACES, for level names
 */
export function createDevPanel(doc, actions) {
  const { jumpToLevel, skipToBoss, restart, spawnPickup, weaponKinds = [],
          effectKinds = [], world, surfaces } = actions;

  const btn = doc.createElement('button');
  btn.id = 'dev-button';
  btn.setAttribute('aria-label', 'Dev tools');
  btn.innerHTML = WRENCH;

  const panel = doc.createElement('div');
  panel.id = 'dev-panel';
  panel.className = 'hidden';

  let open = false;

  // --- rows -----------------------------------------------------------------

  function section(title) {
    const h = doc.createElement('div');
    h.className = 'dev-section';
    h.textContent = title;
    panel.appendChild(h);
  }

  function buttonRow(labels, onPick) {
    const row = doc.createElement('div');
    row.className = 'dev-row';
    labels.forEach((label, i) => {
      const b = doc.createElement('button');
      b.className = 'dev-chip';
      b.textContent = label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(i);
      });
      row.appendChild(b);
    });
    panel.appendChild(row);
    return row;
  }

  function toggleRow(label, get, set) {
    const row = doc.createElement('div');
    row.className = 'dev-row dev-toggle';
    const name = doc.createElement('span');
    name.textContent = label;
    const b = doc.createElement('button');
    b.className = 'dev-chip';
    const paint = () => {
      const on = !!get();
      b.textContent = on ? 'ON' : 'OFF';
      b.classList.toggle('on', on);
    };
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      set(!get());
      paint();
    });
    paint();
    row.appendChild(name);
    row.appendChild(b);
    panel.appendChild(row);
    return { paint };
  }

  // LEVEL JUMP -- the reason this panel exists.
  section('JUMP TO LEVEL');
  buttonRow(
    surfaces.map((_, i) => String(i + 1)),
    (i) => jumpToLevel(i),
  );

  const names = doc.createElement('div');
  names.className = 'dev-note';
  names.textContent = surfaces.map((s, i) => `${i + 1} ${s.name}`).join('  ·  ');
  panel.appendChild(names);

  section('SHORTCUTS');
  buttonRow(['SKIP TO BOSS', 'RESTART'], (i) => {
    if (i === 0) skipToBoss();
    else restart();
  });

  // SPAWN A NAMED WEAPON CANISTER. Waiting for a specific weapon to drop means
  // playing until the weighted roll happens to pick it -- which is minutes per
  // weapon and, for the rarer draws, sometimes not at all in a level. These
  // put each one in reach immediately, in the lower middle where the player
  // already is.
  //
  // SPLIT INTO TWO GROUPS, and the split is functional rather than cosmetic.
  // Seven chips in one 232px row is ~28px each -- unreadable, and the reason
  // the two defensive canisters did not register as present when they were
  // added. Grouping them also matches how they are chosen in play: "which gun
  // do I want" and "am I about to die" are different questions.
  //
  // Membership is derived from the pickup table (`effect` vs `weapon`) rather
  // than listed here, so a new canister lands in the right group on its own.
  const offensive = weaponKinds.filter((k) => !effectKinds.includes(k));
  const defensive = weaponKinds.filter((k) => effectKinds.includes(k));
  if (offensive.length) {
    section('SPAWN WEAPON');
    buttonRow(
      offensive.map((k) => k.toUpperCase()),
      (i) => spawnPickup(offensive[i]),
    );
  }
  if (defensive.length) {
    section('SPAWN DEFENCE');
    buttonRow(
      defensive.map((k) => k.toUpperCase()),
      (i) => spawnPickup(defensive[i]),
    );
  }

  section('CHEATS');
  const invRow = toggleRow(
    'Invincible',
    () => !!world.debug.invincible,
    (v) => {
      world.debug.invincible = v;
      doc.body.classList.toggle('dev-invincible', v);
    },
  );

  section('OVERLAYS');
  toggleRow('Hitboxes', () => !!world.debug.hitboxes, (v) => { world.debug.hitboxes = v; });
  toggleRow('Bands', () => !!world.debug.bands, (v) => { world.debug.bands = v; });
  toggleRow('Aisle', () => !!world.debug.aisle, (v) => { world.debug.aisle = v; });
  toggleRow('Black surface', () => !!world.debug.blackSurface, (v) => { world.debug.blackSurface = v; });

  section('KEYS');
  const keys = doc.createElement('div');
  keys.className = 'dev-note';
  keys.innerHTML =
    'N next level · M mode · I stats · P pause<br>' +
    'B bands · H hitboxes · L aisle · K black surface · U mute';
  panel.appendChild(keys);

  // --- open/close -----------------------------------------------------------

  function setOpen(v) {
    open = v;
    panel.classList.toggle('hidden', !open);
    btn.classList.toggle('on', open);
    if (open) invRow.paint();
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  // Clicking the playfield closes it, so it can never be left covering the
  // action by accident.
  doc.addEventListener('click', () => { if (open) setOpen(false); });

  return {
    button: btn,
    panel,
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}
