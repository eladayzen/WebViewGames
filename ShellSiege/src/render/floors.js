// WHICH FLOOR IS UNDER HIM -- and why there is now more than one.
//
// THE FIRST PLAZA PAINTED A STAIRCASE ONTO A FLAT PLANE. Its centrepiece was
// a stepped dais: concentric rings of stone with the shading of real steps and
// a cast shadow under the lip. It looked good as a picture and it lied about
// the one thing this game has committed to -- the whole reason the 3D stairs
// were cut from the design is that gameplay happens on ONE PLANE. A player who
// can see steps will expect to climb them, and a shadow under a lip tells them
// something is above something else when nothing here is above anything.
//
// Elad, on seeing it in motion: "we should not do anything with height depth -
// like the steirs with the shadow - just put something else instead of this
// whole area - keep this asset for later."
//
// So the dais art is KEPT, at ?floor=stone, because it is good art and a later
// scene may well have real height in it. What ships by default is a floor with
// nothing in it that claims a height the simulation does not have: the centre
// is an inlaid mosaic medallion, flush with the paving, and every crack, drain,
// puddle and patch of moss is worn INTO the stone rather than standing on it.
//
// LESS GREY, AND MUCH LESS DARK. The old plaza measured mean value 0.480 --
// it was not "atmospheric", it was simply dim, and a dim floor made the whole
// room dim because the floor is most of the screen. Both new floors measure
// about 0.83, which is 1.7x the light off the same lamps.
//
//   ?floor=warm   warm sandstone flagstones, irregular, inlaid compass medallion
//   ?floor=stone  the original grey dais -- kept, not deleted
//
// THE STONES HAVE TO BE THE RIGHT SIZE ON THE GROUND, which is a thing only
// the game can tell you. The first warm floor drew about eight flagstones
// across the painting; the painting covers the whole 36-unit arena, so each
// stone landed 4.5 units -- a four-and-a-half metre paving slab next to a
// 1.55-unit turtle -- and its medallion filled most of the screen. It looked
// like a close-up of a floor rather than a floor. The shipped art draws about
// eighteen across, which puts a stone at 2 units, and it was regenerated at
// that density rather than fixed in code, because tiling or scaling the UVs
// would have multiplied the medallion too.
//
// EACH FLOOR CARRIES ITS OWN RUNE RADIUS, because the live glow ring in
// stage.js has to sit exactly on the painted one and the paintings do not
// agree about where that is. These are MEASURED, not guessed: the scan bins
// the green-minus-red signal by radius from the image centre and takes the
// peak band (tools/ring scan, in the commit). The arena is 36 units across,
// so the fraction-of-half-width the scan reports is multiplied by 18.
const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

// WEBP, NOT JPEG. GoBalance's MimeFor() already serves .webp and every target
// WebView decodes it; at quality 86 these are visually identical to the JPEGs
// under a camera that never gets within 8 units of the floor, and the three
// floors went from 2.9 MB to 0.9 MB. See tools/to-webp.py.
//
// THE SECOND WARM FLOOR IS GONE. It was the loser of an audition -- a finer
// mosaic, same brief -- and keeping a 1 MB texture in the build to preserve a
// switch nobody is going to flick is the kind of weight that never gets
// removed later. The grey dais stays because Elad asked for it to.
export const FLOORS = {
  warm:  { key: 'warm',  tex: 'tex/floor_warm.webp',  runeR: 4.14, label: 'warm sandstone flagstones' },
  stone: { key: 'stone', tex: 'tex/floor_plaza.webp', runeR: 3.94, label: 'grey dais (kept for later)' },
};

/** The floor this run is using. Unknown names fall back rather than crash. */
export function pickFloor(name) {
  return FLOORS[name] || FLOORS.warm;
}

export const FLOOR = pickFloor(QS.get('floor'));
