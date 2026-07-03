# KOOB 3D Journey — Design Spec

**Date:** 2026-07-02
**Status:** Approved

## Context

The KOOB site (`index.html`, single-file, GSAP + Lenis) was designed around igloo.inc's
scroll-scrubbed 3D object concept (`design.md` line 19), but the shipped implementation fakes
all 3D: the hero "cup filling" is a scrubbed video (`assets/hero-fill.mp4`), the collection
"rotating cup" swaps pre-rendered images by scroll index, and the bean field is a 2D canvas.
This project replaces the fakes with a real, ultra-detailed, real-time 3D experience —
fulfilling the original design vision.

## Decisions (locked with owner)

1. **Scope:** Full 3D journey — one persistent cup travels and transforms across sections.
2. **Model sourcing:** Hybrid — signature KOOB cup built from scratch in Blender (via Blender
   MCP); supporting props (beans, portafilter, glassware) imported from Sketchfab and
   re-materialed in Blender for brand consistency.
3. **Mobile:** Lighter 3D on mobile — everyone gets real 3D via two asset tiers
   (desktop / mobile), not a video fallback for phones.
4. **Architecture:** One persistent three.js scene — a single fullscreen fixed canvas behind
   the DOM; GSAP ScrollTrigger drives camera and object transforms (igloo.inc technique).

## Tooling available (verified 2026-07-02)

- Blender MCP connected (fresh default scene).
- Sketchfab integration enabled (logged in: `mohamedamineslama17`).
- Hyper3D Rodin enabled (free trial) — optional generation path if a prop can't be found.
- PolyHaven disabled — enable in the BlenderMCP panel if HDRIs/textures are wanted.

## Component 1 — Asset production (Blender)

**Signature cup (from scratch):** ceramic body with subtle surface imperfections, gold rim
band matching `--koob-gold` (#c8a96e), KOOB mark, saucer. Three sub-objects with clean
separation so the runtime can animate them independently:

- `cup` — static mesh, ceramic + gold materials
- `liquid` — espresso with crema surface material; fill is animated at runtime
  (scale/morph along Z)
- `steam` — shader-based wisps (alpha planes), animated at runtime

Visual reference: existing brand renders (`Cup.png`, `CupCoffee.png`, `assets/*.jpeg`) so the
3D cup matches imagery already on the site.

**Props (Sketchfab):** coffee beans (instanced scatter — replaces the 2D canvas bean field),
portafilter (story/features moments), tall glassware (featured section). Downloadable-license
models only; record attribution where the license requires it. Re-material everything to the
KOOB palette (forest green, gold, cream).

**Export pipeline — two tiers:**

| Tier | Meshes | Textures | Compression | Budget |
|---|---|---|---|---|
| Desktop | full detail | 2K | Draco GLB + KTX2 | ≤ ~5 MB total |
| Mobile | decimated to ~20–25% | 1K | Draco GLB + KTX2 | ≤ ~1.5 MB total |

Files land in `assets/models/` (e.g. `cup-desktop.glb`, `cup-mobile.glb`, `props-desktop.glb`,
`props-mobile.glb`). Every modeling milestone is verified with Blender viewport screenshots
before proceeding.

## Component 2 — Runtime (three.js)

three.js from CDN via import map — no build step, matching the site's philosophy. New
`<canvas id="koob-3d">` fixed fullscreen, z-indexed behind DOM content, above background.
Loaders: GLTFLoader + DRACOLoader + KTX2Loader.

**Scroll choreography** (keyed to existing section IDs, driven by the existing
ScrollTrigger + Lenis setup):

| Section | Cup behavior |
|---|---|
| `#preloader` / void | Cup emerges from darkness inside the teal glow |
| `#hero` (200vh pin) | Liquid fills scrubbed to scroll — replaces `hero-fill.mp4`; steam rises; mouse parallax |
| `#story` | Cup drifts off-center and shrinks; 3D beans float past |
| `#collection` | Full 360° turntable; liquid material swaps white/milk/dark per slide — replaces image-swap orbit |
| `#menu` (light section) | Cup exits frame; renderer pauses |
| `#featured` | Glassware props drift subtly in the background as the card carousel scrolls |
| `#features` | Cup returns center-stage with live steam |
| `#quiz` → `#footer` | Cup recedes into the void; gold particle burst in real 3D |

Rendering is on-demand: render only when scroll/mouse/animation state changes; fully pause
while the 3D is out of frame (menu and later sections without 3D moments).

## Component 3 — Code organization

- `js/koob3d.js` — the entire 3D runtime as an ES module (scene, loaders, choreography,
  fallback logic). Not inlined into the already-5471-line `index.html`.
- `index.html` — gains only: the canvas element, the import map, one module script tag,
  and small CSS for canvas layering.
- `assets/models/` — GLB/KTX2 assets, both tiers.

Serving assumption: static HTTP server (`python3 -m http.server`), already the documented
workflow in `MEDIA_GENERATION.md`; required for GLB fetching regardless.

## Component 4 — Fallback chain

The current video + image experience stays in the markup untouched and activates when any of
these hold:

- WebGL unavailable (context creation fails)
- GLB fetch or decode failure
- WebGL context lost and not restorable
- `prefers-reduced-motion: reduce`

Device capability check (GPU tier / memory / viewport) picks the desktop vs mobile asset
tier. Assets lazy-load behind the existing ~3s preloader animation so perceived load time
does not change. The fallback decision is made at boot; additionally, mid-session failures
(WebGL context loss, GLB load failure) trigger a one-way downgrade to the legacy experience.

## Verification

1. Blender viewport screenshots at each asset milestone (silhouette → materials → export).
2. Local static server + browser screenshots scrolling every section (desktop + mobile
   emulation) — confirm each choreography row above.
3. FPS overlay during dev; target 60 fps desktop, 30+ fps mid-range mobile emulation.
4. Lighthouse pass — no LCP/CLS regression vs. the current site.
5. Fallback test: force-disable WebGL and confirm the video experience still works.
