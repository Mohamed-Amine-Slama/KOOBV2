# KOOB — Media Generation Kit

Turnkey prompts for generating the cinematic asset suite (Higgsfield CLI, authenticated as
`cykacuk@gmail.com`). The site already references the **exact filenames** below, so generated
files drop into `/assets/` and swap in with zero markup changes.

> **Blocker note:** the Higgsfield account is currently **free plan, 0 credits** — `generate`
> returns `not_enough_credits`. Add credits at higgsfield.ai, then run the commands below.

---

## Global art-direction lock — append to EVERY prompt

> *photoreal, dark moody deep-green (#082518) seamless backdrop, single warm gold (#c8a96e)
> rim light from the upper right, soft volumetric haze, shallow depth of field, cinematic,
> centered subject, no text, no logos, no watermark.*

This single sentence on every generation is what makes the suite read as **designed**, not stock.

---

## CLI cheat-sheet

```bash
# estimate cost without spending
higgsfield generate cost  <model> --prompt "..."

# image (Nano Banana Pro = nano_banana_2; alts: seedream_v4_5, flux_2, text2image_soul_v2)
higgsfield generate create nano_banana_2 \
  --prompt "<shot prompt> + <art-direction lock>" \
  --aspect-ratio 1:1 --wait --wait-timeout 20m --output assets/<name>.png

# video (veo3_1 / kling3_0 / seedance_2_0 / cinematic_studio_video_3_5)
higgsfield generate create veo3_1 \
  --prompt "<shot prompt> + <art-direction lock>" \
  --aspect-ratio 9:16 --wait --wait-timeout 20m --output assets/hero-fill.mp4

higgsfield account status        # check credit balance
higgsfield generate list         # see recent jobs
```

After generating, optimize (see **Post-processing** at the bottom) so files match the site's
WebP/MP4 budgets.

---

## A. Hero — signature scroll-fill cup  ★ highest priority

The cup video is scrubbed by scroll (`currentTime` ← scroll progress), so it must be a **locked,
static-camera** shot of the cup filling. The poster (final frame) is the LCP image and must look
finished on its own.

| Filename | Type | Prompt (+ append the lock) |
|---|---|---|
| `assets/hero-fill.mp4` & `assets/hero-fill.webm` | video · 4s · 9:16 · static camera | "An empty KOOB ceramic coffee cup on a dark green surface; a smooth stream of espresso pours in and fills the cup to the brim; steam curls upward as it fills; warm gold rim light; absolutely fixed frame, no camera movement, no zoom." |
| `assets/hero-cup-poster.webp` | still = final frame | "A KOOB ceramic cup full of espresso with golden crema, steam rising, warm gold rim light, dark green backdrop." |
| `assets/hero-cup-empty.webp` | still = first frame | "An empty KOOB ceramic cup, same exact angle and lighting, dark green backdrop." |

> The poster/empty stills are also the **fallback** for mobile / reduced-motion / decode-failure
> (poster crossfades to full + steam). Keep angle & lighting identical between the two.

---

## B. Collection — 3 roasts (orbit + slides)

Same cup, same angle, same light — **only the liquid changes** — so the collection reads as one
product line.

| Filename | Prompt (+ lock) |
|---|---|
| `assets/white-coffee.webp` | "Light-roast white coffee in the KOOB cup, pale crema, delicate, glossy surface." |
| `assets/milk-coffee.webp` | "Balanced milk coffee, caramel tone, latte body, in the KOOB cup." |
| `assets/dark-coffee.webp` | "Intense dark espresso, deep crema, smoky, in the KOOB cup." |

---

## C. Featured drinks — 7

Matching glassware, garnish true to flavor, same angle/light. *(These are net-new images — add an
`<img class="drink-photo">` to each `.drink-card` in `#featured` when you wire them, or ask Claude
to.)*

| Filename | Prompt (+ lock) |
|---|---|
| `assets/featured-iced-caramel-coffee.webp` | "Iced caramel coffee in a tall glass, caramel drizzle down the inside, ice cubes." |
| `assets/featured-iced-caramel-matcha.webp` | "Iced caramel matcha latte, layered green and milk, caramel, tall glass, ice." |
| `assets/featured-vanilla-frappuccino.webp` | "Vanilla frappuccino, whipped cream dome, in a clear domed cup." |
| `assets/featured-speculoos-milkshake.webp` | "Speculoos milkshake, biscuit crumble, whipped cream, tall glass." |
| `assets/featured-blue-mojito.webp` | "Blue virgin mojito, mint leaves, lime wedge, crushed ice, highball glass." |
| `assets/featured-strawberry-banana-smoothie.webp` | "Thick strawberry and banana smoothie, fresh fruit garnish, tall glass." |
| `assets/featured-affogato.webp` | "Affogato — a shot of espresso poured over vanilla gelato, small clear glass." |

---

## D. Ambiance / interior (Story + Ambiance sections)

| Filename | Prompt (+ lock) |
|---|---|
| `assets/ambiance-calligraphy.webp` | "A deep hunter-green café wall with hand-painted Arabic calligraphy, warm pendant light grazing the texture." |
| `assets/ambiance-interior.webp` | "Forest-green specialty café interior, black pendant lights, warm wood floor, moody and inviting, empty." |
| `assets/ambiance-mirror.webp` | "A glowing illuminated mirror entrance that reads like a portal, soft teal glow, dark surroundings." |
| `assets/ambiance-wide.webp` | "Wide establishing shot of a warm, dim specialty café, deep green tones, atmospheric, cinematic." |

---

## E. Craft / texture

| Filename | Prompt (+ lock) |
|---|---|
| `assets/beans-macro.webp` | "Extreme macro of glossy roasted coffee beans, rich brown, dramatic side light, fine detail." |
| `assets/latte-art.webp` | "Top-down latte art rosetta in a cup, creamy microfoam, warm tone." |

*(Optional: `assets/bean-sprite.webp` — the ambient canvas bean — is already generated from a
small crop. Regenerate from `beans-macro` if you want it sharper.)*

---

## F. Founder portrait — ⚠ caveat

`assets/founder.webp` — **A generated face is a synthetic stand-in, not the real Amir Ghzel. Do not
present an AI-generated face as a named real person.**

- **Preferred:** supply a real photo of Amir → save as `assets/founder.webp`, then set
  `.founder-avatar { background-image: url('assets/founder.webp'); }` and remove the `AG` text.
- **Fallback (no real person, faceless/editorial):**
  > "Barista hands cradling a warm cup at a café counter, low-key warm light, gold rim light, café bokeh." + lock

Until a real photo is added, the site shows a clean gold **"AG" monogram** (no external dependency).

---

## Post-processing (so files meet the site's budgets)

**Stills → WebP** (Pillow is already installed — no extra install):

```bash
# usage: python3 tools/optimize_image.py <src.png> <out.webp> <max_width> [quality]
python3 tools/optimize_image.py assets/_raw/hero-cup-poster.png assets/hero-cup-poster.webp 760 86
python3 tools/optimize_image.py assets/_raw/white-coffee.png    assets/white-coffee.webp    600 84
# ...repeat per still. Targets: cups ≤ 60 KB, poster ≤ 80 KB.
```

If `tools/optimize_image.py` is absent, the one-liner is:

```python
from PIL import Image
im = Image.open(SRC).convert("RGBA"); im.thumbnail((MAXW, 9999), Image.LANCZOS)
im.save(OUT, "WEBP", quality=84, method=6)
```

**Hero video → seekable MP4 + WebM** (system `ffmpeg` is absent — use `npx ffmpeg-static`, or any
ffmpeg). Dense keyframes + faststart are what make scroll-scrubbing smooth:

```bash
# MP4 (H.264 — required by iOS Safari)
ffmpeg -i assets/_raw/hero-fill.mov \
  -vf "scale=-2:720" -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -g 6 -keyint_min 6 -sc_threshold 0 -crf 23 -movflags +faststart -an \
  assets/hero-fill.mp4
# WebM (VP9 — smaller, for Chrome/Firefox)
ffmpeg -i assets/_raw/hero-fill.mov \
  -vf "scale=-2:720" -c:v libvpx-vp9 -g 6 -crf 30 -b:v 0 -an assets/hero-fill.webm
# poster (final frame) → then optimize to WebP
ffmpeg -sseof -0.1 -i assets/hero-fill.mp4 -frames:v 1 assets/_raw/hero-cup-poster.png
```

Targets: hero video ≤ 3 MB. If you need a buttery-smooth scrub and don't mind size, use `-g 1`
(keyframe every frame) and cap ≤ 6 MB.

---

## Filename → site-reference map (what's already wired)

| Asset | Used by | Status |
|---|---|---|
| `hero-fill.mp4` / `.webm` | `.hero-fill-video` (scroll-scrubbed) | **needed** (currently 404 → falls back to poster) |
| `hero-cup-poster.webp` | video poster + fallback `.cup-full` + LCP | placeholder present |
| `hero-cup-empty.webp` | fallback `.cup-empty` | placeholder present |
| `white-coffee.webp` / `milk-coffee.webp` / `dark-coffee.webp` | collection orbit + slides | placeholder present |
| `features-cup.webp` | `#features` center cup | placeholder present |
| `heart.webp` | hero floating heart | present |
| `bean-sprite.webp` | ambient canvas bean field | present |
| `featured-*.webp` (7) | `#featured` drink cards | not yet wired (text-only today) |
| `ambiance-*.webp` (4) | Story / Ambiance sections | not yet wired |
| `founder.webp` | founder avatar | optional (monogram fallback active) |

Replace any "placeholder present" file with a real generation and it appears instantly — no code
changes. Run a quick `python3 -m http.server` and scroll through to confirm.

---

## 3D asset pipeline (the real-time journey layer)

The scroll-driven 3D experience (portal entry → cup journey) is built from assets in
`assets/models/`, authored in Blender and loaded by `js/koob3d.js`. Everything below is
reproducible without sudo or a build step.

### Source of truth

- `assets/models/src/koob-scene.blend` — the authored scene: the branded paper cup
  `Cup` (192-seg spin, cylindrical UVs: u = angle with the seam at the back, v =
  height/0.1035), its separate `Lid` (black dome, origin at the cup-rim contact plane so
  the lid-off scrub pivots naturally), `Liquid` (origin at its base so `scale.y` fills
  upward; the runtime also scales x/z with the fill so the cone stays inside the wall
  taper), `Steam1..3` (alpha planes using `src/steam.png`), plus Sketchfab-sourced
  `Bean`, `Portafilter`, `Glass` (licenses: `assets/models/ATTRIBUTION.md`; the Glass is
  retired from the choreography but still ships in the props GLB). Materials (exact
  names — the runtime looks objects/materials up by name): `Paper` (albedo
  `src/paper_col.png`), `LidPlastic`, `Espresso`, `SteamWisp`. There is **no `Saucer`**
  — the cup GLB contract is `Cup, Lid, Liquid, Steam1, Steam2, Steam3`.
- The paper albedo is authored by `python3 tools/make_cup_texture.py` (kraft base + the
  dark KOOB sticker; `--u/--v/--radius/--aspect/--size` tunable — `--aspect` pre-squashes
  the sticker so the cylindrical wrap reads circular; keep the grain amplitude tiny or
  ETC1S turns it into chroma streaks). To re-texture without a Blender roundtrip,
  `node tools/swap_cup_texture.mjs` swaps the PNG inside the raw GLBs.
- `assets/models/portal.glb` — the mirror-door entry arch (baked textures in `src/bake/`).
  Compressed in place (see budgets below); the pre-compression original is kept at
  `assets/models/src/portal-original.glb` (also recoverable from git history at `0b62042`).
- Regenerate the steam texture: `python3 tools/make_steam_texture.py`.

### Export recipe (Blender → web)

1. In Blender, select the six cup objects (or three props) and export GLB:
   `use_selection=True, export_yup=True, export_apply=True` →
   `assets/models/src/<name>-raw.glb` (raw exports are git-ignored).
2. Mobile tier: duplicate objects with copied mesh data, drop Subsurf, add Decimate 0.25
   (not on steam planes), temporarily rename the copies to the contract names, export,
   then restore names and delete the copies.
3. Compress (Draco + real KTX2). Pass `--flatten false --join false --instance false
   --simplify false --palette false` — optimize's default join pass merges the
   `Steam1..3` nodes and breaks the name contract:
   ```bash
   npx --yes @gltf-transform/cli@4 optimize assets/models/src/cup-desktop-raw.glb \
     assets/models/cup-desktop.glb --compress draco --texture-compress ktx2 --texture-size 2048 \
     --flatten false --join false --instance false --simplify false --palette false
   # mobile tier: same with --texture-size 1024
   ```
   Desktop cup albedo ships as **UASTC** for sharper sticker strokes (ETC1S softens
   them): run `optimize` with `--texture-compress false`, then
   `npx @gltf-transform/cli@4 uastc in.glb out.glb --slots baseColor --level 2 --zstd 18`,
   then re-apply `npx @gltf-transform/cli@4 draco` (the uastc pass drops it).
   `ktx2` needs `toktx`: no sudo required — download the KTX-Software Linux x86_64
   **tarball** from GitHub releases, extract anywhere, and put its `bin/` on PATH for the
   command (it resolves its bundled libktx via rpath). This checkout has it at
   `~/.local/ktx/KTX-Software-4.4.2-Linux-x86_64/bin`.
4. Verify: `npx @gltf-transform/cli@4 inspect assets/models/cup-desktop.glb` — node names
   must match the contract exactly; `Liquid` translation must keep its base pivot.

### Budgets vs. actuals

| Tier | Budget | Actual |
|---|---|---|
| Desktop (cup + props) | ≤ 5 MB | 3.5 MB (paper cup 225 KB UASTC + props 3.3 MB) |
| Mobile (cup + props) | ≤ 1.5 MB | 1.0 MB (paper cup 62 KB) |
| Portal (both tiers) | — | 0.58 MB (compressed in place from 1.9 MB via the same recipe below — draco + KTX2 @2048px; original kept at `assets/models/src/portal-original.glb`) |

### Runtime switches

- Tier pick (`pickTier` in `js/koob3d-core.js`): viewport < 900px, `deviceMemory` ≤ 4, or
  `maxTextureSize` < 4096 → mobile assets.
- `html.has-3d` is the master switch, set by the sync gate in `<head>`: WebGL available,
  no `prefers-reduced-motion`, and no `?no3d` in the URL. Without it the portal overlay
  never shows and the legacy video/image site runs untouched.
- The portal entry is a **time-based overlay flight on top of #hero** (no scroll runway;
  `#hero` sits at scroll 0). The flight tween is created paused and played only once the
  GLBs are adopted and shaders compiled — never on a wall-clock delay, because Lenis's
  `lagSmoothing(0)` turns load stalls into tween-skipping time jumps. Scrolling stays
  Lenis-locked (`window.__lenis` handshake with index.html) until the flight lands.
- Under `has-3d` the canvas paints the brand-teal hero backdrop itself (`HERO_BG_COLOR`
  clear color, gated by `portalT`, faded out by the `heroLeave` entry); the `#hero` DOM
  is transparent, and the teal CSS background serves the no-3d fallback.
- Any load/context failure calls `downgrade()`: full teardown (ticker, listeners,
  ScrollTriggers) then legacy restore.

### Verification

```bash
npm test                                        # core data/logic contracts (node --test)
npm run serve                                   # static server on :8123
node tools/shot.mjs http://localhost:8123/ 0,1170,2300,3100,5300,11900   # screenshots + console-error gate
node tools/shot.mjs http://localhost:8123/ 0,1100,2400 --mobile          # mobile tier
```

Lighthouse note: headless software-GL (WSL2) makes 3D-page LCP/TBT meaningless — CLS ≈ 0
is the environment-independent gate (passes). Re-measure LCP on real GPU hardware.
