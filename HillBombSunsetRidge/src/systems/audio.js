// SOUND -- a continuous ride, punctuated by events, on two independent switches.
//
// THE RIDE IS A BED, NOT A SERIES OF NOISES. Amit, on the first version: "while
// I'm not doing a ramp or airborne or gliding we need this constant
// pitch-changing basic sound of rolling -- because if I hear it for a second and
// then it goes away, it breaks the illusion."
//
// Exactly right, and it is the difference between a game that sounds alive and
// one that sounds like a slideshow. Wheels on concrete do not stop making noise
// because nothing interesting happened. So at any moment the rider is in exactly
// ONE of three surface states, and each owns the continuous layer:
//
//     ROLL    on the ground        a loop, pitched by speed
//     GRIND   on a rail           a loop, replacing the roll entirely
//     AIR     off the ground      silence, because there is no contact
//
// The silence in the air is the point rather than an omission -- it is what
// makes a jump feel like a jump. The roll cutting out IS the takeoff, and it
// coming back IS the landing, which is why those two moments need no help.
//
// ONE-SHOTS ARE PUNCTUATION. Launch, land, pickup, boost and crash fire over the
// bed. Amit: "if I have a jump I want to hear the jump and nothing else
// afterwards; the landing has to have its own effect." So the launch plays into
// silence, the air stays empty, and the landing lands on the roll resuming.
//
// WEBAUDIO, NOT <audio> ELEMENTS. A sound has to be able to fire twice in quick
// succession -- two crystals a metre apart -- and replaying an element restarts
// it, cutting the first off. Each clip decodes ONCE into an AudioBuffer and every
// trigger gets a FRESH BufferSourceNode, which is the only way overlapping copies
// play cleanly. Source nodes are single-use by design in the spec.
//
// TWO GAIN NODES, and that is the whole architecture of the enable/disable
// requirement. Everything routes through `sfxGain` or `musicGain`, so turning one
// off is one gain going to zero and cannot possibly affect the other. A flag
// checked at each call site gets one site wrong eventually, invisibly.
//
// FAILURE IS SILENT AND TOTAL. A restricted WebView with no audio must lose its
// sound, not its game.

import launchUrl from '../assets/audio/sfx_launch.mp3?url';
import landUrl from '../assets/audio/sfx_land.mp3?url';
import grindUrl from '../assets/audio/sfx_grind.mp3?url';
import rollUrl from '../assets/audio/sfx_roll.mp3?url';
import rollFastUrl from '../assets/audio/sfx_roll_fast.mp3?url';
import pickupUrl from '../assets/audio/sfx_pickup.mp3?url';
import boostUrl from '../assets/audio/sfx_boost.mp3?url';
import crashUrl from '../assets/audio/sfx_crash.mp3?url';
import trickUrl from '../assets/audio/sfx_trick.mp3?url';
import hugeUrl from '../assets/audio/sfx_huge.mp3?url';
import objectiveUrl from '../assets/audio/sfx_objective.mp3?url';
import musicFlowUrl from '../assets/audio/music_flow.mp3?url';
import musicDriftUrl from '../assets/audio/music_drift.mp3?url';
import musicGridUrl from '../assets/audio/music_grid.mp3?url';

/**
 * Per-clip mix, here rather than baked into the files so it can be tuned without
 * regenerating anything. These are levels RELATIVE to each other; the master is
 * the gain node.
 *
 * The crash is loudest: it is the only sound reporting that something went
 * wrong, and it has to cut through. The pickup is quietest because it is by far
 * the most frequent -- on a crystal mission it fires thirty times, and a sound
 * heard thirty times a run has to be small.
 */
const ONESHOTS = {
  launch: { url: launchUrl, gain: 0.55 },
  land: { url: landUrl, gain: 0.45 },
  pickup: { url: pickupUrl, gain: 0.30 },
  boost: { url: boostUrl, gain: 0.55 },
  crash: { url: crashUrl, gain: 0.70 },
  /**
   * THE PAYOUT SOUNDS. Amit: "we need to add audio feedback for tricks giving
   * points."
   *
   * Landing already made a noise -- the board slapping concrete -- but that is
   * a PHYSICAL event and says nothing about whether it was worth anything. A
   * clean landing off a kicker and a nine-chain vert wall sounded identical,
   * which quietly hid the entire scoring model: the chain is where the points
   * actually come from and it had no voice at all.
   *
   * So the slap still reports the landing and this reports the REWARD, layered
   * over it. Two sounds because they are two different facts.
   */
  trick: { url: trickUrl, gain: 0.42 },
  // Its own clip rather than the same one louder: a huge air is the biggest
  // thing the game can produce and deserves a different shape, not a bigger
  // copy of the ordinary one.
  huge: { url: hugeUrl, gain: 0.55 },
  /**
   * THE LOUDEST THING IN THE GAME, and deliberately. Clearing the objective is
   * the single moment a mission is about -- everything before it is working
   * toward this and everything after is a victory lap. It has to sit above the
   * ride rather than in it.
   */
  objective: { url: objectiveUrl, gain: 0.85 },
};

/**
 * The continuous layers. Three clips, but only ever ONE surface at a time --
 * `roll` is two of them blended.
 *
 * TWO ROLL TEXTURES, CROSSFADED BY SPEED. Amit: "I think we should be looping
 * the skateboard wheel sounds like different sounds somehow." One clip on a loop
 * is findable however long it is -- the ear locks onto a four-second phrase in a
 * few passes and then hears nothing else.
 *
 * Pitch alone does not fix that, because a pitched-up copy of a loop is still
 * the same loop. Two genuinely different recordings do: measured, the slow one
 * has a spectral centroid of 1884 Hz against the fast one's 2426 Hz, so the
 * TIMBRE changes as the rider accelerates and not just the frequency. And since
 * the blend is always moving with the speed, neither clip's loop point ever
 * lands in the same place twice -- the repetition stops being locatable.
 *
 * It is also simply truer. Wheels at 40 u/s do not sound like wheels at 15 u/s
 * played faster; they sing rather than rumble.
 */
const BEDS = {
  rollSlow: { url: rollUrl, gain: 0.34 },
  rollFast: { url: rollFastUrl, gain: 0.34 },
  grind: { url: grindUrl, gain: 0.50 },
};

/**
 * THE MUSIC LIBRARY -- a different track each run.
 *
 * Amit: "did you get two versions? we can make it that every level you enter we
 * just give you different music -- keep everything you've downloaded and see
 * which one we use."
 *
 * A track that is wrong as THE music can still be right as ONE of the music,
 * because the thing that made it tiring -- hearing it every single run -- stops
 * being true. A player meeting a different track on each hill also reads the
 * game as bigger than one looping the same thirty seconds forever.
 *
 * That is not a licence to keep everything, though: three tracks that belong
 * beat four where one does not. ASPHALT was cut for exactly that -- it was made
 * to be calm and turned out calm to the point of not being this game, which no
 * amount of rotation fixes. The two dusk-synthwave tracks went the same way,
 * for being "much too 80s".
 *
 * Every file here has been trimmed of its outro fade, cross-faded at the loop
 * point, and normalised to a common level, so switching between them cannot
 * also change how loud the game is. See prep_music.py in the session notes.
 *
 * `rate` is a per-track playback speed. Amit on GRID: "a bit too harsh, a bit
 * too fast and loud." Slowing it slightly drops the pitch with it, which takes
 * the edge off the highs as well as the tempo -- and doing it here rather than
 * re-rendering the file means it stays a one-number adjustment.
 *
 * `trim` is a RELATIVE level, near 1, NOT a second master volume. It used to
 * hold values around 0.24, which multiplied against MUSIC_GAIN's own 0.22 to
 * put the music out at roughly a twentieth of full scale -- Amit: "music in
 * some cases tends to be very very low volume even when I put it on max."
 * That is what two attenuations stacked looks like. The files are already
 * RMS-normalised to a common level by prep_music.py, so a trim only ever
 * expresses taste about one track against the others, and 1 is the neutral
 * value.
 */
const TRACKS = [
  /**
   * THE MIDDLE GROUND, two takes from one generation. Amit: "try generating
   * something in the middle between ASPHALT and GRID" -- asphalt being calm to
   * the point of receding, grid being "action and fun but too fast and too
   * hard". So: 126 BPM against their 115 and 140, warm rounded drums instead of
   * crisp digital ones, and nothing shrill in the top end.
   *
   * Both takes are shipped rather than one being picked for him. They came from
   * a single call, so the second is free, and they are different enough that
   * the choice is a listening decision rather than a technical one.
   *
   * These replace the two dusk-synthwave tracks, which went for the reason they
   * were nearly cut the first time: "much too 80s".
   */
  { url: musicFlowUrl, name: 'flow', trim: 1, rate: 1 },
  { url: musicDriftUrl, name: 'drift', trim: 1, rate: 1 },
  // Slowed and trimmed slightly, per "a bit too harsh, a bit too fast and loud".
  { url: musicGridUrl, name: 'grid', trim: 0.85, rate: 0.92 },
];

/**
 * THE ONE master music level, at 100% on the volume slider.
 *
 * Sized against the effects rather than picked: a one-shot plays at 0.30-0.70
 * into an SFX channel that sits at 1, so the loudest thing in the game is around
 * 0.5. Music at 0.34 sits clearly underneath that and is still plainly audible
 * on its own -- which the old 0.057 effective level was not.
 */
const MUSIC_GAIN = 0.34;

/**
 * Speed-to-pitch for the rolling loop, which is the thing that makes it read as
 * YOUR wheels rather than as ambience. Mapped across the range the rider
 * actually occupies -- roughly 15 u/s crawling to 45 flat out with a boost --
 * onto a pitch range wide enough to hear but short of cartoonish.
 */
const ROLL_SPEED_LO = 14;
const ROLL_SPEED_HI = 46;
const ROLL_RATE_LO = 0.72;
const ROLL_RATE_HI = 1.55;

/** Seconds for a bed to fade in or out. Short enough to feel instant, long
 *  enough that a hard cut does not click. */
const BED_FADE = 0.07;

export function createAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  /** @type {AudioContext|null} */
  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  /** @type {Map<string, AudioBuffer>} */
  const buffers = new Map();
  /** Decoded tracks by name; they arrive independently. */
  const musicBuffers = new Map();
  let musicNode = null;
  /** Which track this run is playing. */
  let track = null;
  /**
   * A SHUFFLED BAG, not a random pick -- the same reasoning as the race's hills.
   * Random repeats a track back-to-back about one run in three with only three
   * of them, which is precisely the thing this exists to avoid.
   */
  let bag = [];
  /**
   * MUSIC IS TWO CONDITIONS, NOT ONE.
   *
   * `musicOn` is the player's setting; `inRun` is whether a run is actually
   * happening. Music plays only when BOTH hold. Amit: "let's have lobby music
   * and music for the game -- for now the lobby will be silent, so you start the
   * track only when I start the race."
   *
   * Two flags rather than one because they answer to different owners and must
   * not overwrite each other: leaving a run has to stop the music WITHOUT
   * turning the player's setting off, or the setting would silently flip itself
   * every time a run ended and never come back.
   *
   * A LOBBY TRACK slots in here later by giving the lobby its own buffer and
   * choosing between them on this same flag -- which is why it is named for the
   * state rather than for "should the game track play".
   */
  let inRun = false;

  /** The live bed nodes, by name. Held open; gains ramp between them. */
  const beds = Object.create(null);
  /** Which bed the game currently wants: 'roll', 'grind' or null for the air. */
  let wantBed = null;
  let rollRate = 1;
  /** 0 = all slow texture, 1 = all fast. See setRide. */
  let rollBlend = 0;

  let sfxOn = true;
  let musicOn = true;
  /**
   * EVERYTHING STOPS WHILE PAUSED. Amit: "pause and settings should pause the
   * music completely, and release it on going back to gameplay."
   *
   * The AudioContext is SUSPENDED rather than the gains being pulled to zero.
   * Muting leaves the loops running, so a 30-second pause returns you 30 seconds
   * further into the track and mid-phrase; suspending freezes the clock, so
   * resuming continues exactly where the player left off, which is what "pause"
   * means everywhere else in the game.
   *
   * It also stops the wheels rolling under a menu -- the same reason the bed
   * goes silent between runs.
   */
  let paused = false;
  /**
   * VOLUME IS SEPARATE FROM THE SWITCH, 0..1 each.
   *
   * Two controls rather than one slider-that-reaches-zero: "off" is a state a
   * player wants to set and come back from without losing where they had the
   * level, and a slider dragged to zero forgets it. It also keeps the switch
   * usable as a switch on a board that can only cycle values.
   */
  let sfxVol = 1;
  let musicVol = 1;

  /** The gain a channel should actually sit at, given both of its controls. */
  const sfxLevel = () => (sfxOn ? sfxVol : 0);
  const musicLevel = () => (musicOn ? MUSIC_GAIN * musicVol : 0);

  if (Ctx) {
    try {
      ctx = new Ctx();
      sfxGain = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain.gain.value = sfxLevel();
      musicGain.gain.value = musicLevel();
      sfxGain.connect(ctx.destination);
      musicGain.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  const running = () => !!ctx && ctx.state === 'running';

  async function fetchInto(url, set) {
    if (!ctx) return;
    try {
      const res = await fetch(url);
      const bytes = await res.arrayBuffer();
      // The promise form of decodeAudioData is missing on some older WebViews,
      // so the callback form is wrapped rather than awaited directly.
      const buf = await new Promise((ok, fail) => {
        const p = ctx.decodeAudioData(bytes, ok, fail);
        if (p && p.then) p.then(ok, fail);
      });
      set(buf);
    } catch {
      // One clip failing to decode must not take the rest of the sound with it.
    }
  }

  for (const [name, def] of Object.entries(ONESHOTS)) {
    fetchInto(def.url, (b) => buffers.set(name, b));
  }
  for (const [name, def] of Object.entries(BEDS)) {
    // A bed arriving late has to be started if the game is already asking for
    // it, or the rolling sound never begins on a fast-loading run.
    fetchInto(def.url, (b) => { buffers.set(name, b); syncBeds(); });
  }
  for (const t of TRACKS) {
    fetchInto(t.url, (b) => { musicBuffers.set(t.name, b); syncMusic(); });
  }

  /**
   * THE GESTURE UNLOCK, and the bug it used to have.
   *
   * Browsers and mobile WebViews refuse to start an AudioContext until the user
   * has interacted. The first version called ctx.resume() and then immediately
   * checked ctx.state -- but resume() is ASYNCHRONOUS, so the state was still
   * 'suspended' on the very next line, startMusic() bailed out, and nothing ever
   * retried. Amit: "I don't hear the music at all."
   *
   * It survived testing because the headless browser ran with
   * --autoplay-policy=no-user-gesture-required, which has the context already
   * running and hides the race completely. A reminder that a test environment
   * configured for convenience can hide exactly the thing it is meant to catch.
   *
   * Now: wait for the resume to actually resolve, AND listen for statechange as
   * a backstop, since some WebViews resume the context on their own schedule
   * without the promise the spec describes.
   */
  function unlock() {
    if (!ctx) return;
    const after = () => { syncMusic(); syncBeds(); };
    if (ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && p.then) p.then(after, () => {});
      else after();
    } else {
      after();
    }
    for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) {
      window.removeEventListener(ev, unlock);
    }
  }
  for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) {
    window.addEventListener(ev, unlock);
  }
  if (ctx) {
    ctx.addEventListener('statechange', () => {
      if (running()) { syncMusic(); syncBeds(); }
    });
  }

  /** Start a bed's looping node if it should be running and is not. */
  function ensureBed(name) {
    if (beds[name] || !running()) return;
    const buf = buffers.get(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    // Starts SILENT and ramps up in syncBeds -- starting at full gain is an
    // audible click at the top of every landing.
    g.gain.value = 0;
    src.connect(g).connect(sfxGain);
    src.start();
    beds[name] = { src, g };
  }

  /**
   * Bring the beds in line with what the game is asking for. Called on every
   * ride update and whenever something might have changed underneath (a buffer
   * arriving, the context starting).
   *
   * Both beds stay ALIVE once created and are crossfaded by gain rather than
   * started and stopped. Restarting a loop each time the rider touches down
   * would restart the waveform from sample zero, which is audible as a click and
   * as a repeating phrase; holding them open means the roll sounds continuous
   * across a jump, exactly as real wheels would.
   */
  function syncBeds() {
    if (!running()) return;
    const want = (sfxOn && !paused) ? wantBed : null;
    /**
     * EQUAL-POWER crossfade between the two roll textures, not linear. Two
     * uncorrelated noise-like sounds at 0.5 gain each are quieter than either at
     * full, so a linear blend dips in volume exactly in the middle of the speed
     * range -- which is where the rider spends most of a run.
     */
    const fast = Math.sin(rollBlend * Math.PI / 2);
    const slow = Math.cos(rollBlend * Math.PI / 2);
    for (const name of Object.keys(BEDS)) {
      const wanted = want === 'grind' ? name === 'grind'
        : want === 'roll' ? (name === 'rollSlow' || name === 'rollFast')
          : false;
      if (wanted) ensureBed(name);
      const bed = beds[name];
      if (!bed) continue;
      let target = 0;
      if (wanted) {
        target = BEDS[name].gain
          * (name === 'rollFast' ? fast : name === 'rollSlow' ? slow : 1);
      }
      bed.g.gain.setTargetAtTime(target, ctx.currentTime, BED_FADE);
      if (name === 'rollSlow' || name === 'rollFast') {
        bed.src.playbackRate.value = rollRate;
      }
    }
  }

  /**
   * Bring the music in line with the two conditions above. The single place that
   * starts or stops a track, so the flags cannot disagree with what is audible.
   */
  /** The last track dealt, so a refilled bag cannot repeat it. */
  let lastDealt = null;

  /**
   * The next track, dealing all of them before any repeats.
   *
   * THE BAG BOUNDARY NEEDS ITS OWN GUARD. A shuffled bag stops a track
   * repeating WITHIN a cycle, but says nothing about the join between two
   * cycles: [a,b,c] followed by [c,a,b] plays c twice in a row. Measured over
   * nine consecutive runs it happened twice, which is most of the way back to
   * the plain-random behaviour the bag exists to prevent.
   *
   * So on a refill, if the first card would repeat the last one dealt, it is
   * swapped with another. Cheap, and it makes the guarantee the real one:
   * never the same track twice running.
   */
  function nextTrack() {
    if (!bag.length) {
      bag = TRACKS.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // pop() takes from the end, so that is the card about to be dealt.
      if (bag.length > 1 && lastDealt && bag[bag.length - 1].name === lastDealt) {
        const j = Math.floor(Math.random() * (bag.length - 1));
        [bag[bag.length - 1], bag[j]] = [bag[j], bag[bag.length - 1]];
      }
    }
    const t = bag.pop();
    lastDealt = t.name;
    return t;
  }

  function syncMusic() {
    /**
     * `paused` and the context's own state are deliberately kept out of `want`.
     * A suspended context is not "running", so folding it in here would TEAR
     * DOWN the music node every time the game paused -- and a stopped
     * BufferSource cannot be restarted, so resuming would begin the track again
     * from the top. Pausing must freeze what is playing, not discard it.
     */
    const want = musicOn && inRun && !paused;
    if (want && !musicNode && running()) {
      // Chosen at the moment it starts, and only from tracks that have actually
      // decoded -- picking one that has not arrived yet would leave the run
      // silent rather than falling back to one that is ready.
      if (!track || !musicBuffers.has(track.name)) {
        const ready = TRACKS.filter((t) => musicBuffers.has(t.name));
        if (!ready.length) return;
        let pick = nextTrack();
        // Keep dealing until one is ready, rather than giving up on the bag.
        for (let i = 0; i < TRACKS.length && !musicBuffers.has(pick.name); i++) {
          pick = nextTrack();
        }
        track = musicBuffers.has(pick.name) ? pick : ready[0];
      }
      const src = ctx.createBufferSource();
      src.buffer = musicBuffers.get(track.name);
      src.loop = true;
      src.playbackRate.value = track.rate;
      const g = ctx.createGain();
      g.gain.value = track.trim;
      src.connect(g).connect(musicGain);
      src.start();
      musicNode = src;
    } else if (!want && musicNode) {
      try { musicNode.stop(); } catch { /* already ended */ }
      musicNode = null;
    }
  }

  const api = {
    /**
     * @param {string} name a key of ONESHOTS
     * @param {number} [rate] playback rate, for pitch variation
     *
     * A FRESH NODE EVERY TIME -- see the note at the top.
     */
    play(name, rate = 1) {
      if (!sfxOn || !running()) return;
      const def = ONESHOTS[name];
      const buf = buffers.get(name);
      if (!def || !buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = def.gain;
      src.connect(g).connect(sfxGain);
      src.start();
    },

    /**
     * THE RIDE'S CONTINUOUS LAYER. Called every frame with what the rider is
     * doing; everything else here follows from it.
     *
     * @param {{airborne:boolean, grinding:boolean, speed:number, active:boolean}} s
     *
     * `active` is false between runs -- on a menu, or once a run has ended --
     * and silences the bed. Without it the wheels keep rolling over the results
     * screen, which is the same illusion-breaker in reverse.
     */
    setRide(s) {
      const next = !s || !s.active ? null
        : s.airborne ? null
          : s.grinding ? 'grind' : 'roll';
      if (next === 'roll') {
        const t = Math.max(0, Math.min(1,
          (s.speed - ROLL_SPEED_LO) / (ROLL_SPEED_HI - ROLL_SPEED_LO)));
        // The SAME signal drives both, so pitch and timbre move together and
        // the ear reads one accelerating object rather than two effects.
        rollRate = ROLL_RATE_LO + (ROLL_RATE_HI - ROLL_RATE_LO) * t;
        rollBlend = t;
      }
      wantBed = next;
      syncBeds();
    },

    /**
     * @param {boolean} on a run is in progress.
     *
     * The track RESTARTS from the top each run rather than resuming, which is
     * deliberate: a run is a discrete thing with a beginning, and dropping in
     * halfway through a phrase makes it feel like the music was already going on
     * without you.
     */
    setInRun(on) {
      const next = !!on;
      if (next === inRun) return;
      inRun = next;
      // A new run means a new draw. Cleared on the way OUT rather than the way
      // in, so a run that is paused and resumed keeps its own track.
      if (!inRun) track = null;
      syncMusic();
    },

    /**
     * THE TWO SWITCHES. Independent by construction -- each moves its own gain
     * node and touches nothing the other owns.
     */
    setSfx(on) {
      sfxOn = !!on;
      if (sfxGain) sfxGain.gain.value = sfxLevel();
      // The beds are held nodes, so they need telling as well: a master gain of
      // zero silences them but leaves them running.
      syncBeds();
    },

    /**
     * Music STOPS rather than being muted. A muted track keeps its position, so
     * switching it back on drops you into the middle of a phrase -- on a long
     * loop that reads as broken rather than as resumed.
     */
    setMusic(on) {
      musicOn = !!on;
      if (musicGain) musicGain.gain.value = musicLevel();
      syncMusic();
    },

    /** @param {number} v 0..1 */
    /**
     * @param {boolean} on the game is paused, or a menu is over it.
     */
    setPaused(on) {
      const next = !!on;
      if (next === paused || !ctx) return;
      paused = next;
      if (paused) {
        // Stop the beds first so they do not resume mid-fade on the way back.
        syncBeds();
        if (ctx.state === 'running') ctx.suspend();
      } else {
        const after = () => { syncMusic(); syncBeds(); };
        const p = ctx.resume();
        if (p && p.then) p.then(after, () => {}); else after();
      }
    },

    setSfxVolume(v) {
      sfxVol = Math.max(0, Math.min(1, Number(v) || 0));
      if (sfxGain) sfxGain.gain.value = sfxLevel();
    },

    /** @param {number} v 0..1 */
    setMusicVolume(v) {
      musicVol = Math.max(0, Math.min(1, Number(v) || 0));
      if (musicGain) musicGain.gain.value = musicLevel();
    },

    get sfxEnabled() { return sfxOn; },
    get musicEnabled() { return musicOn; },
    /** For diagnosing a silent build: is the context actually running? */
    get ready() { return running(); },
    /** What the bed is doing right now, for measurement. */
    get bed() { return wantBed; },
    get rollRate() { return rollRate; },
    get rollBlend() { return rollBlend; },
    get musicPlaying() { return !!musicNode && !paused; },
    get isPaused() { return paused; },
    /** Which track is playing, for measurement. */
    get musicTrack() { return musicNode && track ? track.name : null; },
  };

  return api;
}
