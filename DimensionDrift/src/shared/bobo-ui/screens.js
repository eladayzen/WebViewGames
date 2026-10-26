/**
 * bobo-ui — the screen state machine every BoBo web game shares.
 *
 *   const screens = new Screens({
 *     states: ['title', 'select', 'play', 'pause', 'results'],
 *     play: ['play', 'point'],          // states that are NOT a menu
 *     on: { start: () => game.start(), quit: () => host.exit() },
 *   });
 *   screens.go('title');
 *
 * ── WHAT IT REPLACED, AND WHY IT IS GONE ────────────────────────────────────
 *
 * Three of the five games (rally, wend, swoon) drove their menus by LEANING:
 * flick left or right to step a picker, hold a lean for ~0.85 s to commit, hold
 * back to go out one level. Each had its own copy — its own hysteresis, its own
 * arming rule, its own hold meter, its own "did the lean that opened this
 * screen also press the button on it" bug, fixed three times.
 *
 * All of it is deleted. The reasons, in order of how much they cost:
 *
 * 1. A MENU IS DISCRETE AND A LEAN IS NOT. The pipeline smooths with a time
 *    constant of about a third of a second, so every menu gesture is answered a
 *    third of a second after it is made, and the hold on top of that made the
 *    cheapest action in the game — pressing "play" — the slowest.
 * 2. THE PLAYER IS STANDING ON A BALANCE BOARD. The one person using this
 *    cannot make a small, precise, sustained movement on demand; that is why
 *    they have the board. Asking for one to get INTO the game is asking the
 *    hardest thing first.
 * 3. AN ANALOGUE CHANNEL READ AS A GESTURE FIRES BY ACCIDENT. rally's own
 *    comment records a 90-second autoplay soak walking itself into the pause
 *    screen because ordinary sideways movement read as a held menu gesture.
 *    That was found in a soak; a player finds it mid-match.
 * 4. IT WAS NEVER THE ONLY WAY IN. rally and wend already had real `<button>`s
 *    behind the same acts, because a gesture nobody finds is not an escape
 *    route. So the leans were a second path to everything, and the second path
 *    was the one with the bugs.
 *
 * What replaced it is a tap. That is the whole of it.
 *
 * ── HOW A GAME WIRES ITSELF UP ──────────────────────────────────────────────
 *
 * Markup carries the intent and this file carries none of it:
 *
 *   <div class="screen" data-state="pause"> ... </div>
 *   <button class="say say-go" data-act="resume"><span class="btn-label">carry on</span></button>
 *
 * Every `[data-act]` under a screen is bound once, at construction, by event
 * delegation on the document — so a game may build cards, rails and results
 * rows at runtime and their buttons work without anyone remembering to re-bind.
 * An act with no handler is a console warning, not a silent no-op: a dead
 * button that looks alive is the failure this replaced.
 */

/** States that mean "the world is running", if a game does not say otherwise. */
const DEFAULT_PLAY = ['play'];

export class Screens {
  /**
   * @param {object} opts
   * @param {string[]} opts.states every state this game has. A `go()` to
   *   anything not in here throws — a typo'd state name would otherwise show an
   *   empty screen over a running world, which reads as a hang.
   * @param {string[]} [opts.play] the states that are NOT menus. Drives the
   *   wash and `isMenu`.
   * @param {Record<string, (ev: {act: string, el: Element, state: string}) => void>} [opts.on]
   *   one handler per `data-act`.
   * @param {(from: string, to: string) => void} [opts.onChange]
   * @param {Document} [opts.doc]
   */
  constructor({
    states, play = DEFAULT_PLAY, on = {}, resolve = null,
    onChange = null, doc = document,
  } = {}) {
    if (!Array.isArray(states) || !states.length) {
      throw new Error('Screens: `states` is required');
    }
    this.doc = doc;
    this.states = new Set(states);
    this.play = new Set(play);
    this.handlers = { ...on };
    /**
     * Resolve an act that is not in the map, at the moment it fires.
     *
     * A game that writes its acts out by hand keeps a list that goes stale the
     * first time someone adds a button -- which is the bug this delegation was
     * built to kill, reappearing one level up. A host can instead hand over a
     * resolver and never name an act twice. Returning undefined still earns
     * the "no handler" warning, so a genuinely unhandled act is still loud.
     */
    this._resolve = resolve ?? null;
    this.onChange = onChange;
    this.state = null;

    this._els = new Map();
    for (const el of doc.querySelectorAll('.screen[data-state]')) {
      const name = el.dataset.state;
      // Two screens claiming one state is not recoverable by picking one: the
      // author believes both are showing and only ever sees whichever the
      // query returned second.
      if (this._els.has(name)) throw new Error(`Screens: two screens claim data-state="${name}"`);
      this._els.set(name, el);
    }
    this._wash = doc.querySelector('.wash');

    // ── DELEGATION, NOT PER-BUTTON LISTENERS ──────────────────────────────
    // Cards, rails and results rows are built at runtime in four of the five
    // games. Binding each button at construction would work on the title screen
    // and quietly fail on every list, which is the kind of bug that gets found
    // by a player rather than by a test.
    this._onClick = (ev) => {
      const el = ev.target.closest?.('[data-act]');
      if (!el || el.disabled) return;
      // A control on an inactive screen still exists in the layout — screens
      // fade rather than un-render — so it must not answer a stray tap that
      // lands during a transition.
      const screen = el.closest('.screen');
      if (screen && !screen.classList.contains('is-active')) return;
      ev.preventDefault();
      this.fire(el.dataset.act, el);
    };
    doc.addEventListener('click', this._onClick);
  }

  /** Run one act by name, as if its button had been pressed. */
  fire(act, el = null) {
    const fn = this.handlers[act] ?? this._resolve?.(act);
    if (!fn) {
      console.warn(`[bobo-ui] no handler for data-act="${act}"`);
      return;
    }
    fn({ act, el, state: this.state });
  }

  /** Add or replace handlers after construction. */
  bind(map) { Object.assign(this.handlers, map); return this; }

  get isMenu() { return this.state !== null && !this.play.has(this.state); }

  /** The same question about any state, not just the current one. */
  isMenuState(name) { return name != null && !this.play.has(name); }

  /**
   * Show a state. Idempotent: going to the state you are already in does
   * nothing at all, rather than re-running the entry transition — a game that
   * re-asserts its state every frame (three of them do, off a bus event) would
   * otherwise hold every screen permanently at the first frame of its fade.
   */
  go(name) {
    if (!this.states.has(name)) {
      throw new Error(`Screens: unknown state "${name}" (have: ${[...this.states].join(', ')})`);
    }
    if (name === this.state) return this.state;
    const from = this.state;
    this.state = name;
    this._swapSeq = this._swapSeq ?? 0;

    // `body[data-state]` is the single source of truth every stylesheet reads.
    this.doc.body.dataset.state = name;
    // ── MENU TO MENU IS A SWAP, NOT A CROSS-FADE ──────────────────────────
    // The fade belongs to the boundary between the game and the interface,
    // where it reads as the world stepping back. BETWEEN two panels it is two
    // fades crossing: for the whole duration neither is opaque, whatever is
    // behind shows through the gap, and what the player sees is a blink.
    // Measured at 0.505 opacity across 24 frames before this (BAL-590).
    // Held for two frames -- one to lay the incoming screen out with
    // transitions off, one before they come back, or the browser coalesces
    // the two states and fades anyway.
    if (from && this.isMenuState(from) && this.isMenuState(name)) {
      const seq = ++this._swapSeq;
      this.doc.body.classList.add('scr-swap');
      const win = this.doc.defaultView ?? globalThis;
      win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
        if (seq === this._swapSeq) this.doc.body.classList.remove('scr-swap');
      }));
    } else if (this._swapSeq != null) {
      this._swapSeq++;
      this.doc.body.classList.remove('scr-swap');
    }
    for (const [key, el] of this._els) el.classList.toggle('is-active', key === name);
    if (this._wash) this._wash.classList.toggle('is-on', this.isMenu);

    this.onChange?.(from, name);
    return name;
  }

  destroy() { this.doc.removeEventListener('click', this._onClick); }
}

export default Screens;
