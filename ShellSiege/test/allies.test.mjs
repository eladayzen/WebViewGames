// THE OTHER TURTLES. These are about what each one is FOR -- Leonardo blinks to a
// foe and cuts it, Donatello stuns -- and that stun really stops a foe.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { makeFoe, updateFoes } from '../src/core/foes.js';
import { take } from '../src/core/abilities.js';
import { shieldCut, shieldActive, shieldCooldown, updateGrenades, syncAllies as realSync, updateAllies, stunFoe, inCone, durationOf, ALLY, RISE_S } from '../src/core/allies.js';

// A new ally STARTS ON COOLDOWN (tested at the bottom). Everything else here is about
// what a turtle does once he is on the field, so this puts him there, fully risen.
function syncAllies(w) {
  realSync(w);
  for (const a of w.allies) if (a.phase === 'away' && a.timer === ALLY[a.key].firstS && !a.called) {
    a.called = true; a.phase = 'active'; a.present = true; a.rise = RISE_S;
    a.timer = a.duration = durationOf(a.key, w.build[a.key] || 1);
  }
}

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
  f.speed = 0; f.hp = f.maxHp = 30;      // mechanics, not balance: a short fight inside his shorter stay
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
  const f = addFoe(w, 500, 0); f.speed = 0; f.hp = f.maxHp = 30;
  syncAllies(w);
  run(w, 5);
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

test('THE NUNCHUCKS ARE A WIDE SWEEP: they hit foes on both sides of him, not just the one in front', () => {
  const w = room('mikey');
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

test('EVERY NUNCHUCK HIT STUNS EVERYTHING IN A 30-DEGREE CONE, and nothing outside it', () => {
  const w = room('mikey');
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
  const w = room('mikey');
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
  const f = addFoe(w, 450, 0); f.speed = 0; f.hp = f.maxHp = 30;
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

// ---- MICHELANGELO ------------------------------------------------------------------
import { updatePizzas } from '../src/core/allies.js';

afterEach(() => { ALLY.mikey.bakes = false; });
function hurtRoom() { ALLY.mikey.bakes = true; const w = room('mikey'); w.maxHp = 100; w.hp = 40; return w; }

test('MICHELANGELO BAKES A PIZZA WHEN YOU ARE HURT, and only then', () => {
  const w = hurtRoom();
  syncAllies(w);
  run(w, 4);
  assert.ok((w.pizzas || []).length >= 1, 'no pizza when hurt');
  const w2 = room('mikey'); w2.maxHp = w2.hp = 100;
  syncAllies(w2);
  run(w2, 6);
  assert.equal((w2.pizzas || []).length, 0, 'baked for a player at full health');
});

test('WALKING ONTO A PIZZA HEALS YOU AND USES IT UP', () => {
  const w = hurtRoom();
  w.pizzas = [{ x: w.player.x + 20, y: w.player.y, from: { x: 0, y: 0 }, age: 0, alive: true, heal: 0.10, lifeS: 9 }];
  let ate = 0;
  updatePizzas(w, 1 / 60, { onPizza: () => ate++ });
  assert.equal(w.hp, 50);
  assert.equal(ate, 1);
  assert.equal(w.pizzas.length, 0);
});

test('A PIZZA FAR AWAY IS LEFT ALONE, and it spoils after its time', () => {
  const w = hurtRoom();
  w.pizzas = [{ x: w.player.x + 600, y: w.player.y, from: { x: 0, y: 0 }, age: 0, alive: true, heal: 0.10, lifeS: 2 }];
  updatePizzas(w, 1 / 60, {});
  assert.equal(w.hp, 40);
  for (let i = 0; i < 130; i++) updatePizzas(w, 1 / 60, {});
  assert.equal(w.pizzas.length, 0, 'it never went off');
});

test('A PIZZA DOES NOTHING FOR A PLAYER AT FULL HEALTH and is not wasted', () => {
  const w = hurtRoom(); w.hp = w.maxHp;
  w.pizzas = [{ x: w.player.x, y: w.player.y, from: { x: 0, y: 0 }, age: 0, alive: true, heal: 0.10, lifeS: 9 }];
  updatePizzas(w, 1 / 60, {});
  assert.equal(w.pizzas.length, 1, 'eaten at full health');
});

test('HE NEVER LITTERS THE FLOOR: at most maxOut pizzas at a time', () => {
  const w = hurtRoom(); w.hp = 1;
  syncAllies(w);
  const nobody = () => 1e9;
  run(w, 7.5);
  assert.ok((w.pizzas || []).length <= ALLY.mikey.maxOut);
});

test('MORE COPIES OF THE ABILITY HEAL MORE PER PIZZA', () => {
  const heal = (copies) => {
    const w = hurtRoom();
    for (let i = 1; i < copies; i++) take(w.build, 'mikey');
    syncAllies(w);
    run(w, 3);
    return w.pizzas[0].heal;
  };
  assert.ok(heal(3) > heal(1));
});

test('THE DORMANT HEALING MICHELANGELO NEVER HURTS ANYTHING', () => {
  const w = hurtRoom();
  const f = addFoe(w, 120, 0); f.speed = 0; f.hp = f.maxHp = 1e6;
  syncAllies(w);
  run(w, 8);
  assert.equal(f.hp, 1e6);
  assert.equal(f.stunT || 0, 0);
});

// ---- A ROOM OPENS WITH THE COOLDOWN, AND A TURTLE IS SUMMONED, NOT SWITCHED ON -----
test('A NEW ROOM STARTS WITH THE COOLDOWN: he is not there until the break has run out', () => {
  for (const key of ['leo', 'donnie', 'mikey']) {
    const w = room(key);
    realSync(w);
    const a = w.allies[0];
    assert.equal(a.present, false, `${key} was standing there when the room began`);
    assert.equal(a.phase, 'away');
    run(w, ALLY[key].firstS - 1);
    assert.equal(a.present, false, `${key} came early`);
    run(w, 1.5);
    assert.equal(a.present, true, `${key} never arrived`);
  }
});

test('WHEN CALLED HE RISES FIRST: rooted, doing nothing, with a light pop, then acts', () => {
  const w = room('leo');
  realSync(w);
  const a = w.allies[0];
  run(w, ALLY.leo.firstS + 0.05);
  assert.equal(a.present, true);
  assert.ok(a.rise < RISE_S, 'he arrived already risen');
  const f = addFoe(w, 450, 0); f.speed = 0;
  const x0 = a.x, y0 = a.y;
  run(w, RISE_S * 0.5);
  assert.equal(a.x, x0); assert.equal(a.y, y0);
  assert.equal(a.state, 'follow', 'he started fighting while still coming out of the floor');
  run(w, 2);
  assert.ok(a.rise >= RISE_S);
});

test('THE TURTLES ARE STAGGERED: by default no two arrive together', () => {
  const t = ['leo', 'donnie', 'mikey'].map((k) => ALLY[k].firstS).sort((a, b) => a - b);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= 2, 'two turtles arrive within 2s of each other');
});

// ---- DONATELLO, THE CLOSE GUARD ---------------------------------------------------
import { stepShield } from '../src/core/allies.js';
import { hurtPlayer } from '../src/core/foes.js';

test('DONATELLO NEVER CHASES: a foe out of reach is left alone and he stays at the shoulder', () => {
  const w = room('donnie');
  syncAllies(w);
  const d = w.allies[0];
  const f = addFoe(w, 700, 0); f.speed = 0; f.hp = f.maxHp = 1e6;
  run(w, 3);
  assert.equal(f.hp, 1e6, 'he went after it');
  assert.ok(Math.hypot(d.x - w.player.x, d.y - w.player.y) < ALLY.donnie.followDist + 80);
});

test('HE JABS WHAT COMES WITHIN REACH, WHILE MOVING, for very little', () => {
  const w = room('donnie');
  syncAllies(w);
  const d = w.allies[0];
  const f = addFoe(w, 0, 0); f.speed = 0; f.hp = f.maxHp = 1e6; f.x = d.x + 120; f.y = d.y;
  let walkedWhileSwinging = false;
  for (let t = 0; t < 2; t += 1 / 60) {
    w.player.x += 8;                              // the player keeps running
    f.x = d.x + 120; f.y = d.y;                   // and something stays within his reach
    w.timeS += 1 / 60; updateAllies(w, 1 / 60, {});
    if (d.slashT >= 0 && d.walking) walkedWhileSwinging = true;
  }
  assert.ok(f.hp < 1e6, 'no jab landed');
  assert.ok(walkedWhileSwinging, 'he stopped to attack');
  assert.ok(ALLY.donnie.staffDamage <= 6 && ALLY.donnie.staffDamage < ALLY.leo.damage / 2, 'the jab is not minimal');
  assert.equal(f.stunT || 0, 0, 'Donatello no longer stuns');
});

test('THE SHIELD IS ITS OWN ABILITY: up with no turtle, and it CUTS every hit while it is on', () => {
  const w = room('shield');
  w.maxHp = w.hp = 1000;
  stepShield(w, 1 / 60, {});
  assert.equal(w.allies.length, 0);
  assert.equal(w.shield.up, true);
  for (let i = 0; i < 5; i++) hurtPlayer(w, 20);                   // many hits: it is not spent by them
  assert.equal(w.shield.up, true, 'hits turned the shield off');
  assert.equal(w.hp, 1000 - 5 * Math.round(20 * (1 - shieldCut(1))));
});

test('THE SHIELD RUNS AN ON-OFF LOOP, whatever is hitting it', () => {
  const w = room('shield');
  w.maxHp = w.hp = 1e6;
  const states = [];
  for (let t = 0; t < 40; t += 1 / 60) { stepShield(w, 1 / 60, {}); states.push(w.shield.up); }
  const on = states.filter(Boolean).length / 60, off = states.length / 60 - on;
  assert.ok(on > shieldActive(1) * 2 && off > shieldCooldown(1) * 2, `on ${on}s off ${off}s: no loop`);
  const flips = states.filter((v, i) => i && v !== states[i - 1]).length;
  assert.ok(flips >= 5, 'it should cycle several times in 40 s');
  const w2 = room('shield'); w2.maxHp = w2.hp = 1e6;
  for (let t = 0; t < shieldActive(1) + 0.5; t += 1 / 60) stepShield(w2, 1 / 60, {});
  assert.equal(w2.shield.up, false, 'it did not switch off after its time');
  const before = w2.hp; hurtPlayer(w2, 20);
  assert.equal(w2.hp, before - 20, 'an OFF shield cut a hit');
});

test('MORE COPIES CUT MORE, STAY ON LONGER AND STAY OFF LESS, never to 100%', () => {
  assert.ok(shieldCut(3) > shieldCut(1));
  assert.ok(shieldActive(3) > shieldActive(1));
  assert.ok(shieldCooldown(3) < shieldCooldown(1));
  assert.ok(shieldCut(99) < 1);
});

test('DONATELLO DOES NOT RAISE A SHIELD', () => {
  const w = room('donnie');
  syncAllies(w); stepShield(w, 1 / 60, {});
  assert.equal(w.shield.up, false);
});

test('GRAVITY GRENADES PULL LIGHT FOES FAR AND HEAVY FOES LITTLE', () => {
  const w = room('donnie');
  const light = addFoe(w, 200, 0, 'slayer'), heavy = addFoe(w, -200, 0, 'fortgolem');
  w.grenades = [{ x: w.player.x, y: w.player.y, from: { x: 0, y: 0 }, age: 0, flightS: 0.1, landed: true, alive: true, lifeS: 2, radius: 330 }];
  const l0 = Math.hypot(light.x - w.player.x, light.y - w.player.y), h0 = Math.hypot(heavy.x - w.player.x, heavy.y - w.player.y);
  for (let t = 0; t < 0.12; t += 1 / 60) updateGrenades(w, 1 / 60, {});
  const dl = l0 - Math.hypot(light.x - w.player.x, light.y - w.player.y);
  const dh = h0 - Math.hypot(heavy.x - w.player.x, heavy.y - w.player.y);
  assert.ok(dl > 40, 'the slayer was not dragged');
  assert.ok(dl > dh * 4, `mass made no difference: ${dl} vs ${dh}`);
});

test('DONATELLO THROWS A GRENADE AT A CROWD', () => {
  const w = room('donnie');
  syncAllies(w);
  for (let i = 0; i < 4; i++) addFoe(w, 400 + i * 20, i * 10);
  run(w, 4);
  assert.ok((w.grenades || []).length >= 1, 'no grenade thrown');
});
