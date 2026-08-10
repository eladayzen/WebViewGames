// AI SKATERS -- the field you compete against in the rivals mode.
//
// They are CLONES OF THE PLAYER'S RIG, not a second art path: same mesh, same
// skeleton, same idle clip, tinted per jersey. That costs more than the tinted
// billboard this started as, and it is worth it -- a billboard of a standing
// character with no board read as a pedestrian on the road the moment you got
// close to one. It also means the character only has to be authored once.
//
// THEY DO NOT RUN THE PLAYER'S CONTROLLER. That was considered and rejected on
// purpose: the controller is one system tuned around a human on a balance board,
// and driving a rival through it would need a synthetic input stream -- carve,
// tuck and brake per frame -- which is a harder AI problem than the one being
// solved, and would make every feel constant a constraint on the AI as well.
// What a rival needs is to be BELIEVABLE: the right pace, a plausible line, and
// points earned from the same things the player earns them from. So the LOOK is
// shared and the physics is a much simpler model borrowing the same grade and
// drag numbers.
//
// PERSONALITY IS A SEED, NOT A SCRIPT. Pace, weave and skill all come from the
// rival's index, so the field spreads out on its own and the same rival is
// recognisably the same rival every run.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toWorld, surfaceUp, frameAt, makeFrame } from '../world/trough.js';
import { SPEED_REF } from '../data/constants.js';

/** Distinct, high-contrast jerseys. The player is RED, so none of these are. */
const JERSEYS = [
  { name: 'ACE', colour: 0x6fd0ff },
  { name: 'NOVA', colour: 0x7ef0a8 },
  { name: 'RIFF', colour: 0xffd166 },
  { name: 'ZED', colour: 0xc98cff },
  { name: 'KIT', colour: 0xff9f5a },
];

/**
 * Deterministic 0..1 from a pad's position and a rival's index. Used so a rival
 * MISSES pads at a rate set by its skill -- but misses the same ones every run,
 * so a rival stays the character it was rather than being re-rolled each time.
 */
function hash01(a, b) {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createRivals(scene, rider) {
  const group = new THREE.Group();
  scene.add(group);

  /** @type {Array<object>} */
  let field = [];
  const _pos = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _basis = new THREE.Matrix4();
  const _frame = makeFrame();

  function makeBoard() {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.06, 1.15),
      new THREE.MeshBasicMaterial({ color: 0xdcb079 }),
    );
    g.add(deck);
    return g;
  }

  /**
   * Attach the cloned rig to a rival. Split out of spawn() because the FBX
   * loads asynchronously and a run can start before it is ready -- which is
   * exactly what happened: spawn() saw a null prefab, every rival got a bare
   * skateboard with no body on it, and nothing errored to say so. Bodies are
   * attached now if the rig is loaded and as soon as it loads if it is not.
   */
  function attachBody(r, index) {
    const prefab = rider.rigPrefab();
    // The clips load AFTER the rig itself, so a prefab can exist with an empty
    // clip table. Attaching then gave a body that never animated and nothing to
    // say why -- which is exactly how it looked: rivals standing still on the
    // road. Waiting for both is what makes them move.
    if (!prefab || r.mixer || Object.keys(prefab.clips).length === 0) return;
    // SkeletonUtils.clone(), not Object3D.clone(): a skinned mesh needs its
    // bones rebound to the CLONE's skeleton, and a plain clone leaves every
    // copy driven by the original's bones -- they would all move as one.
    const body = cloneSkinned(prefab.object);
    body.traverse((n) => {
      if (!n.isMesh) return;
      n.frustumCulled = false;
      // Clone the material so tinting one rival does not tint them all --
      // the source material is shared with the player.
      n.material = n.material.clone();
      n.material.color = new THREE.Color(r.colour);
    });
    r.holder.add(body);
    r.mixer = new THREE.AnimationMixer(body);
    const idle = prefab.clips.idle || Object.values(prefab.clips)[0];
    if (idle) {
      const action = r.mixer.clipAction(idle);
      action.setLoop(THREE.LoopRepeat);
      // Offset so the field is not a chorus line -- four identical rigs
      // breathing in perfect sync reads as one object copied, not four skaters.
      action.time = index * 0.37;
      action.play();
    }
  }

  function spawn(count, startS) {
    despawn();

    for (let i = 0; i < count; i++) {
      const jersey = JERSEYS[i % JERSEYS.length];
      const holder = new THREE.Group();
      group.add(holder);

      let mixer = null;
      holder.add(makeBoard());

      const rival = {
        name: jersey.name,
        index: i,
        colour: jersey.colour,
        holder,
        mixer,
        s: startS + 6 + i * 4.5,
        theta: (i - (count - 1) / 2) * 0.13,
        speed: SPEED_REF * 0.8,
        score: 0,
        // PACE, and this is the number that decides whether the race is a race.
        //
        // It was anchored to a PERFECT tuck -- 0.98..1.27, topping out at the
        // 38 u/s a rider holding forward the whole way reaches. That is the
        // wrong reference: nobody rides a whole run in a perfect tuck, least of
        // all on a balance board, so in practice the field simply left and never
        // came back. Amit: "I lose them and cannot catch up after 3 seconds."
        //
        // Anchored to a COASTING rider instead. Terminal speed without tucking
        // is sqrt(GRADE_ACCEL/DRAG) ~= 30.8 u/s, and the field now straddles it:
        // 24.0 / 26.6 / 29.2 / 31.8. Coast and you sit mid-pack with the leader
        // in sight, tuck and you reel them in, make a mess of a section and they
        // get away. The first attempt at this put the whole field UNDER a coast
        // (top 28.8) and a player giving no input at all won by 151 m -- slower
        // than "too fast" is not the same as right.
        pace: 0.80 + (i / Math.max(1, count - 1)) * 0.26,
        // SKILL decides how much of the course a rival converts into points.
        // Spread wide so the leaderboard is not just the pace ladder again.
        skill: 0.62 + ((i * 7) % 5) / 5 * 0.5,
        weaveAmp: 0.18 + (i % 3) * 0.06,
        weaveRate: 0.55 + (i % 4) * 0.13,
        weavePhase: i * 1.7,
        t: 0,
        boostT: 0,
        boostSpeed: 0,
      };
      field.push(rival);
      attachBody(rival, i);
    }

    // If the rig was still loading, come back for the bodies once it lands.
    // Guarded on the field still being the same one, so a mode switch during
    // the load cannot resurrect a despawned rival.
    if (!field[0].mixer) {
      const spawned = field;
      rider.ready.then(() => {
        if (field !== spawned) return;
        field.forEach(attachBody);
      });
    }
  }

  function despawn() {
    for (const r of field) {
      if (r.mixer) r.mixer.stopAllAction();
      r.holder.traverse((n) => {
        if (n.isMesh && n.material && n.material.dispose) n.material.dispose();
      });
      group.remove(r.holder);
    }
    field = [];
  }

  return {
    get field() { return field; },
    spawn,
    despawn,

    /**
     * @param {number} dt
     * @param {number} playerS -- used only to cull, never to rubber-band.
     * @param {object} props -- the live prop field, so rivals earn points from
     *   the same launchers, rails and pickups the player does.
     *
     * NO RUBBER-BANDING. It is the obvious way to keep a contest close and it is
     * why competitive AI so often feels fake: if the field improves when you are
     * ahead, your own riding stops meaning anything.
     */
    update(dt, playerS, props) {
      for (const r of field) {
        r.t += dt;
        // A boost RAISES THE TARGET for a while rather than adding to the speed
        // directly. Adding to the speed did nothing: the pace-seeking term below
        // pulls the rival back to its target within about a second and a half,
        // so every pad a rival took evaporated before it covered any ground,
        // while the player's decayed slowly through drag alone. Measured with
        // the naive version: the player won by 257 m without even steering for
        // the pads.
        if (r.boostT > 0) r.boostT = Math.max(0, r.boostT - dt);
        const target = SPEED_REF * r.pace + (r.boostT > 0 ? r.boostSpeed : 0);
        // EASE STRAIGHT TO THE TARGET. This used to run the player's own
        // grade-minus-drag law with a pace-seeking term added on top, which
        // looked principled and was quietly wrong: the two terms fight, so a
        // rival settles wherever they balance rather than at its pace. Measured
        // -- ZED was set to 38.1 u/s and settled at 34.4, and the error grew
        // with pace, so the whole field ran slower than intended and the fastest
        // rival was penalised most. The hill is already baked into what a pace
        // MEANS; simulating it twice just made the number a lie.
        r.speed += (target - r.speed) * Math.min(1, dt * 1.8);
        const prevS = r.s;
        r.s += r.speed * dt;
        r.theta = Math.sin(r.t * r.weaveRate + r.weavePhase) * r.weaveAmp;

        // --- points, from the same course the player rides -------------------
        // A rival scores off whatever it passes, scaled by its skill: a good one
        // converts most of what it goes past, a poor one misses. Deliberately
        // NON-CONSUMING -- a rival taking a crystal out from under the player
        // would make the leaderboard a race to the pickups rather than a contest
        // of riding, and losing points to something off-screen reads as a bug.
        if (props) {
          for (const it of props.active) {
            if (it.s <= prevS || it.s > r.s) continue;
            const def = it.def;
            if (def.kind === 'launch') r.score += (def.launch.points || 0) * r.skill;
            else if (def.kind === 'grind') {
              // Grinds pay PER SECOND for the player, not per rail, so a flat
              // `points` field does not exist here -- reading one produced NaN
              // and poisoned the whole leaderboard. A rival's grind is worth
              // roughly the seconds it would spend on the bar: the prop's own
              // length over its speed.
              const seconds = it.def.size.l / Math.max(1, r.speed);
              r.score += def.grind.pointsPerSecond * seconds * r.skill;
            }
            else if (def.kind === 'boost') {
              // Rivals take pads too. Without this the player had a speed source
              // the field could not answer, and a 90-second race was decided by
              // 30 seconds: measured 84 m clear before this existed. Scaled by
              // skill and gated on their line, so a pad is still something a
              // good rival takes and a poor one drifts past.
              // A rival must be near the pad AND actually take it. Being on the
              // line alone meant they took every single pad they passed while
              // the player has to steer onto each one -- so the field had a
              // speed source the player was paying for and they were not, and it
              // pulled away no matter how the paces were tuned.
              const gap = Math.abs(it.theta - r.theta);
              if (gap < 0.16 && hash01(it.s, r.index) < r.skill * 0.7) {
                r.boostT = def.boost.seconds;
                // Capped the same way the player's is, and against the same
                // ceiling -- an uncapped stack ran away on both sides.
                r.boostSpeed = Math.min(
                  def.boost.ceiling - SPEED_REF * r.pace, def.boost.speed * r.skill);
              }
            }
            else if (def.kind === 'pickup') {
              // Only if it was actually near their line -- a rival on the far
              // wall did not collect anything.
              const gap = Math.abs(it.theta - r.theta);
              if (gap < 0.14) r.score += (def.pickup.points || 0) * r.skill;
            }
          }
        }

        // --- place them on the road -----------------------------------------
        toWorld(r.s, r.theta, _pos);
        surfaceUp(r.s, r.theta, _up);
        r.holder.position.copy(_pos);
        // Face down the road, standing on the surface normal. Built as an
        // explicit basis for the same reason the props are: lookAt's axis
        // convention differs between cameras and meshes.
        const f = frameAt(r.s, _frame);
        // NEGATED. The prefab is authored facing AWAY from the camera -- rider.js
        // applies rotation.y = PI to it -- and a clone carries that with it. Put
        // local +Z on the tangent and that built-in flip turns the rival around
        // to look back up the road at you, which is exactly what it was doing.
        // Local +Z goes up-road so the flip lands it down-road.
        _fwd.copy(f.tangent).negate();
        _right.crossVectors(_up, _fwd).normalize();
        _basis.makeBasis(_right, _up, _fwd);
        r.holder.quaternion.setFromRotationMatrix(_basis);

        const visible = r.s > playerS - 120 && r.s < playerS + 300;
        r.holder.visible = visible;
        // Skinning is the expensive part, so the mixer only runs for rivals
        // that are actually on screen. An off-screen rival still moves and
        // still scores -- it just is not animated.
        if (r.mixer && visible) r.mixer.update(dt);
      }
    },
  };
}
