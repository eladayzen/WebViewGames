// The sector surfaces (§5.4). Plain data -- no renderer types here.
//
// §5.4 lists five surfaces at MVP. The POC-8 decision note cuts the campaign
// to THREE LEVELS ("§5.4's five surfaces become three [...] one more to
// generate"), so this is the complete set, not a way-point:
//
//   1. Ashfall Crust    -- cracked black rock, glowing magma fissures
//   2. Kesselring Yards -- a shipyard deck: cradles, hulls, gantries, hatches
//   3. The Bulwark      -- megastructure armour: riveted panels, deep service
//                          trenches, violet coolant seams, docking clamps,
//                          antenna masts, turret pods
//
// The Bulwark was picked over Glacis Shelf and The Hive Plate for CONTRAST:
// the two built surfaces are black volcanic rock and grey shipyard deck, and
// cold violet-lit armour plating is the strongest third reading against both.
// (Glacis Shelf is also a strong contrast; the Hive Plate is the biggest
// departure in idiom but would have been the odd one out of three.)
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
