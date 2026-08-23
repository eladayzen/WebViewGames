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

  // §5.7: sector 2, Kesselring Yards. §6.4: "Brood Gantry -- carrier disgorging
  // drones from bays across the width", "Pods are launch bays that emit drones
  // on a timer; killing a bay stops its stream."
  //
  // AMIT'S BRIEF FOR IT: "now you understand how the first boss works. Now you
  // can try and make something more interesting on how we kill it."
  //
  // -------------------------------------------------------------------------
  // WHY THIS IS A ROW AND NOT A SYSTEM.
  //
  // The pod / pattern-shedding / vulnerable-window framework in
  // /enemies/boss.js was built for exactly this and then went unused, because
  // boss one was re-cut to a hull boss. Everything below turns it back on with
  // no new machinery: four pods each owning a bullet pattern, a core gated
  // behind them, a vulnerable window that doubles core damage for an optional
  // climb, the WARNING band, the staged death. The only genuinely new behaviour
  // is the bay's open/shut cycle and its drone stream, and both are
  // per-pod fields read by the shared machine (BOSS.bay in /data/tuning.js).
  //
  // WHY THE MECHANIC IS THE OPEN/SHUT CYCLE.
  //
  // Boss one's failure was not its design, it was that a mechanically correct
  // fight READ as invulnerable -- pods unmarked, hull hits silent. So the test
  // for boss two's mechanic is not "is it interesting", it is "can a player who
  // has never been told anything work it out by shooting for four seconds".
  //
  // A bay that is launching drones at you is open, lit magenta, reticled, and
  // damageable. A bay that is shut is a flat armoured disc, its reticle dimmed,
  // and bolts ring off it with the deflect burst the player already learned on
  // boss one's armour. THE THING SHOOTING AT YOU IS THE THING YOU CAN KILL --
  // that sentence is the whole tutorial, and it is delivered entirely by what
  // the frame looks like. Two to three of the four are open at any moment
  // (BOSS.bay, asserted by the validator), so there is never a beat where the
  // right answer is to wait.
  //
  // DO-NOT-PORT COMPLIANCE (§5.5), which a drone-launching boss could easily
  // breach: the launched craft fly ENEMY.fragment's LATERAL exit arc and stop
  // at y = 0.58, so there is no straight-down plunge, no fire from below the
  // player band and no simultaneous top-and-bottom pressure. The bays
  // themselves run B1, B2 and B2T -- three patterns the player met in level
  // two's waves -- so the fight introduces no new bullet vocabulary at all.
  broodGantry: {
    id: 'broodGantry',
    built: true,
    name: 'BROOD GANTRY',
    hullKey: 'bossBroodGantryHull',

    // Three bay states, one shared cell rect (art/build_assets.py). `podShutKey`
    // is the field boss two adds to the vocabulary; a boss without it simply
    // never has a shut pod, which is how Nadir Coil will read.
    podKey: 'bossBayOpen',
    podShutKey: 'bossBayShut',
    podDeadKey: 'bossBayDead',
    // Nested inside the hull's own drawn sockets so the socket ring frames the
    // bay and the reticle lands on the ring. Slightly under the shot channel's
    // 124 px so what you see is never wider than what you hit.
    podSpriteWidth: 126,
    podNoun: 'BAY',

    // MEASURED OFF THE SHIPPED ART, not chosen. The hull texture draws four
    // empty launch sockets at 10.5 / 32.5 / 67.5 / 89.5 % of its width and a
    // shuttered core hatch at the centre; these are those positions. The
    // validator independently proves they clear each other's shot channels,
    // clear the core's, stay out of the HUD margins, and every one of them sits
    // inside the player's own lateral clamp so lateral movement alone can line
    // up under it.
    coreDx: 0.5,
    pods: [
      // `launches` opts a pod into the drone stream; `phase` staggers its
      // open/shut cycle so the four are never in lockstep.
      { dx: 0.105, pattern: 'B1',  launches: true, phase: 0.00 },
      { dx: 0.325, pattern: 'B2',  launches: true, phase: 0.25 },
      { dx: 0.675, pattern: 'B2T', launches: true, phase: 0.50 },
      { dx: 0.895, pattern: 'B1',  launches: true, phase: 0.75 },
    ],

    // Bigger than BOSS.coreHp's shared 30, because this fight's shape is
    // different: four 6 HP bays are only 24 points and they are shootable for
    // barely half the fight, so the core has to be where the length actually
    // lives. 80 points is ~8.4 s of unbroken rank-1 fire, which lands the whole
    // fight in §5.7's 35-45 s band once dodging and the shut-door beats are
    // counted. Per-boss, so boss three can be a different length without
    // touching boss two.
    coreHp: 80,
  },

  // §5.7: sector 3, The Bulwark. §6.4: "Nadir Coil -- segmented hive-serpent
  // strung horizontally", "the pods are body segments and the serpent visibly
  // shortens as they die. Runs B4."
  //
  // -------------------------------------------------------------------------
  // A THIRD MECHANIC, NOT A THIRD BOSS WITH BIGGER NUMBERS.
  //
  // Boss one: one HP pool, hit it anywhere. Boss two: four bays on a clock,
  // shoot whichever is open. Boss three: THE ENDS. Only the two outermost
  // living segments are exposed; the ones between are clamped behind their
  // neighbours' couplings. Kill an end and the coil visibly retracts and the
  // next segment inward opens, so the fight walks from the outside in toward
  // the core and the player's lateral beat gets shorter as it goes.
  //
  // The full reasoning -- why this is a genuinely different question from boss
  // two's, why it is discoverable with no tutorial line, and the two guarantees
  // that keep it safe -- is in BOSS.coil in /data/tuning.js, beside the numbers
  // it is made of. What belongs HERE is what makes it a row:
  //
  //   * `gate: 'ends'` picks the ends rule instead of the bay clock. Both are
  //     modes of the same `open` flag the shared machine already gates damage,
  //     firing and reticles on, so /enemies/boss.js gained one small update
  //     function and nothing else. A boss with neither gate has permanently
  //     open pods, which is Cinderjaw and every future plain pod boss.
  //   * The segments carry patterns the player has met -- B1, B2, B2T -- plus
  //     B4, which level three's own Emitters have already been running for six
  //     waves. So the fight introduces ONE new thing, its mechanic, which is
  //     the rule boss two established and this one keeps.
  //
  // DO-NOT-PORT COMPLIANCE (§5.5): the hull sits entirely above the player band
  // and never descends, every segment fires downward from the station line, and
  // there is nothing here that launches craft. No simultaneous top-and-bottom
  // pressure, no plunge, no diagonal curtain.
  nadirCoil: {
    id: 'nadirCoil',
    built: true,
    name: 'NADIR COIL',
    hullKey: 'bossNadirCoilHull',

    // Three segment states through one shared cell rect (art/build_assets.py),
    // the same three-texture vocabulary Brood Gantry's bays use -- deliberately,
    // because the player learned "lit = shootable, dark shutter = armoured, char
    // = dead" on boss two and re-reading it here costs them nothing.
    podKey: 'bossCoilOpen',
    podShutKey: 'bossCoilShut',
    podDeadKey: 'bossCoilDead',
    // Nested inside the hull's own drawn ring sockets so the socket frames the
    // segment, and just inside the shot channel's 124 px so what you see is
    // never wider than what you hit.
    podSpriteWidth: 118,
    podNoun: 'SEGMENT',
    gate: 'ends',

    // MEASURED OFF THE SHIPPED ART, not chosen -- and verified by drawing these
    // five dx values back onto the keyed hull and looking at where the circles
    // landed (art/tmp/nadir-marked2.png; the procedure is written up in
    // art/build_assets.py). The spacing is not even because the generator did
    // not draw it evenly, and the data has to agree with the picture.
    coreDx: 0.4949,
    pods: [
      { dx: 0.1245, pattern: 'B1' },
      { dx: 0.3066, pattern: 'B4' },
      { dx: 0.6982, pattern: 'B4' },
      { dx: 0.8239, pattern: 'B2' },
    ],

    // PER-BOSS, and both numbers are set by the shape of THIS fight rather than
    // by the framework's defaults.
    //
    // Segments are 20 HP against the shared 6 because only TWO of the four are
    // ever shootable at once -- so where Brood Gantry's four bays can be worked
    // in parallel, the coil is inherently a SERIAL fight and its per-target cost
    // has to carry that. 4 x 20 = 80 bolts is ~8.4 s of unbroken rank-1 fire
    // spread across four relocations.
    //
    // MEASURED, NOT GUESSED. The first pass authored 14/60 and a perfect-tracking
    // autopilot -- one that relocates instantly and never dodges -- killed the
    // whole fight in 18.8 s, which is the floor a real player is slower than but
    // not by a factor of two. §5.7 wants a boss in the 35-45 s band. At 20/80 the
    // same autopilot takes ~26 s, which leaves the right amount of room for
    // relocation and dodging to fill.
    //
    // The core is 80, matching Brood Gantry's. Its length is carried by the
    // segments rather than by the core here (they are shootable for the whole
    // fight rather than half of it), so the core is the fight's last beat and
    // not its bulk.
    podHp: 20,
    coreHp: 80,
  },
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
