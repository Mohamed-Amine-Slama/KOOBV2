# KOOB Paper Cup + 3-Cup Hero — Design Spec

**Date:** 2026-07-03
**Status:** Approved
**Supersedes (partially):** `2026-07-02-3d-journey-design.md` — replaces the ceramic signature cup and the hero liquid-fill choreography; every other section of that spec stays in force.

## Goal

Replace the ceramic cup + saucer 3D model with the coffee shop's real branded paper cup (kraft body, black plastic lid, dark circular sticker carrying the cream KOOB wordmark + Arabic calligraphy — matching the product photos in `assets/WhatsApp Image 2026-07-03 at 5.55.07 PM.jpeg` / `...5.55.09 PM.jpeg`). Redesign the hero so that, as soon as the portal flight lands, the hero text sits on the left and **three** paper cups stand on the right; on scroll the middle cup's lid lifts away, coffee fills it, and it becomes the persistent journey cup for the rest of the page.

## Decisions (locked with user)

1. **Lid is a separate object** — not merged with the cup. Cups wear lids after portal entry; on scroll the middle cup's lid is removed, *then* the cup fills with coffee (existing liquid-fill/steam/roast animations are kept, re-sequenced after the lid phase).
2. **Journey scope** — only the middle cup travels onward (Story drift, Collection turntable, Features return). The two side cups keep their lids and fade/drift away as the user leaves the hero.
3. **Trio layout** — three identical cup instances in a loose arc with staggered depth: middle cup slightly forward and largest in frame, logo facing the camera; side cups behind and angled.
4. **Logo style** — match the photos: kraft/beige paper, black lid, near-black circular sticker with the cream logo.

## Asset design (Blender MCP)

Authored in `assets/models/src/koob-scene.blend` on the Windows host (Blender-side paths must be `C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2/...`). The ceramic `Cup` + `Saucer` are replaced; `Liquid` and `Steam1..3` are retained and refitted.

### New GLB object-name contract (exact, case-sensitive)

`Cup`, `Lid`, `Liquid`, `Steam1`, `Steam2`, `Steam3` — **no `Saucer`**.

### Objects

- **`Cup`** — tapered paper cup (truncated cone, rolled rim bead, slightly recessed base) proportioned from the photos (roughly 1.2:1 height:top-diameter). Kraft paper material with subtle vertical grain.
- **`Lid`** — black plastic dome lid: outer clamp rim, raised sip plateau, sip hole. Own mesh, origin at the cup-rim contact plane so lift/tilt animation pivots naturally. Rests on the cup rim in the authored pose.
- **`Liquid`** — coffee volume fitted to the paper cup interior; **origin stays at its base** so the runtime `scale.y` fill keeps working.
- **`Steam1..3`** — existing alpha planes (`SteamWisp` material, `src/steam.png`), repositioned above the taller cup rim.

### Materials

- **`Paper`** — kraft beige base (sampled from photos, ≈ warm beige `#d3c3ab`), roughness ≈ 0.65, subtle vertical-grain normal. Baked to `src/paper_col/rgh/nrm.png` at 2048.
- **Sticker** — composited into the `Paper` albedo bake (not a runtime decal): near-black/dark-forest circle with the cream logo. Source: `assets/logo 2.pdf_20260703_174119_0000.png` with its solid green background keyed out (Pillow script alongside `tools/make_steam_texture.py` conventions), cream mark preserved.
- **`LidPlastic`** — black plastic, roughness ≈ 0.35, no texture maps needed.
- **`Espresso`** — unchanged (runtime replaces it anyway for the roast lerp).
- **`SteamWisp`** — unchanged.

### Poly + size budgets

Cup ≤ ~40k tris evaluated, Lid ≤ ~20k (desktop tier). Mobile tier: Decimate 0.25 copies (not steam planes), same as the existing recipe. Export per `MEDIA_GENERATION.md` "3D asset pipeline": raw GLBs to `src/cup-{desktop,mobile}-raw.glb`, then `npx @gltf-transform/cli@4 optimize … --compress draco --texture-compress ktx2 --texture-size 2048|1024`. Hard budgets unchanged: desktop total ≤ 5 MB, mobile ≤ 1.5 MB (the paper cup is simpler than the ceramic one, so headroom is large). Verify with `gltf-transform inspect` — node names must match the contract; `Liquid` must keep its base pivot.

## Hero layout

- Hero text stays left (`.hero-content`, `index.html`) — no structural DOM change.
- The 3D trio frames right-of-center where the single cup sat (`INITIAL_STATE.cupX: 1.1`). The middle cup is the existing journey `rig`; the two side cups are **runtime clones** of the loaded cup+lid meshes (cloned materials so they can fade independently), parented to a static `sideCups` group at staggered depth/rotation.
- Placeholder path: `buildPlaceholderCup()` gets a paper-cup silhouette + lid, and two placeholder clones, so the trio renders instantly before the GLB streams in.
- Minor CSS: `.hero-glow` repositioning if needed; the no-3D fallback (`.hero-fill-video`) is untouched.

## Scroll choreography

All data-driven in `CHOREOGRAPHY` (`js/koob3d-core.js`); new state fields in `INITIAL_STATE`: `lidLift: 0`, `sideCups: 1`.

| Range | Behavior |
|---|---|
| Portal entry (`portalT` 0→1) | Unchanged. Camera lands on the trio, all lids on. |
| Hero phase A (`#hero` top → ~40%) | `lidLift` 0→1: middle cup's lid rises, tilts, drifts off-frame (mapped in `applyState`). |
| Hero phase B (~40% → bottom) | `liquidFill` →1, `steam` →1, plus the existing `cupRotY`/`cupRotX` drift. Gold-burst waypoint `cupFull` unchanged. |
| Story onward | Existing choreography for the middle cup (drift left, turntable, features return, outro) + `sideCups` 1→0 fade in the `story` entry. |

## Code touch-points

- `js/koob3d-core.js` — new `INITIAL_STATE` fields; `hero` entry split into `heroLid` + `heroFill` scrub ranges; `story` gains `sideCups: 0`. Unit tests in `tools/test/` updated.
- `js/koob3d.js` —
  - `adoptCupGltf()`: bind `Lid`; **drop the `Saucer` requirement**; build side-cup clones.
  - `applyState()`: map `lidLift` → lid transform curve; `sideCups` → side-group opacity/scale.
  - `buildPlaceholderCup()`: paper-cup profile + lid, no saucer, two clones.
- `index.html` — small hero CSS adjustments only.
- `MEDIA_GENERATION.md`, `assets/models/ATTRIBUTION.md` — updated (cup remains original KOOB work; ceramic texture set superseded by paper set).

## Error handling

- Missing contract object in the GLB still throws inside `adoptCupGltf()` → existing `downgrade()` path (video-fallback hero) — unchanged behavior, updated name list.
- All existing tier selection, render-pause, adaptive-DPR, teardown behavior untouched.

## Testing / verification

1. Blender viewport screenshot at every modeling milestone (cup profile, lid, sticker bake, trio framing).
2. `gltf-transform inspect` on both tiers: names, pivots, sizes vs budgets.
3. `npm test` — core tests for new state fields/choreography ranges.
4. `npm run serve` + `tools/shot.mjs`: screenshots at portal-landing, hero 0%/25% (lid lifting), 60% (filling), 100% (full + burst), Story entry (sides fading) — plus the console-error gate.
5. Manual scroll-through on desktop + mobile-emulation tiers.
