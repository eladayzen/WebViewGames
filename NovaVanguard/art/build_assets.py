#!/usr/bin/env python3
"""Nova Vanguard -- turn the Kolbo raws into the ASSET_MANIFEST files.

Everything here is TABLE-DRIVEN on purpose. A new surface, a new prop set, a
new enemy or a new boss should be a row, not a new code path -- that is the
property that let this slice add The Bulwark, two prop sets, the Emitter and
Cinderjaw without touching the surface or cutout logic at all.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from nvlib import (cutout_white, alpha_bbox, make_v_seamless, luma_bbox,
                   keep_largest_component, extract_emissive, recommend_feather,
                   seam_mismatch, alpha_from_darkness, desaturate_hot,
                   lift_luma, rim_from_alpha, median_luma)

ART = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ART, 'raw') + '/'
OUT = os.path.join(ART, '..', 'public', 'assets') + '/'
os.makedirs(OUT, exist_ok=True)


def save(im, name, **kw):
    p = OUT + name
    im.save(p, optimize=True, **kw)
    print(f'  {name:34s} {im.size[0]:5d}x{im.size[1]:<5d} {os.path.getsize(p)/1024:8.1f} KB')


def cut(im, target, largest=True, fill_thresh=225):
    """White-key -> optional despeckle -> tight crop -> fit long edge."""
    q = cutout_white(im, fill_thresh=fill_thresh,
                     solid_thresh=min(255, fill_thresh + 20))
    if largest:
        q = keep_largest_component(q)
    q = q.crop(alpha_bbox(q))
    k = target / max(q.size)
    return q.resize((max(1, round(q.width * k)), max(1, round(q.height * k))), Image.LANCZOS)


# ===========================================================================
# 1. SURFACES  (9.5 rule 5: tile seamlessly VERTICALLY, generate large, make
#    the seam safe deliberately)
#
# Three of 5.4's five designs are built; the POC-8 decision note cuts the
# campaign to three levels, so THREE IS THE FULL SET, not a way-point:
#   #1 Ashfall Crust      -- cracked black rock, magma fissures
#   #2 Kesselring Yards   -- shipyard deck, cradles, painted markings
#   #3 The Bulwark        -- megastructure armour, trenches, violet coolant
#
# All three go through the identical path -- 9:16 2K generation -> wrap-around
# cross-fade -> resample to a power-of-two 1024x2048 -> extract emissive from
# the finished tile -- so a fourth would be one more row here.
#
# FEATHER. `feather=None` means MEASURE IT (nvlib.recommend_feather reads the
# per-row vertical-detail profile and finds the plain bands the prompt asked
# for). Ashfall and Kesselring keep the hand-measured numbers they shipped
# with, because their assets are verified and re-cutting a validated tile to
# chase a 5% difference buys nothing -- but the recommendation is printed next
# to the authored value on every run, so if the two ever diverge meaningfully
# that shows up instead of rotting silently.
#
# FORMAT: base tiles ship as JPEG q90 (opaque, no alpha to preserve, ~0.5 MB
# against ~3.5 MB as PNG); glow layers stay PNG (mostly pure black, which PNG
# compresses to nothing, and JPEG ringing in a black field becomes visible haze
# under additive blending).
# ===========================================================================

SURFACES = [
    # (raw file,                      stem,         feather, emissive key, bloom)
    ('surface-raw-02.jpg',            'ashfall',    340,  'warm',      0.0),
    ('surface-kesselring-raw-01.jpg', 'kesselring', 108,  'chromatic', 0.85),
    # The Bulwark. 'chromatic' rather than 'warm' for the same reason
    # Kesselring is: the plating is near-neutral gunmetal with specular
    # highlights everywhere, so brightness alone would key the whole frame.
    # What separates a coolant seam from a highlight here is CHROMA -- the
    # violet seams are the only saturated pixels in the image. Bloom is lower
    # than Kesselring's because the seams are long continuous lines rather than
    # tiny point lamps, so they already have presence without spreading.
    ('surface-bulwark-raw-01.jpg',    'bulwark',    None, 'chromatic', 0.55),
    # THE TWO BRIGHT SURFACES (playtest round 7). Amit: "all of the backgrounds
    # up until now were too dark... this feels like a game for 15 year olds, not
    # something that would fit 8 year olds." These two are the open, light
    # levels that break up the dark ones, and they invert an assumption this
    # pipeline used to make.
    #
    # 'chromatic' rather than 'warm' for BOTH, and for the opposite reason
    # Kesselring needs it. On a dark surface, brightness alone finds the
    # emissive accents because they are the only bright thing. On a near-white
    # surface, brightness finds EVERYTHING -- the entire frame is bright. What
    # still separates a lit channel from sunlit ice or cloud is chroma: the
    # turquoise meltwater and the deep-water channels are the only saturated
    # pixels in an otherwise desaturated frame.
    #
    # Bloom is low. These surfaces are already luminous, and spreading their
    # highlights further would eat the headroom the craft need to read against
    # them (constraints R6).
    ('surface-skyfield-raw-02.jpg',   'skyfield',   None, 'none',      0.0),
    ('surface-glacis-raw-01.jpg',     'glacis',     200,  'none',      0.0),
]

for raw, stem, feather, kind, bloom in SURFACES:
    print(f'surface: {stem}')
    src = Image.open(RAW + raw).convert('RGB')
    rec, why = recommend_feather(src)
    if feather is None:
        feather = rec
        print(f'  feather {feather} MEASURED -- {why}')
    else:
        print(f'  feather {feather} authored (measurement suggests {rec}: {why})')
        print(f'  authored feather mismatch {seam_mismatch(src, feather):.2f}/255')

    tile = make_v_seamless(src, feather=feather)
    tile = tile.resize((1024, 2048), Image.LANCZOS)  # power-of-two REPEAT wrap
    # DAYLIT SURFACES GET PULLED BACK TO THE §5.4 SATURATION BAND. A real
    # satellite ocean is far more saturated than the dark surfaces ever were
    # (measured 0.52 against a 0.35 cap) -- and unlike luminance, saturation is
    # capped for a reason that survives the surface being bright: the player's
    # bullets are cyan-white and the enemies' are orange/magenta, and a deeply
    # saturated blue ground competes with both. The emissive keys handled this
    # implicitly on the dark surfaces by keeping saturated pixels rare; the
    # 'none' surfaces have no emissive pass, so it is done explicitly here.
    if kind == 'none':
        # desaturate_hot returns RGBA; the base tile ships as opaque JPEG.
        tile = desaturate_hot(tile, max_sat=0.34).convert('RGB')
        # NOTE: measure_readability will still report skyfield's HSV saturation
        # mean as OVER (~0.44 against 0.35). That is the artifact nvlib already
        # documents -- HSV S is unstable near black, and the scrim floor
        # (0x05060c) is itself a saturated dark blue, so over a mid-dark surface
        # the metric mostly measures the scrim. The stable number is CHROMA:
        # skyfield reads 0.087 against Glacis Shelf's 0.088, and Glacis passes.
        # Pushing max_sat to 0.26 moved the reported mean only 0.438 -> 0.400
        # while visibly draining the ocean, which is a worse picture for no real
        # readability gain.
    save(tile, f'surface-{stem}-base.jpg', quality=90, subsampling=0)

    # The emissive layer is EXTRACTED from the finished base tile rather than
    # generated separately, so the accents register exactly with the fissures /
    # lamps / seams that produced them -- a second generation could never line
    # up, and the renderer locks glow.tilePosition.y to base.tilePosition.y.
    glow, hot = extract_emissive(tile, kind, bloom=bloom)
    save(glow, f'surface-{stem}-glow.png')
    print(f'  emissive coverage {100.0*hot:.3f}% of frame area (5.4 cap: 12%)')

# ===========================================================================
# 2. PLAYER SHIP -- 3 roll states, one batched generation, ONE SHARED CELL
#    RECT (9.5 rule 2), so the centre cannot shift between roll states.
# ===========================================================================
print('ship')
sh = cutout_white(Image.open(RAW + 'ships-raw-01.png'))
W, H = sh.size
TRAIL_CUT = 490          # below this only the two engine beams remain
TOP_NOISE = 46           # generator speckle along the top edge; noses start ~62
ap = sh.load()
for y in list(range(0, TOP_NOISE)) + list(range(TRAIL_CUT, H)):
    for x in range(W):
        r, g, b, a = ap[x, y]
        if a:
            ap[x, y] = (r, g, b, 0)

cells = [(round(i * W / 3), round((i + 1) * W / 3)) for i in range(3)]
boxes = [alpha_bbox(sh.crop((x0, 0, x1, H))) for x0, x1 in cells]
lx = min(b[0] for b in boxes)
ty = min(b[1] for b in boxes)
rx = max(b[2] for b in boxes)
by = max(b[3] for b in boxes)
PAD = 8
lx, ty = max(0, lx - PAD), max(0, ty - PAD)
cw = cells[0][1] - cells[0][0]
rx, by = min(cw, rx + PAD), min(H, by + PAD)
print(f'  shared cell rect {lx},{ty} {rx-lx}x{by-ty} (per-third bboxes {boxes})')

TARGET_W = 256
for name, (x0, _x1) in zip(['ship-roll-l', 'ship-level', 'ship-roll-r'], cells):
    cell = sh.crop((x0 + lx, ty, x0 + rx, by))
    k = TARGET_W / cell.width
    save(cell.resize((TARGET_W, round(cell.height * k)), Image.LANCZOS), name + '.png')

# ===========================================================================
# 3. AIR ENEMIES -- authored nose-up; the renderer rotates to heading.
#
# 6.2's bestiary is composed from three orthogonal pieces (entry path, slot
# behaviour, fire pattern), so a type is one sprite plus a data row. Two of the
# six are built.
#
# The EMITTER's silhouette is doing gameplay work, not decoration. It never
# swoops -- it holds its slot and sweeps -- so it is drawn planted: wide,
# squat, no attack wings, two outrigger emitter drums, a firing bar across the
# front. A player should be able to tell at a glance that this one is not
# coming for them and has to be gone after. Its ACID JADE GREEN is the other
# half of that read: 5.4 colour-codes ownership, so green separates it from
# both the player's blue-and-white and the drone's purple, and green is used by
# nothing else on the playfield (player fire is cyan-white, enemy fire is
# orange/magenta, the three surface accents are orange, cyan and violet).
# ===========================================================================
#
# LEVEL TWO adds two more (6.2's Warden and Splitter), chosen against a
# specific complaint rather than off the list in order: "the simple enemies are
# just blown up with one super rocket fire of mine. And if I move or stand in
# the right place I can kill the whole wave before it even gets to their
# positions." Both new types attack that directly --
#   * the WARDEN carries a shimmer shield that eats three bolts before its body
#     takes any, so a single craft cannot be melted on approach at all;
#   * the SPLITTER answers a pre-emptive kill by BECOMING TWO MORE CRAFT, so
#     clearing early does not empty the wave.
# (Lancer and Spoke were the alternatives and neither does: a Lancer is a
# tougher drone, and a Spoke is a second thing that sits still like the
# Emitter already does.)
#
# COLOUR IS BEHAVIOUR HERE, same as the Emitter's acid jade. Four hulls now
# share the top band, so the palette has to keep them apart at a glance:
# player blue-and-white, drone purple, Emitter green, WARDEN oxblood crimson
# (the only red thing on the playfield), SPLITTER bone-ivory (the only pale
# one). Neither reuses an existing hue and neither collides with the
# orange/magenta 5.4 reserves for enemy FIRE.
#
# `largest` is off for the splitter and that is not a detail: the craft is
# authored as two mirrored halves separated by its own split seam, so it keys
# out as TWO connected components. keep_largest_component would silently ship
# half a ship -- verified, it crops to (269,5,1014,2037), the left half alone.
#
# LEVEL THREE ADDS THE LANCER, AND IT IS AN ART FIX BEFORE IT IS A CONTENT ONE.
# Amit, playtest round 5:
#
#   "The only one which feels he needs a different asset, it's like it's an
#    enemy with two lives. He can get hit twice. But it looks really really
#    close or maybe the same sprite even to the ones in level one which have
#    only one life, one shot and dead."
#
# He was looking at level two's `hp: { drone: 2 }` override -- a 2 HP craft
# WEARING THE 1 HP DRONE'S SPRITE. So the fix is not a tint or a scale, it is
# that HP IS A PROPERTY OF A TYPE AND EVERY TYPE HAS ITS OWN CHASSIS. 6.2
# already names the 2 HP tier (Lancer), so this is the authored roster catching
# up with the rule rather than a new invention.
#
# THE TIER LANGUAGE IS ARMOUR PLATING, and that is the part worth reusing. The
# drone is a thin bright-purple dart with exposed spines; the Lancer is the same
# violet faction seen UP-ARMOURED -- thick overlapping gunmetal plates bolted
# over a violet core, a blunt reinforced prow, heavy shoulder pauldrons. Same
# family, visibly more of it. A player reads "that one is plated, it will take
# more" before firing, which is the whole requirement.
#
# It keeps the drone's violet rather than taking a fifth hue, deliberately: a
# new colour would say "different job", and the Lancer's job is the drone's job
# done tougher. The colour that carries the difference is the ARMOUR's gunmetal,
# which nothing else on the playfield wears.
#
# ===========================================================================
# EVERY CRAFT IS LIFTED AND RIMMED. Amit, playtest round 5:
#
#   "A lot of the enemies right now are too dark. It's hard to see them on the
#    dark backgrounds. Mainly actually mainly the one that's like grey dark.
#    Also the green ones are a little bit too dark. The orange one a little bit
#    too dark. [...] I don't know if you have to change the whole asset maybe
#    or just add some auto-stroke or glow."
#
# MEASURED BEFORE IT WAS FIXED, so the three craft he named are named back
# rather than guessed at. Median luminance of each sprite as shipped, against
# the surfaces' rendered means of 0.071 (Ashfall) / 0.083 (Kesselring) /
# 0.074 (Bulwark):
#
#     splitter  0.796     bone ivory, the pale one          -- fine
#     ship      0.458     the player, the reference          -- fine
#     emitter   0.358     "the green ones"                   -- thin
#     drone     0.265                                        -- thin
#     lancer    0.186     "the one that's like grey dark"    -- WORST BY READ
#     warden    0.155     "the orange one"                   -- WORST BY NUMBER
#
# THE PROBLEM IS STRUCTURAL AND WILL RECUR. 5.4 requires a desaturated,
# low-contrast surface and the shipped ones sit at a sixth of that ceiling, so
# the ground is very dark BY DESIGN -- and it has to stay dark, because that
# darkness is what makes bullets readable. Any craft that is also dark
# disappears, and so will the next one. So the fix is a rule applied to every
# craft rather than a retouch of three:
#
#   1. LIFT the sprite's median luminance to CRAFT_TARGET_MEDIAN with a
#      hue-preserving power curve (nvlib.lift_luma). 5.4's ownership coding is
#      untouched by construction -- no channel ratio moves.
#   2. RIM it with an outline derived from its own alpha (nvlib.rim_from_alpha),
#      drawn additively behind the craft at runtime and tinted with that type's
#      family colour. This is the half a lift cannot do: it separates the
#      silhouette from the ground rather than making the hull brighter, and it
#      is what answers "or just add some auto-stroke or glow" literally.
#
# NEITHER COSTS A GENERATION. This is the same discipline 9.5 rule 6 set for
# surfaces -- bring it into band in the pipeline, not by regenerating -- applied
# in the opposite direction, and art/measure_readability.py now emits the
# measured numbers into src/data/readability.js so the boot validator can
# assert the contrast rather than trust this comment.
print('enemies')

# The median luminance every craft is lifted TO. Chosen against the measurement
# above rather than by eye: it clears the darkest surface's rendered mean
# (0.083) by 0.28, puts the worst two craft in the same readability class as the
# Emitter that Amit called only "a little bit" dark, and still sits below the
# player's own 0.458 -- the interceptor should remain the brightest thing on the
# playfield that is not an explosion. Craft already above it are left alone.
CRAFT_TARGET_MEDIAN = 0.36

ENEMIES = [
    # (raw file,             out name,             target long edge, largest)
    ('drone-raw-01.png',     'enemy-drone.png',    224, True),
    ('emitter-raw-01.png',   'enemy-emitter.png',  232, True),
    ('warden-raw-01.png',    'enemy-warden.png',   248, True),
    ('splitter-raw-01.png',  'enemy-splitter.png', 236, False),
    ('lancer-raw-01.png',    'enemy-lancer.png',   236, True),
]
for raw, name, target, largest in ENEMIES:
    im = cut(Image.open(RAW + raw), target, largest=largest)
    lifted, med, gamma = lift_luma(im, CRAFT_TARGET_MEDIAN)
    save(lifted, name)
    print(f'    median luma {median_luma(im):.3f} -> {med:.3f} (v^{gamma:.3f})')
    # The rim is cut from the LIFTED sprite, so its alpha is the same silhouette
    # the player sees. One per craft, generated from the craft: adding an enemy
    # adds its rim with no extra row anywhere.
    save(rim_from_alpha(lifted), name.replace('.png', '-rim.png'))

# ===========================================================================
# 3b. PICKUP (5.6, plus Amit's explicit ask: "when the enemy dies he gives
#     birth to like a pick up item. If I pick it up I have some abilities").
#
# ONE sprite, spun and pulsed at runtime -- 5.6 says exactly that ("all
# spun/pulsed at runtime from a single static sprite each"), so there is no
# frame set here and there must never be one.
#
# It is deliberately CYAN-WHITE, which is the player's own ownership colour
# (5.4). A collectable is the one object on the playfield that must never be
# mistaken for something to dodge, and the frame's entire orange/magenta
# vocabulary already means "this will hurt you". Reading as "yours" is the
# whole job.
#
# FOUR CANISTERS NOW, ONE PER TEMPORARY WEAPON (Amit: "we have one pickup for
# one special weapon. We need more."). They are the SAME canister -- same
# casing, same bolts, same lighting, generated as one four-panel edit off the
# shipped sprite so the lineage is literal -- differing only in the cyan emblem
# on the face: chevron stack, lance bar, three dots, wide arc.
#
# WHY THE EMBLEM AND NOT A TINT. 5.4 colour-codes OWNERSHIP and a collectable
# has to read as YOURS at a glance; tinting one canister amber to mean "flak"
# would put an enemy-coloured object on the playfield and the player would dodge
# it. The casing stays cyan-white in all four and the emblem carries the
# identity, which is also what lets a player learn "arc = the short-range one"
# without a legend.
#
# ONE SHARED CELL RECT (9.5 rule 2), as with the ship rolls and the boss bays:
# the four are drawn at one size and one centre, so the spin/pulse the renderer
# applies is the same motion on all four rather than four slightly different
# wobbles.
print('pickup')
pk = cutout_white(Image.open(RAW + 'pickups4-raw-01.png').convert('RGB'))
KW, KH = pk.size
kcells = [(round(i * KW / 4), round((i + 1) * KW / 4)) for i in range(4)]
kboxes = [alpha_bbox(keep_largest_component(pk.crop((x0, 0, x1, KH))))
          for x0, x1 in kcells]
klx = min(b[0] for b in kboxes)
kty = min(b[1] for b in kboxes)
krx = max(b[2] for b in kboxes)
kby = max(b[3] for b in kboxes)
PAD = 6
klx, kty = max(0, klx - PAD), max(0, kty - PAD)
kcw = kcells[0][1] - kcells[0][0]
krx, kby = min(kcw, krx + PAD), min(KH, kby + PAD)
print(f'  pickup shared cell rect {klx},{kty} {krx-klx}x{kby-kty} (per-quarter {kboxes})')
PICKUP_W = 256
for name, (x0, _x1) in zip(
    ['pickup-scatter', 'pickup-lance', 'pickup-swarm', 'pickup-flak'], kcells
):
    cell = keep_largest_component(pk.crop((x0 + klx, kty, x0 + krx, kby)))
    k = PICKUP_W / cell.width
    save(cell.resize((PICKUP_W, round(cell.height * k)), Image.LANCZOS), name + '.png')

# ===========================================================================
# 4. PROJECTILES -- drawn with blendMode 'add', so they stay on a BLACK field
#    (black adds nothing) instead of being keyed to alpha. No cutout needed.
# ===========================================================================
print('projectiles')
bo = Image.open(RAW + 'bolt-raw-01.png').convert('RGB')
bo = bo.crop(luma_bbox(bo, 8))
# The renderer scales bolts uniformly off texture WIDTH (r*2.6 / width), so the
# authored aspect IS the on-screen shape: 1:2.8 gives the ~23x65 shard the
# concept frame shows, where the raw's 1:9 filament would be 200px long.
save(bo.resize((64, 179), Image.LANCZOS), 'proj-player-bolt.png')

# The temporary alternate weapon's round (the SCATTER pickup, 5.6 + Amit's
# "another weapon like a fire different kind of projectiles for limited time").
#
# It stays CYAN-WHITE. 5.4's ownership coding is absolute -- "player fire is
# cyan-white, enemy fire is orange/magenta [...] No exceptions" -- so a
# temporary weapon may change SHAPE and never colour. What separates it from the
# standard bolt is that it is short, fat and blunt against the bolt's 1:2.8
# shard: at a glance the stream visibly thickens, which is the read the pickup
# has to deliver in the first half second.
sp = Image.open(RAW + 'spreadbolt-raw-01.png').convert('RGB')
sp = sp.crop(luma_bbox(sp, 26))
save(sp.resize((104, 168), Image.LANCZOS), 'proj-player-spread.png')

# THE THREE ADDITIONAL PICKUP WEAPONS (Amit: "we have one pickup for one
# special weapon. We need more.").
#
# Generated as ONE three-panel sheet on black, for the same reason the ship
# rolls are one generation: a set drawn together stays one family, and three
# separate calls would have come back in three different idioms.
#
# EACH SHAPE IS ITS WEAPON'S BEHAVIOUR, not decoration -- that is the whole
# point of giving them art rather than tinting the spread round three ways:
#   * LANCE  -- a long needle spear. It PIERCES, so it has to look like
#               something that goes through rather than something that lands.
#   * SWARM  -- a small finned micro-missile with an exhaust flare. It HOMES,
#               and a body with fins and a motor is the only shape that makes a
#               curving projectile read as steering rather than as a bug.
#   * FLAK   -- a squat crescent shockwave, far wider than it is tall. It has a
#               short life and a wide fan, so its round is drawn as a wall
#               fragment rather than a bullet.
#
# ALL THREE STAY CYAN-WHITE. 5.4's ownership coding admits no exceptions -- a
# temporary weapon may change shape, count, speed, size and behaviour, and may
# never change side.
#
# Sliced at equal thirds and luma-cropped per panel rather than through a shared
# cell rect: these are three DIFFERENT objects (9.5 rule 2 governs states of ONE
# object), and the renderer scales each off its own texture width, so the
# authored aspect is the on-screen shape.
PROJ = [
    # (panel, out name, target width, target height)
    (0, 'proj-player-lance.png', 40, 232),
    (1, 'proj-player-swarm.png', 62, 124),
    (2, 'proj-player-flak.png', 168, 92),
]
pset = Image.open(RAW + 'proj-set-raw-01.png').convert('RGB')
PPANEL = pset.width / 3.0
for idx, name, tw, th in PROJ:
    cell = pset.crop((int(round(idx * PPANEL)), 0,
                      int(round((idx + 1) * PPANEL)), pset.height))
    cell = cell.crop(luma_bbox(cell, 16))
    save(cell.resize((tw, th), Image.LANCZOS), name)

ob = Image.open(RAW + 'orb-raw-01.png').convert('RGB')
l, t, r, b = luma_bbox(ob, 8)
cx, cy = (l + r) / 2, (t + b) / 2
half = max(r - l, b - t) / 2
sq = ob.crop((round(cx - half), round(cy - half), round(cx + half), round(cy + half)))
save(sq.resize((256, 256), Image.LANCZOS), 'proj-enemy-orb.png')

# ===========================================================================
# 5. PROPS -- ONE SET PER SURFACE (6.5: eight per sector surface; four each is
#    what this slice ships, scattered with runtime rotation and scale).
#
# Before this slice there was ONE global set, which meant volcanic rock and
# half-buried crashed hulls were scattered across a shipyard deck and would
# have been scattered across megastructure armour too. Prop sets are now keyed
# by surface in exactly the way the surfaces themselves are, so the two stay in
# step: /data/surfaces.js names a set, /render resolves it, and adding a
# surface means adding its props in the same row.
#
# Each prop is an independent object, randomly rotated and scaled at runtime,
# so each gets its own TIGHT bbox -- 9.5 rule 2's shared cell rect governs
# states OF ONE object (the ship's rolls, the boss pod's two states) and does
# not apply here. The renderer applies p.scale directly with no width
# normalisation, so the authored pixel size IS the in-frame size at scale 1.0.
#
# SATURATION IS CAPPED AT BUILD TIME. See nvlib.desaturate_hot -- gpt-image
# added unrequested blue neon to the Kesselring pallet and service rig, and
# blue is the player's colour. 5.4 caps the prop layer at 35% saturation and
# exempts only authored accents, so the cap is applied to every prop uniformly
# rather than argued about per sheet. It also brings the Bulwark's violet
# fixtures into band; they stay bright, they just stop being saturated.
# ===========================================================================
print('props')

# (out name, raw file, crop box or None for whole image, target long edge)
Q = lambda W, H, cx, cy: (cx * W // 2, cy * H // 2, (cx + 1) * W // 2, (cy + 1) * H // 2)
HALF2 = lambda W, H, i: (i * W // 2, 0, (i + 1) * W // 2, H)

# (out name, raw, crop code, target long edge, white-key override or None)
PROPS = [
    # --- Ashfall Crust: cracked black rock, cargo containers, crashed hulls --
    ('prop-ashfall-container', 'props-raw-01.png',           'q00', 250, None),
    ('prop-ashfall-rock',      'props-raw-01.png',           'q10', 160, None),
    ('prop-ashfall-wreck',     'props-raw-01.png',           'q01', 290, None),
    # prop-pipe was REGENERATED rather than sliced from the 2x2 sheet: the
    # sheet drew it as an upright cylinder seen slightly from the side, which
    # breaks 0.2 rule 2 ("you always see the top surface of every object").
    # The lesson generalises and was paid for twice now -- nano-banana-pro/edit
    # under-commits on a reorientation and returns another three-quarter view,
    # gpt-image/1.5-image-to-image lands it first try from the same reference.
    # Reorienting an object IS a pose change; reach for the pose model.
    ('prop-ashfall-pipe',      'pipe-raw-02.png',            None,  210, None),

    # --- Kesselring Yards: a working shipyard deck -------------------------
    # Hatch and cradle came back strictly top-down first time. The pallet and
    # the service rig came back ISOMETRIC -- side faces visible, 0.2 rule 2 --
    # and were reshot through gpt-image/1.5-image-to-image (raw -02), which is
    # the third time that model has been the answer to a reorientation.
    ('prop-kesselring-hatch',  'props-kesselring-raw-01.png', 'q10', 230, None),
    ('prop-kesselring-cradle', 'props-kesselring-raw-01.png', 'q11', 280, None),
    ('prop-kesselring-pallet', 'props-kesselring-raw-02.png', 'h0',  240, None),
    ('prop-kesselring-rig',    'props-kesselring-raw-02.png', 'h1',  265, None),

    # --- The Bulwark: fixtures bolted onto megastructure armour -------------
    # The whole Bulwark sheet is keyed at 168 rather than PROP_KEY. These four
    # are LIGHT steel objects lit against white and two of them (the manifold,
    # the mast) sit inside a broad soft bloom that reaches nearly to mid-grey,
    # so the standard key leaves a pale ring. Swept at 205/185/168/152: the
    # halo clears at 168 and 152 begins eating the mast's dish. Safe to go this
    # low only because the fill is border-connected -- the objects' own bright
    # highlights are interior and unreachable from the frame edge.
    ('prop-bulwark-clamp',     'props-bulwark-raw-01.png',   'q00', 265, 168),
    ('prop-bulwark-mast',      'props-bulwark-raw-01.png',   'q10', 300, 168),
    ('prop-bulwark-grille',    'props-bulwark-raw-01.png',   'q01', 245, 168),
    ('prop-bulwark-manifold',  'props-bulwark-raw-01.png',   'q11', 250, 168),
]

# Props are keyed at a LOWER white threshold than craft (225). Several prop
# generations came back with a soft grey glow or vignette haloing the object --
# around 200-215, well under the standard 225 key, so it survived as an opaque
# pale blob that read in game as fog on the ground next to the prop. 205 kills
# it cleanly and takes nothing off the subject, because the flood fill is
# border-connected: an interior specular highlight at 240 is still protected,
# only background is reachable. Verified by threshold sweep on the worst case
# (the Bulwark docking clamp) at 225 / 208 / 196 / 186 -- the halo is gone by
# 208 and the silhouette stops changing after that.
PROP_KEY = 205

# 5.4 caps the prop layer at 35% saturation. Props are taken to 20% instead,
# well inside it. The cap is not the target: props are INERT SCENERY whose only
# job is to not be mistaken for anything the player can shoot, collect or be
# hit by, and 5.4's ownership coding assigns blue-and-white to the player and
# orange/magenta to enemy fire. A prop sitting at the legal maximum still reads
# as coloured, and the generator handed back blue-seamed cargo pallets, which
# is the exact confusion to avoid. Luminance is untouched either way.
PROP_SAT = 0.20

_cache = {}
for name, raw, box, target, key in PROPS:
    if raw not in _cache:
        _cache[raw] = Image.open(RAW + raw)
    src = _cache[raw]
    W, H = src.size
    if box is None:
        q = src
    elif box.startswith('h'):
        q = src.crop(HALF2(W, H, int(box[1])))
    else:
        q = src.crop(Q(W, H, int(box[1]), int(box[2])))
    # Desaturate BEFORE keying, not after, and the order is load-bearing. The
    # Bulwark fixtures are haloed by a broad violet bloom whose min-channel sits
    # just under the key, so it survives a cutout run first; pulling it to grey
    # first raises that channel above PROP_KEY and the same cutout then removes
    # it. Cutting first leaves a pale ring that no later step can find.
    save(cut(desaturate_hot(q, PROP_SAT).convert('RGB'), target,
             fill_thresh=key or PROP_KEY), name + '.png')

# ===========================================================================
# 6. BOSS -- Cinderjaw (6.4, sector 1's teaching boss).
#
# 6.4 budgets each boss at one hull + 4 destructible pods + 4 blown-pod
# variants + a scorch overlay = ~10 sprites. This ships THREE, and the
# reduction is deliberate rather than a corner cut: Cinderjaw's four pods are
# four instances of ONE part -- identical hull batteries bolted into identical
# sockets -- so four intact variants and four blown variants would be eight
# generations of the same object. One intact + one destroyed, instanced four
# times, is the same picture on screen for a quarter of the asset load, and it
# is exactly the economy 0.3 fixed the rendered idiom to buy. A boss whose pods
# are genuinely DIFFERENT parts (Brood Gantry's launch bays, Vespidae's egg
# sacs) would author more rows here; that is a data question, not a code one.
#
# The two pod states go through ONE SHARED CELL RECT (9.5 rule 2). This matters
# more for the pod than for anything else in the game: the pod is pinned to a
# fixed socket on the hull and swaps state in place, so a centre shift between
# intact and destroyed would read as the wreckage jumping sideways at the exact
# moment the player is being rewarded for killing it.
# ===========================================================================
print('boss')
hull = cut(Image.open(RAW + 'boss-cinderjaw-raw-01.png'), 1024)
save(hull, 'boss-cinderjaw-hull.png')
print(f'  hull aspect {hull.width / hull.height:.3f} '
      f'(wide and shallow: it lies lengthwise across the frame, 6.4)')

pods = cutout_white(Image.open(RAW + 'boss-pods-raw-01.png'))
PW, PH = pods.size
pcells = [(0, PW // 2), (PW // 2, PW)]
pboxes = [alpha_bbox(keep_largest_component(pods.crop((x0, 0, x1, PH))))
          for x0, x1 in pcells]
plx = min(b[0] for b in pboxes)
pty = min(b[1] for b in pboxes)
prx = max(b[2] for b in pboxes)
pby = max(b[3] for b in pboxes)
PAD = 6
plx, pty = max(0, plx - PAD), max(0, pty - PAD)
prx, pby = min(PW // 2, prx + PAD), min(PH, pby + PAD)
print(f'  pod shared cell rect {plx},{pty} {prx-plx}x{pby-pty} (per-half {pboxes})')

POD_W = 256
for name, (x0, _x1) in zip(['boss-pod', 'boss-pod-dead'], pcells):
    cell = keep_largest_component(pods.crop((x0 + plx, pty, x0 + prx, pby)))
    k = POD_W / cell.width
    save(cell.resize((POD_W, round(cell.height * k)), Image.LANCZOS), name + '.png')

# ===========================================================================
# 6b. BOSS TWO -- Brood Gantry (6.4, level two's carrier).
#
# 6.4: "Brood Gantry -- carrier disgorging drones from bays across the width",
# "pods are launch bays that emit drones on a timer; killing a bay stops its
# stream". So this is FOUR SPRITES against Cinderjaw's three, and the extra one
# is the whole mechanic: a bay has an OPEN state and a SHUT state as well as a
# destroyed one, because the fight's rule is "the bay that is launching at you
# is the bay you can hurt".
#
# THREE STATES THROUGH ONE SHARED CELL RECT (9.5 rule 2), and here it matters
# more than anywhere else in the game. A bay is pinned to a fixed socket on the
# hull and swaps state IN PLACE several times per fight -- a centre shift
# between open and shut would read as the socket sliding, which is precisely the
# kind of "is this thing even working" ambiguity that made boss one unplayable.
#
# THE HULL IS CROPPED BEFORE KEYING, and that is not cosmetic tidying. The
# generator returned a soft out-of-focus grey band across the top ~340 rows,
# whose min channel sits just under the near-white key -- so it survives the
# cutout AS PART OF THE HULL'S OWN CONNECTED COMPONENT (verified: the keyed
# component runs y 0..1213, i.e. the haze and the ship are one blob, so
# keep_largest_component cannot separate them). Cropping is the only step that
# can, and 345 is measured: the hull's topmost plating starts at ~344.
print('boss two')
BG_CROP_TOP = 392
bg = Image.open(RAW + 'boss-broodgantry-raw-01.jpg').convert('RGB')
bg = bg.crop((0, BG_CROP_TOP, bg.width, 1300))
bg = keep_largest_component(cutout_white(bg))
bg = bg.crop(alpha_bbox(bg))
k = 1200 / bg.width
bg = bg.resize((1200, round(bg.height * k)), Image.LANCZOS)
save(bg, 'boss-broodgantry-hull.png')
print(f'  hull aspect {bg.width / bg.height:.3f} '
      f'(4 empty launch sockets on the centreline + a shuttered core hatch)')

# The bay sheet is three equal panels. Its subject is a disc set in a vertical
# hull strut, and only the DISC is wanted: the strut belongs to the hull art
# underneath and drawing it twice would put a second set of plating over the
# first. So the shared cell rect is followed by a CIRCULAR MASK -- measured at
# radius 300 against a disc whose outer collar reaches ~295 -- which is also
# what makes the three states drop into the hull's socket without a seam.
BAY_CX, BAY_CY, BAY_HALF, BAY_MASK_R = 453, 729, 345, 290
bays = Image.open(RAW + 'boss-bays-raw-01.jpg').convert('RGB')
PANEL = bays.width / 3.0
BAY_W = 256
for i, name in enumerate(['boss-bay-open', 'boss-bay-shut', 'boss-bay-dead']):
    x0 = int(round(i * PANEL))
    cell = bays.crop((x0 + BAY_CX - BAY_HALF, BAY_CY - BAY_HALF,
                      x0 + BAY_CX + BAY_HALF, BAY_CY + BAY_HALF))
    cell = cutout_white(cell).convert('RGBA')
    # Circular alpha mask, 4px feathered, centred on the shared cell rect.
    px = cell.load()
    n = cell.width
    c = (n - 1) / 2.0
    for y in range(n):
        for x in range(n):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            if d <= BAY_MASK_R:
                continue
            r, g, b, a = px[x, y]
            f = max(0.0, 1.0 - (d - BAY_MASK_R) / 4.0)
            px[x, y] = (r, g, b, int(a * f))
    save(cell.resize((BAY_W, BAY_W), Image.LANCZOS), name + '.png')

# ===========================================================================
# 6c. BOSS THREE -- Nadir Coil (6.4, level three's segmented hive-serpent).
#
# 6.4: "Nadir Coil -- segmented: the pods are body segments and the serpent
# visibly shortens as they die." That sentence is the mechanic, and it is why
# the hull art is a CHAIN rather than a silhouette: four identical ring
# vertebra sockets with a bright reactor core dead centre, so the renderer can
# crop the hull's ends away as end segments die and the coil literally gets
# shorter on screen.
#
# THE SOCKET POSITIONS ARE MEASURED OFF THE SHIPPED ART, not chosen -- the same
# discipline Brood Gantry's launch sockets follow. Verified by drawing the four
# candidate dx values back onto the keyed hull and looking at where the circles
# landed (art/tmp/nadir-marked2.png): 0.1245 / 0.3066 / 0.6982 / 0.8239, core at
# 0.4949. The spacing is deliberately NOT even, because the generator did not
# draw it evenly and the data has to agree with the picture rather than the
# other way round. /systems/constraints.js re-derives from these that no two
# shot channels overlap, that none of them overlaps the core's, and that every
# one sits inside the player's own lateral clamp.
print('boss three')
nc = keep_largest_component(
    cutout_white(Image.open(RAW + 'boss-nadircoil-raw-01.png').convert('RGB'))
)
nc = nc.crop(alpha_bbox(nc))
k = 1400 / nc.width
nc = nc.resize((1400, round(nc.height * k)), Image.LANCZOS)
save(nc, 'boss-nadircoil-hull.png')
print(f'  hull aspect {nc.width / nc.height:.3f} '
      f'(4 ring sockets + a central reactor core, 6.4)')

# The three segment states, through ONE SHARED CELL RECT (9.5 rule 2). Same
# reasoning as the launch bay's, and for the same reason it matters most here:
# a segment is pinned to a fixed socket and swaps state in place the moment its
# neighbour dies, so a centre shift would read as the coil jittering at exactly
# the instant the player is being told the target has moved inward.
#
# THE DEAD PANEL NEEDS AN INTERIOR KEY AND THE OTHER TWO DO NOT. cutout_white
# only removes BORDER-CONNECTED background, which is right almost everywhere --
# but the generator drew both the exposed and the destroyed segment as an
# annulus with the paper showing through the middle. On the exposed one that
# reads correctly as a white-hot core and is kept. On the destroyed one it is a
# bright white disc in the centre of a burnt-out wreck, which is nonsense, so
# that panel alone gets a second near-white pass that punches the hole through
# to the hull underneath.
COIL_STATES = [
    # (out name, punch the interior white hole through)
    ('boss-coil-open.png', False),
    ('boss-coil-shut.png', False),
    ('boss-coil-dead.png', True),
]
coil = cutout_white(Image.open(RAW + 'boss-coil-raw-01.png').convert('RGB'))
CW, CH = coil.size
ccells = [(round(i * CW / 3), round((i + 1) * CW / 3)) for i in range(3)]
cboxes = [alpha_bbox(keep_largest_component(coil.crop((x0, 0, x1, CH))))
          for x0, x1 in ccells]
clx = min(b[0] for b in cboxes)
cty = min(b[1] for b in cboxes)
crx = max(b[2] for b in cboxes)
cby = max(b[3] for b in cboxes)
PAD = 6
clx, cty = max(0, clx - PAD), max(0, cty - PAD)
ccw = ccells[0][1] - ccells[0][0]
crx, cby = min(ccw, crx + PAD), min(CH, cby + PAD)
print(f'  segment shared cell rect {clx},{cty} {crx-clx}x{cby-cty} (per-third {cboxes})')

COIL_W = 256
for (name, punch), (x0, _x1) in zip(COIL_STATES, ccells):
    cell = keep_largest_component(coil.crop((x0 + clx, cty, x0 + crx, cby)))
    if punch:
        px = cell.load()
        for y in range(cell.height):
            for x in range(cell.width):
                r, g, b, a = px[x, y]
                if a and min(r, g, b) >= 236:
                    px[x, y] = (r, g, b, 0)
    kk = COIL_W / cell.width
    save(cell.resize((COIL_W, round(cell.height * kk)), Image.LANCZOS), name)

# ===========================================================================
# 7. DAMAGE OVERLAY (6.2: "one shared damaged/scorched overlay per type").
#
# One sheet, shared across BOTH air types and the boss hull rather than one per
# type. A blast scorch is a burn on metal; it carries no type identity, and the
# thing that actually has to read per-type -- how hurt is this craft -- is
# carried by the floating HP pip, which is drawn in code.
#
# Keyed by DARKNESS, not by the near-white flood fill every other sprite uses.
# A scorch has no edge to find: its outer third is deliberately soft grey
# smoke, which a near-white key either leaves as an opaque grey halo or eats
# along with the char. Deriving alpha from distance-from-white is literally
# "how much soot is here" and lets the smoke fall off the way it was painted.
# ===========================================================================
print('fx')
sc = alpha_from_darkness(Image.open(RAW + 'scorch-raw-01.png'))
sc = sc.crop(alpha_bbox(sc, thresh=2))
k = 256 / max(sc.size)
save(sc.resize((round(sc.width * k), round(sc.height * k)), Image.LANCZOS),
     'fx-scorch.png')

print('done')
