// THE RUN: WHERE YOU ARE IN THE CAMPAIGN, AND WHAT HAPPENS NEXT.
//
//   intro  -> fight -> cleared -> roll -> intro (next room) ...
//                         \-> won          (the last room, no roll)
//
// A level is a bundle of rooms. Clear one and you are handed an ability and
// walked into the next; clear the last and the level is WON. Death is not a
// phase here, because it is not part of the flow -- the world dies, and the
// caller asks for `restartLevel`, which is the whole rule: you fall back to
// the first room of the level you were on, and nothing before it is replayed.
//
// WHAT DEATH COSTS. The ability build is NOT touched by any of this: it lives
// on the world, every ability is currently permanent, and Elad's design is
// that permanent stats survive death. So dying costs the rooms you cleared on
// this level and nothing else, and a player who keeps falling over still comes
// back stronger each time. The summoned allies (temporary, phase 3) are where
// a real loss will come from, and `kind` on each ability is already there for
// it.
//
// THIS MODULE IS PURE. It takes the world, a delta time and an injected rng,
// and returns the EVENTS that happened. It never touches the DOM, so the
// whole shape of a level can be played in a test, and main.js is only the
// part that turns an event into a banner or a sound.
import { take } from './abilities.js';
import { createRoll, updateRoll } from './roll.js';
import { createRoom, updateRoom, roomCleared } from './rooms.js';
import { roomsIn } from './breeds.js';

export const RUN = {
  // "ROOM 3 / 5" on screen, with nobody in the room yet.
  bannerS: 1.2,
  // The room is clear and the player gets a beat to take it in before the box.
  clearHoldS: 1.1,
  // The LAST room of a level holds longer: the celebration plays on the field before the screen closes.
  levelClearHoldS: 3.8,
  // Clearing a room heals this share of max health. Not in Elad's design --
  // a call of mine, because with permanent hearts and no healing at all a
  // five-room level would be decided entirely by the first bad room.
  healFrac: 0.30,
};

function enter(run, rng) {
  run.room = createRoom(run.level, run.roomIdx, run.rooms, rng);
  run.phase = 'intro';
  run.t = 0;
  run.roll = null;
}

/** A fresh run at a level and room. `room` is 0-based. */
export function createRun({ level = 1, room = 0, rng = Math.random } = {}) {
  const run = { level, roomIdx: 0, rooms: roomsIn(level - 1), phase: 'intro', t: 0, room: null, roll: null };
  run.roomIdx = Math.max(0, Math.min(run.rooms - 1, room));
  enter(run, rng);
  return run;
}

/** Dying. Back to the first room of THIS level; the build is the world's and is left alone. */
export function restartLevel(run, rng = Math.random) {
  return createRun({ level: run.level, room: 0, rng });
}

/** Level won. The next one is the same plaza for now, with more of everything. */
export function nextLevel(run, rng = Math.random) {
  return createRun({ level: run.level + 1, room: 0, rng });
}

/** True while the world should stand still: the box is open. */
export const frozen = (run) => run.phase === 'roll';

/**
 * THE FREE START POWER. Elad, 22 Nov: after GO AGAIN, over black, one quick roll of a new
 * ability, and then the run starts. It is the same box and the same roll as between rooms,
 * but it grants its ability and goes to the SAME room (the first), not the next.
 * Returns the events: `rollStart` (or nothing, if every ability is already maxed).
 */
export function beginStartRoll(run, w, rng = Math.random) {
  const ev = [];
  run.roll = createRoll(w.build, rng, { room: -1 });
  if (run.roll.done) { run.roll = null; return ev; }       // nothing left to give: no empty box
  run.phase = 'roll'; run.t = 0; run.startRoll = true;
  ev.push({ type: 'rollStart', roll: run.roll, start: true });
  return ev;
}

function finishRoll(run, w, rng, ev) {
  const key = run.roll.key;
  if (key) take(w.build, key);
  ev.push({ type: 'rollDone', key });
  if (run.startRoll) run.startRoll = false;      // the start roll does not advance the room
  else run.roomIdx += 1;
  enter(run, rng);
  ev.push({ type: 'roomStart', room: run.roomIdx, rooms: run.rooms, last: run.room.isLast });
}

/**
 * Advance the run by one frame. Returns the events that happened, in order:
 * `fight`, `cleared`, `rollStart`, `rollDone`, `roomStart`, `won`.
 */
/** How long the 'cleared' phase lasts: a level's last room is held longer for the celebration. */
export const holdOf = (run) => (run.room && run.room.isLast ? RUN.levelClearHoldS : RUN.clearHoldS);

export function stepRun(run, w, dt, rng = Math.random) {
  const ev = [];
  run.t += dt;

  if (run.phase === 'intro') {
    if (run.t >= RUN.bannerS) { run.phase = 'fight'; run.t = 0; ev.push({ type: 'fight' }); }
  } else if (run.phase === 'fight') {
    updateRoom(w, run.room, dt, rng);
    if (roomCleared(w, run.room)) {
      if (!w.dead) w.hp = Math.min(w.maxHp, w.hp + Math.round(w.maxHp * RUN.healFrac));
      run.phase = 'cleared';
      run.t = 0;
      ev.push({ type: 'cleared', room: run.roomIdx, last: run.room.isLast });
    }
  } else if (run.phase === 'cleared') {
    if (run.t >= holdOf(run)) {
      if (run.room.isLast) {
        run.phase = 'won';
        run.t = 0;
        ev.push({ type: 'won', level: run.level });
      } else {
        run.roll = createRoll(w.build, rng, { room: run.roomIdx });
        run.phase = 'roll';
        run.t = 0;
        ev.push({ type: 'rollStart', roll: run.roll });
        // Everything maxed: nothing to reveal, so do not show an empty box.
        if (run.roll.done) finishRoll(run, w, rng, ev);
      }
    }
  } else if (run.phase === 'roll') {
    if (updateRoll(run.roll, dt)) finishRoll(run, w, rng, ev);
  }
  return ev;
}
