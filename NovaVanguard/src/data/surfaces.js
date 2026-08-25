// The sector surfaces (§5.4). Plain data -- no renderer types here.
//
// §5.4 lists five surfaces at MVP. The POC-8 decision note cut the campaign to
// THREE LEVELS ("§5.4's five surfaces become three [...] one more to
// generate"); the Hive Plate is a FOURTH added on top of that cut, so the list
// is four rows rather than three:
//
//   1. Ashfall Crust    -- cracked black rock, glowing magma fissures
//   2. Kesselring Yards -- a shipyard deck: cradles, hulls, gantries, hatches
//   3. The Bulwark      -- megastructure armour: riveted panels, deep service
//                          trenches, violet coolant seams, docking clamps,
//                          antenna masts, turret pods
//   4. The Hive Plate   -- organic hive matter: chitin ridges, resin pools,
//                          egg clusters, tendrils
//
// The Bulwark was picked over Glacis Shelf and The Hive Plate for CONTRAST
// when only three were being built: the two built surfaces were black volcanic
// rock and grey shipyard deck, and cold violet-lit armour plating was the
// strongest third reading against both. The Hive Plate was named there as "the
// biggest departure in idiom" -- which is exactly what makes it the right
// FOURTH: three surfaces of hard inorganic industry, then ground that is alive.
//
// PROP SETS ARE PER SURFACE, and that is new. Before this slice there was one
// global set, so volcanic rock and half-buried crashed hulls were scattered
// across a shipyard deck -- and would have been scattered across megastructure
// armour too. A prop set is now a row here exactly as a surface is, which is
// what keeps the two in step: nothing outside /render ever has to know a
// texture key, and adding a fourth surface means adding its props beside it.
//
// SCOPE NOTE: this is still not the full sector campaign (MVP item 9). There
// is no sector length, no star objectives and no sector select here -- only
// the identity of a surface, the props that belong on it, and the boss that
// ends it.

export const SURFACES = [
  {
    id: 'ashfall',
    name: 'ASHFALL CRUST',
    baseKey: 'surfaceAshfallBase',
    glowKey: 'surfaceAshfallGlow',
    // Hue of the covering beat's rule lines, so the beat previews where you
    // are going. Not a playfield colour -- §5.4's bullet-ownership rule
    // (player cyan-white, enemy orange/magenta) governs the playfield and
    // nothing here is drawn into it.
    accent: '#ff8a3c',
    // Cargo containers, scattered rock, half-buried crashed hulls, pipework.
    props: ['propAshfallContainer', 'propAshfallRock', 'propAshfallWreck', 'propAshfallPipe'],
    boss: 'cinderjaw',
  },
  {
    id: 'skyfield',
    name: 'THE SKYFIELD',
    baseKey: 'surfaceSkyfieldBase',
    glowKey: 'surfaceSkyfieldGlow',
    // Warm sand, matching the atoll beaches. The two bright surfaces take
    // their accent from the WARM element rather than the dominant blue, so the
    // covering beat's rule lines still separate from the surface behind them.
    accent: '#f2d9a8',
    // NO PROPS, and that is the design rather than an omission. Every other
    // surface is ground you fly over; this is open air, and the only things
    // below are the sea itself. Scattering crates or wreckage across open
    // ocean would say "this is a floor" -- which is exactly the grim,
    // industrial reading these two levels exist to break up.
    props: [],
    // Craft get a dark outline here instead of an additive glow -- see
    // ENEMY.rim.darkScale in tuning.js. Without it every craft in the game
    // sits ~0.06 from this surface's rendered luminance and disappears.
    darkRim: true,
    // REUSED. Amit asked for the open levels quickly and said explicitly that
    // reusing or omitting bosses was fine ("if we can keep them without bosses
    // or reuse bosses I don't care"). Cinderjaw is the plain HP-pool boss --
    // the simplest fight in the roster, which suits the second level.
    boss: 'cinderjaw',
  },
  {
    id: 'kesselring',
    name: 'KESSELRING YARDS',
    baseKey: 'surfaceKesselringBase',
    glowKey: 'surfaceKesselringGlow',
    accent: '#7fe3f0',
    // A working deck: loaded pallets, flush service hatches, a mobile welding
    // rig, torn hull-cradle ribs. §5.4 #2 names cradles and service hatches
    // directly; the pallet and the rig are what makes it read as *working*
    // rather than as an empty floor.
    props: ['propKesselringPallet', 'propKesselringHatch', 'propKesselringRig', 'propKesselringCradle'],
    boss: 'broodGantry',
  },
  {
    id: 'glacis',
    name: 'GLACIS SHELF',
    baseKey: 'surfaceGlacisBase',
    glowKey: 'surfaceGlacisGlow',
    // Warm cream against the ice, for the same reason The Skyfield takes sand
    // over sea: the accent has to separate from a predominantly pale-cyan
    // surface, and more cyan would vanish into it.
    accent: '#ffe9c4',
    // No props, as with The Skyfield -- see the note there. An open ice shelf
    // reads as open precisely because nothing is standing on it.
    props: [],
    darkRim: true,
    // REUSED, as permitted. Nadir Coil is the retracting-ends fight; putting
    // it here rather than only on The Bulwark means the campaign's two hardest
    // mechanics are not both back-to-back at the end.
    boss: 'nadirCoil',
  },
  {
    id: 'bulwark',
    name: 'THE BULWARK',
    baseKey: 'surfaceBulwarkBase',
    glowKey: 'surfaceBulwarkGlow',
    // Violet, matching the coolant seams in the plating itself.
    accent: '#b98cff',
    // Fixtures bolted onto armour: docking clamps and antenna masts are named
    // in §5.4 #3; the vent grille and coolant manifold carry the violet
    // seam-light down onto the prop layer so the two do not read as unrelated.
    props: ['propBulwarkClamp', 'propBulwarkMast', 'propBulwarkGrille', 'propBulwarkManifold'],
    boss: 'nadirCoil',
  },
];

export function surfaceAt(i) {
  return SURFACES[((i % SURFACES.length) + SURFACES.length) % SURFACES.length];
}
