// THE OTHER TURTLES. These are about what each one is FOR -- Leonardo blinks to a
// foe and cuts it, Donatello stuns -- and that stun really stops a foe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { makeFoe, updateFoes } from '../src/core/foes.js';
import { take } from '../src/core/abilities.js';
import { syncAllies, updateAllies, stunFoe, inCone, durationOf, ALLY } from '../src/core/allies.js';

function room(...keys) {
  const w = createWorld();
  w.maxHp = w.hp = 1e9;
  for (const k of keys) take(w.build, k);
  return w;
}
function addFoe(w, dx, dy, breed = 'slayer') {
  const f = makeFoe(w.player.x + dx, w.player.y + dy, 0, breed);
  w.foes.push(f); w.targets.push(f);
  return f;
}
function run(w, seconds, dt = 1 / 60, hooks = {}) {
  for (let t = 0; t < seconds; t += dt) { w.timeS += dt; updateAllies(w, dt, hooks); }
}

test('A CALLED ALLY EXISTS, AN UNCALLED ONE DOES NOT, and the list follows the build', () => {
  const w = room('leo');
  syncAllies(w);
  assert.deepEqual(w.allies.map((a) => a.key), ['leo']);
  take(w.build, 'donnie'); syncAllies(w);
  assert.deepEqual(w.allies.map((a) => a.key).sort(), ['donnie', 'leo']);
  w.build.leo = 0; syncAllies(w);
  assert.deepEqual(w.allies.map((a) => a.key), ['donnie']);
});

test('an ally FOLLOWS the player when there is nothing to fight', () => {
  const w = room('leo');
  syncAllies(w);
  w.player.x += 1500;
  run(w, 4);
  const a = w.allies[0];
  assert.ok(Math.hypot(a.x - w.player.x, a.y - w.player.y) < 400, 'he was left behind');
});

test('LEONARDO DASHES AT A FOE AND KILLS IT, without the player doing anything', () => {
  const w = room('leo');
  const f = addFoe(w, 450, 0);
  f.speed = 0;
  let dashed = false, topSpeed = 0, teleported = false;
  syncAllies(w);
  const leo = w.allies[0];
  for (let t = 0; t < 8 && f.alive; t += 1 / 60) {
    const x0 = leo.x, y0 = leo.y;
    w.timeS += 1 / 60; updateAllies(w, 1 / 60, {});
    const step = Math.hypot(leo.x - x0, leo.y - y0);
    topSpeed = Math.max(topSpeed, step * 60);
    // a dash MOVES him continuously: no frame jumps further than the dash speed allows
    if (step > ALLY.leo.dashSpeed / 60 + 1) teleported = true;
    if (leo.state === 'dash') dashed = true;
  }
  assert.ok(dashed, 'he never dashed');
  assert.equal(teleported, false, 'he teleported instead of dashing');
  assert.ok(topSpeed > ALLY.leo.speed * 1.5, `dash top speed only ${topSpeed.toFixed(0)}`);
  assert.equal(f.alive, false, 'Leonardo did not kill a Slayer in 8 seconds');
});

test('LEONARDO GOES HOME when the room is empty', () => {
  const w = room('leo');
  const f = addFoe(w, 500, 0); f.speed = 0;
  syncAllies(w);
  run(w, 8);
  assert.equal(f.alive, false);
  run(w, 4);
  const a = w.allies[0];
  assert.equal(a.state, 'follow');
  assert.ok(Math.hypot(a.x - w.player.x, a.y - w.player.y) < ALLY.leo.followDist * 2.5);
});

test('A STUNNED FOE DOES NOTHING: no walking, no striking, and its wind-up is cancelled', () => {
  const w = room();
  const f = addFoe(w, 100, 0);
  for (let i = 0; i < 20; i++) { w.timeS += 1 / 60; updateFoes(w, 1 / 60); }
  assert.equal(f.state, 'windup');
  stunFoe(f, 1.0);
  assert.notEqual(f.state, 'windup', 'the wind-up survived the stun');
  const x0 = f.x, hp0 = w.hp;
  for (let i = 0; i < 50; i++) { w.timeS += 1 / 60; updateFoes(w, 1 / 60); }
  assert.equal(f.x, x0); assert.equal(w.hp, hp0, 'it hit while stunned');
  for (let i = 0; i < 30; i++) { w.timeS += 1 / 60; updateFoes(w, 1 / 60); }
  assert.ok(f.stunT === 0, 'the stun never wore off');
});

test('DONATELLO STAYS CLOSE TO RAPHAEL', () => {
  const w = room('donnie');
  syncAllies(w);
  w.player.x += 1200;
  run(w, 4);
  const d = w.allies[0];
  assert.ok(Math.hypot(d.x - w.player.x, d.y - w.player.y) < ALLY.donnie.followDist + 120);
});

test('THE STAFF IS A WIDE SWEEP: it hits foes on both sides of him, not just the one in front', () => {
  const w = room('donnie');
  syncAllies(w);
  const d = w.allies[0];
  d.cool = 0;                                       // ready to swing at once, so he is not walking while we measure
  const a = addFoe(w, 0, 0), b = addFoe(w, 0, 0);
  for (const f of [a, b]) { f.speed = 0; f.hp = f.maxHp = 1e6; }
  a.x = d.x + 200; a.y = d.y;                      // dead ahead
  b.x = d.x; b.y = d.y + 200;                       // 90 degrees off to one side
  run(w, 1.2);
  assert.ok(a.hp < 1e6 && b.hp < 1e6, 'the sweep missed one side');
});

test('EVERY STAFF HIT STUNS EVERYTHING IN A 30-DEGREE CONE, and nothing outside it', () => {
  const w = room('donnie');
  syncAllies(w);
  const d = w.allies[0];
  d.cool = 0;
  const mk = (x, y) => { const f = addFoe(w, 0, 0); f.speed = 0; f.hp = f.maxHp = 1e6; f.x = x; f.y = y; return f; };
  // the first one gives the staff something to hit, and fixes the facing (+x)
  const target = mk(d.x + 180, d.y);
  const farInCone = mk(d.x + 520, d.y + 40);       // ~4 degrees off the line, far away: stunned though never touched
  const outside = mk(d.x + 300, d.y + 300);        // 45 degrees off: not
  const behind = mk(d.x - 300, d.y);
  let stunned = 0;
  run(w, 1.0, 1 / 60, { onStun: () => stunned++ });
  assert.ok(stunned >= 1, 'the hit never fired the cone');
  assert.ok(target.stunT > 0 || target.hp < 1e6);
  assert.ok(farInCone.stunT > 0, 'an enemy down the line was not stunned');
  assert.equal(outside.stunT || 0, 0, 'an enemy 45 degrees off was stunned');
  assert.equal(behind.stunT || 0, 0, 'an enemy behind him was stunned');
});

test('A SWING THAT HITS NOTHING FIRES NO CONE', () => {
  const w = room('donnie');
  syncAllies(w);
  let fired = 0;
  run(w, 3, 1 / 60, { onStun: () => fired++ });
  assert.equal(fired, 0);
});

test('inCone is exactly as wide as asked', () => {
  const f = (x, y) => ({ x, y, radius: 10 });
  assert.equal(inCone(0, 0, 0, 30, 600, f(400, 0)), true);
  assert.equal(inCone(0, 0, 0, 30, 600, f(400, 90)), true);      // ~12.7 degrees
  assert.equal(inCone(0, 0, 0, 30, 600, f(400, 200)), false);    // ~26.6 degrees
  assert.equal(inCone(0, 0, 0, 30, 600, f(700, 0)), false);      // out of range
});

test('ALLIES CANNOT BE HURT: they carry no health at all', () => {
  const w = room('leo', 'donnie');
  syncAllies(w);
  for (const a of w.allies) assert.equal(a.hp, undefined);
});

test('kills by an ally are REPORTED, so the counter and the death burst still work', () => {
  const w = room('leo');
  const f = addFoe(w, 450, 0); f.speed = 0;
  let killed = 0;
  syncAllies(w);
  run(w, 8, 1 / 60, { onKill: () => killed++ });
  assert.equal(killed, 1);
});

// ---- THEY COME AND GO -------------------------------------------------------------
test('AN ALLY IS ON THE FIELD FOR ITS DURATION, THEN AWAY FOR ITS BREAK, THEN BACK', () => {
  for (const key of ['leo', 'donnie']) {
    const w = room(key);
    syncAllies(w);
    const a = w.allies[0];
    const act = ALLY[key].activeS, brk = ALLY[key].breakS;
    run(w, act - 0.5);
    assert.equal(a.present, true, `${key} left early`);
    run(w, 1.0);
    assert.equal(a.present, false, `${key} stayed past his time`);
    run(w, brk - 1.5);
    assert.equal(a.present, false, `${key} came back before the break was over`);
    run(w, 2.0);
    assert.equal(a.present, true, `${key} never came back`);
  }
});

test('AN ALLY THAT IS AWAY DOES NOTHING: no damage, no stun', () => {
  const w = room('leo', 'donnie');
  syncAllies(w);
  run(w, 9);                                   // both have gone
  assert.ok(w.allies.every((a) => !a.present));
  const f = addFoe(w, 100, 0); f.speed = 0; f.hp = f.maxHp = 1e6;
  run(w, 3);
  assert.equal(f.hp, 1e6);
  assert.equal(f.stunT || 0, 0);
});

test('EACH EXTRA COPY OF THE ABILITY ADDS TIME ON THE FIELD, and the break does not change', () => {
  assert.equal(durationOf('leo', 1), ALLY.leo.activeS);
  assert.equal(durationOf('leo', 3), ALLY.leo.activeS + 2 * ALLY.leo.upgradeS);
  const w = room('leo'); take(w.build, 'leo'); take(w.build, 'leo');      // level 3
  syncAllies(w);
  const a = w.allies[0];
  assert.equal(a.duration, durationOf('leo', 3));
  run(w, ALLY.leo.activeS + 1);
  assert.equal(a.present, true, 'the upgrade did not lengthen his stay');
  run(w, ALLY.leo.upgradeS * 2);
  assert.equal(a.present, false);
  assert.equal(a.timer <= ALLY.leo.breakS, true);
});

test('HIS UPTIME IS WELL UNDER HALF at the base level, so he is a burst and not a second weapon', () => {
  for (const key of ['leo', 'donnie']) {
    const up = ALLY[key].activeS / (ALLY[key].activeS + ALLY[key].breakS);
    assert.ok(up < 0.5, `${key} is on the field ${(up * 100).toFixed(0)}% of the time`);
  }
});

test('he comes back at the PLAYER, not where he left', () => {
  const w = room('leo');
  syncAllies(w);
  run(w, ALLY.leo.activeS + 1);
  w.player.x += 1500;                          // the player runs off during the break
  run(w, ALLY.leo.breakS);
  const a = w.allies[0];
  assert.equal(a.present, true);
  assert.ok(Math.hypot(a.x - w.player.x, a.y - w.player.y) < ALLY.leo.followDist * 2);
});
