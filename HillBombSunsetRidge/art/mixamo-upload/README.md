# Mixamo rigging handoff

**Upload this:** `rider_tpose_singlemesh.zip` (3.6 MB — `model.obj` +
`model.mtl` + `rider_diffuse.jpg`).

## The FBX failed — use the zip instead

First attempt uploaded `rider_tpose.fbx` and Mixamo returned *"sorry — unable to
map your existing skeleton."* That message is misleading: I checked the file and
it contains **no skeleton at all** — 0 `LimbNode`, 0 `Deformer`, 0 `Skin`, 0
`Cluster`, 0 `Pose` nodes. Mixamo just falls back to that error text when it
can't take the auto-rig path.

The actual cause is near-certainly that Meshy's FBX exports **5 mesh nodes**
across 4 geometries, and Mixamo's auto-rigger wants **one single mesh**.

`rider_tpose_singlemesh.zip` fixes that at the root: an OBJ literally cannot
carry a skeleton or a node hierarchy, and this one is a verified **single
object** — `o model`, one `usemtl`, 15,636 verts / 31,281 faces, UVs present. So
Mixamo has no option but to auto-rig it.

Zip contents (Mixamo reads OBJ + MTL + texture from a flat zip):

| File | Notes |
|---|---|
| `model.obj` | Single mesh, T-pose, UV-mapped. |
| `model.mtl` | Declares `Material.018` — the exact name `model.obj` references. |
| `rider_diffuse.jpg` | 2048² base-colour map, extracted from the GLB. |

If it still refuses, the next thing to try is dropping the texture and uploading
`model.obj` alone — rigging only needs geometry, and I can re-apply materials in
code afterwards. Tell me and I'll cut that version.

`rider_tpose.fbx` is kept here for reference (and in case you want to retry it),
but it is **not** the file to upload.

## Why this step is manual

Mixamo has **no public API and no MCP**. Adobe retired the old developer API;
it's a browser-only app behind an Adobe login. Unofficial scripts that drive its
internal endpoints with a session cookie exist but break constantly. So this one
step needs a human with an Adobe account — everything either side of it is
automated.

Kolbo's `generate_3d` gives us a good textured mesh but **never a rig**
(`skins: 0, animations: 0` on every model tested — `enable_tpose` controls the
*pose*, not the skeleton; see `KOLBO_ASSET_PIPELINE.md`). Mixamo's auto-rigger is
what closes that gap.

## Steps

1. Go to <https://www.mixamo.com>, sign in with an Adobe account.
2. **UPLOAD CHARACTER** → drop in `rider_tpose.fbx`.
3. The auto-rigger opens. Place the markers it asks for — chin, wrists, elbows,
   knees, groin. The T-pose is deliberately strict so this is easy: arms fully
   horizontal, clear space between arms and torso, legs apart.
   - Skeleton LOD: **standard (65 bones)** unless there's a reason not to. No
     need for fingers, but leaving them costs nothing.
4. Confirm the rig preview animates cleanly (it plays a test motion). If the
   arms or shoulders deform badly, say so and I'll regenerate the mesh with a
   wider T-pose rather than you fighting the markers.
5. **Download.** Two things are useful:
   - The **rigged character with no animation** — Format `FBX Binary`, Pose
     `T-pose`. This is the one I actually need.
   - Optionally the skate clips you already downloaded, re-exported *on this
     character* — but see below, you probably don't need to.

## Your existing skate animations are not wasted

Every Mixamo animation targets the **same standard skeleton**. I confirmed this
by decoding the reference build's own character
(`gobalance-street-run.pages.dev`): it embeds a base64 binary FBX containing
`mixamo.com`, 260 skin clusters, and the standard 33-bone `mixamorig:` hierarchy
(`Hips`, `Spine`, `LeftArm`, `RightUpLeg`, …). That's the same skeleton
auto-rigging our character will produce.

Because the bone names and hierarchy match, animation clips are **portable**: in
Three.js I can load the rigged character from one file and drive it with
`AnimationClip`s from another, binding by bone name. So the clips you already
have should retarget onto our rider without re-downloading them per character.

What I need from you, in order of usefulness:
1. `rider_tpose` rigged, FBX Binary, T-pose, **no animation** — the character.
2. The skate clips you downloaded — **"Without Skin"** FBX if Mixamo offers it
   (smaller: skeleton + animation only, no duplicated mesh). If they're
   "With Skin", that's fine too, I'll strip the mesh.

Drop them in `HillBombSunsetRidge/art/mixamo-rigged/` and tell me — I'll wire
them into the render lab as a third mode with real skeletal animation.

## Also relevant: what the reference tells us about quality

That same decode showed the reference character has **0 textures** — it's an
untextured Mixamo mesh, which is exactly why it reads bland. Ours arrives with a
full PBR set (base colour, normal, metallic-roughness, emissive) already
UV-unwrapped by Meshy. So rigging ours should land ahead of the reference on
looks while matching it on animation.

## Files here

| File | What it is |
|---|---|
| `rider_tpose.fbx` | **Upload this.** T-posed, textured, unrigged, single mesh. |
| `rider_tpose_reference.png` | The `gpt-image-2` render the mesh was built from. |
| `rider_tpose_model_preview.png` | Meshy's render of the generated mesh. |

Generation recipe (so this is reproducible): `gpt-image-2` at `quality: high` for
the strict-T-pose front render → `meshy/v6-preview/image-to-3d` with
`enable_pbr` + `enable_tpose` + a `texture_prompt`. Single front view beat a
3-view turnaround clearly — see `KOLBO_ASSET_PIPELINE.md`.
