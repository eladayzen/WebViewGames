// Per-boss data (§6.4). Plain data -- the framework is /enemies/boss.js and
// the shared numbers are BOSS in /data/tuning.js.
//
// §6.4: "Per-boss flavour is in the pod layout and pattern assignment, not in
// new systems." That is the load-bearing sentence for this file, and the
// reason the framework was worth building before the boss: level one's boss is
// three sprites and the rows below, and levels two and three are rows.
//
// The POC-8 decision note cuts five bosses to three. ONE is built. The other
// two are declared here with `built: false` so the surface table can already
// name them and the validator can already say what is missing, rather than the
// campaign silently looping through a surface with no ending.

// TWO KINDS OF ROW, ONE FRAMEWORK. Read this before adding a boss.
//
// §6.4's shared machine supports pods -- each owning one pattern, gating a core,
// with an optional vulnerable window. A boss that wants all of that authors
// `pods` + `coreDx`. A boss that wants none of it authors `hullHp` instead and
// becomes a HULL BOSS: one pool, damaged by a bolt anywhere in its silhouette.
//
// The two are mutually exclusive and the framework picks by looking at the row,
// not by branching on an id (see bossIsHullBoss below). That is the whole reason
// §6.4 insisted "per-boss flavour is in the pod layout and pattern assignment,
// not in new systems" -- making boss one simple had to be a simpler ROW, not a
// fork in /enemies/boss.js, or bosses two and three would inherit the fork.
export const BOSSES = {
  // §5.7: sector 1, Ashfall Crust. §6.4 originally specced this as "Cinderjaw |
  // Pods are hull batteries; runs B1 + B2. The teaching boss."
  //
  // AMIT RE-CUT IT (boss playtest, after the fight shipped undamageable):
  //
  //   "this first boss needs to be simply one big HP thing like super easy
  //    super simple to understand there's lots of HP has its own HP bar above
  //    it no tricks nothing super interesting to see"
  //
  // So the teaching boss now teaches exactly one thing -- "a big thing arrived,
  // shoot it until it dies" -- and the pod/core/window structure moves to bosses
  // two and three, which are still specced that way in §6.4's table. This is a
  // scope reduction of the ROW, and it is worth being precise about why it is
  // the right one rather than a retreat: the fight was unreadable in three
  // separate ways at once (nothing marked the pods, nothing acknowledged a hull
  // hit, and the pooled HP bar moved 1.9% per bolt), and a first boss is the
  // worst possible place to debug legibility. A boss whose entire rule is
  // "shoot it" cannot be misread.
  //
  // DELIBERATELY UNEXCITING. "No tricks, nothing super interesting to see" is a
  // requirement, not a licence to compensate elsewhere -- do not add a phase
  // change, a shield cycle, a weak point or a second stage to this row.
  cinderjaw: {
    id: 'cinderjaw',
    built: true,
    name: 'CINDERJAW',
    hullKey: 'bossCinderjawHull',

    // ONE POOL. 240 bolts of 1 damage at rank 1's 9.52 bolts/s is ~25 s of
    // sustained fire, and because auto-fire is unconditional and the hull spans
    // 70% of the frame width directly overhead, on-target time is near total --
    // so 25 s is close to the real fight length rather than a best case. "Lots
    // of HP" without becoming a chore.
    //
    // ONE BOLT IS 0.42% OF THIS, which is the trap the previous readout fell
    // into and the reason /ui/hud.js shows a ticking integer beside the bar as
    // well as the bar itself. A big pool is only "super simple to understand" if
    // a single shot visibly moves something.
    hullHp: 240,

    // No pods, no core, no vulnerable window. The empty list is not an
    // oversight and must not be "filled in" -- it is what makes this a hull
    // boss, and /systems/constraints.js asserts a row has one shape or the
    // other, never both and never neither.
    pods: [],

    // The hull fires for itself, since there are no pods to own patterns. Still
    // only the two patterns the player has already met (§6.4: "runs B1 + B2") --
    // B1 from the drones, B2 from the Emitters -- so the boss introduces no new
    // bullet vocabulary at all. Both fire from the hull's centreline, well above
    // the player band.
    //
    // Capped at §5.3's simultaneous-pattern limit, which the validator checks:
    // two entries is exactly the Normal cap, so this cannot breach it and
    // cannot grow without the validator saying so.
    hullPatterns: ['B1', 'B2'],
  },

  // Not built. Declared so /data/surfaces.js can name them and the validator
  // can report the gap out loud instead of the campaign quietly looping.
  //
  // THESE TWO ARE THE POD BOSSES. §6.4's table gives Brood Gantry launch bays
  // and Nadir Coil body segments, both of which are "destroying it removes that
  // pattern permanently" by construction -- so the pod machine in
  // /enemies/boss.js exists for them and stays. When either is authored it gets
  // `pods` + `coreDx` and no `hullHp`, and every part of the framework boss one
  // does not touch comes back on with no code change.
  broodGantry: { id: 'broodGantry', built: false, name: 'BROOD GANTRY' },
  nadirCoil: { id: 'nadirCoil', built: false, name: 'NADIR COIL' },
};

export function bossDef(id) {
  return BOSSES[id];
}

/** Is there a real, fightable boss for this id? */
export function bossIsBuilt(id) {
  const b = BOSSES[id];
  return !!(b && b.built);
}

/**
 * Is this row a hull boss -- one pool, hit it anywhere -- rather than a
 * pod/core boss?
 *
 * Derived from the DATA, deliberately, so no system anywhere branches on a boss
 * id. Everything that behaves differently between the two kinds asks this one
 * question, which is what keeps "a boss is a table row" true.
 */
export function bossIsHullBoss(def) {
  return !!(def && def.hullHp > 0);
}
