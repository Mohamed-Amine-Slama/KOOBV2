# KOOB 3D Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace KOOB's faked 3D (scrubbed video + image-swap orbit) with one persistent, ultra-detailed real-time 3D coffee cup that travels through every section, per the approved spec `docs/superpowers/specs/2026-07-02-3d-journey-design.md`.

**Architecture:** One fullscreen fixed three.js canvas at `z-index: 1` — above the body's scroll-tweened background, below every `section` (`position: relative; z-index: 2`). A plain-object `state` is mutated by GSAP ScrollTriggers (declared as data in a pure, node-testable core module) and applied to the scene each render. Assets are authored in Blender via the Blender MCP (custom cup) plus Sketchfab imports (props), exported as Draco GLB in two tiers.

**Tech Stack:** three.js 0.170.0 (CDN import map, no build step) · GSAP 3.12.5 + ScrollTrigger + Lenis (already on the page) · Blender MCP (modeling, baking, export) · Sketchfab MCP (props) · `@gltf-transform/cli` (compression) · `node --test` (pure-logic tests) · Playwright (visual verification).

## Global Constraints

- No build step. The site stays a static site served by `python3 -m http.server 8123` from the repo root.
- three.js pinned to `0.170.0` via jsdelivr import map. GSAP stays at the existing 3.12.5 CDN scripts.
- **GLB object-name contract (exact, case-sensitive):** cup GLB contains `Cup`, `Saucer`, `Liquid`, `Steam1`, `Steam2`, `Steam3`; props GLB contains `Bean`, `Portafilter`, `Glass`. Material names: `Ceramic`, `GoldRim`, `Espresso`, `SteamWisp`.
- **Budgets (hard):** desktop GLBs ≤ 5 MB total; mobile GLBs ≤ 1.5 MB total. Texture caps: 2048px desktop, 1024px mobile.
- Texture compression: attempt KTX2 (needs KTX-Software's `toktx`); if not installable in one try, use WebP (`EXT_texture_webp`) — budgets are the hard requirement, KTX2 is preferred-not-required.
- Palette (from `:root` in index.html): gold `#c8a96e`, cream `#f5f0e8`, forest `#0d3b2e`, teal `#1a6b52`, deep `#082518`, void `#040d08`.
- Blender runs on the Windows host; Blender-side Python must use `C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2/...` paths (verify in Task 4 Step 1; the WSL view of the same files is `/mnt/c/...`).
- The `html.has-3d` class is the single switch: present = 3D active, absent = today's video/image experience. Never remove legacy markup.
- Sketchfab: downloadable CC0/CC-BY models only; every import recorded in `assets/models/ATTRIBUTION.md`; CC-BY additionally gets a visible footer credit.
- Commits: one per task minimum, message style `feat(3d): ...`, each ending with the line `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Execute in-place on `main` (Blender exports write directly into `assets/models/`; a worktree would break Blender's export paths).

## File Structure

| Path | Responsibility |
|---|---|
| `js/koob3d-core.js` | Pure logic, zero DOM/three.js imports: fallback decision, tier pick, model URLs, roast palette, choreography data. Unit-tested. |
| `js/koob3d.js` | WebGL runtime ES module: renderer, loaders, scene, state→scene application, GSAP wiring, render-on-demand, context-loss + load-failure downgrade. |
| `tools/test/koob3d-core.test.mjs` | `node --test` suite for the core module. |
| `tools/shot.mjs` | Playwright screenshot harness (desktop + mobile viewports, scroll positions, console-error capture). |
| `tools/make_steam_texture.py` | Pillow script generating the steam wisp alpha texture. |
| `assets/models/` | `cup-desktop.glb`, `cup-mobile.glb`, `props-desktop.glb`, `props-mobile.glb`, `ATTRIBUTION.md` |
| `assets/models/src/` | `koob-scene.blend`, `steam.png`, uncompressed `*-raw.glb` exports (pre-gltf-transform) |
| `index.html` | Gains: early `has-3d` gate `<script>` in `<head>`, canvas element, `has-3d` CSS block, import map + module script. Two 3-line guards added to existing IIFEs. |
| `package.json` | Gains `scripts.test`, `scripts.serve`, devDependency `playwright`. |

---

### Task 1: Core module — fallback + tier logic (TDD)

**Files:**
- Create: `js/koob3d-core.js`
- Create: `tools/test/koob3d-core.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `shouldUse3D({webglOk, reducedMotion}) -> boolean`, `pickTier({viewportWidth, deviceMemory, maxTextureSize}) -> "desktop"|"mobile"`, `modelUrls(tier) -> {cup, props}` — consumed by Task 3's runtime and Task 2's choreography tests.

- [ ] **Step 1: Add test + serve scripts to package.json**

Replace the whole file (currently only devDependencies) with:

```json
{
  "devDependencies": {
    "ffmpeg-static": "^5.3.0",
    "ffprobe-static": "^3.1.0"
  },
  "scripts": {
    "test": "node --test tools/test/",
    "serve": "python3 -m http.server 8123"
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tools/test/koob3d-core.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldUse3D,
  pickTier,
  modelUrls,
} from "../../js/koob3d-core.js";

test("shouldUse3D: needs WebGL and no reduced-motion", () => {
  assert.equal(shouldUse3D({ webglOk: true, reducedMotion: false }), true);
  assert.equal(shouldUse3D({ webglOk: false, reducedMotion: false }), false);
  assert.equal(shouldUse3D({ webglOk: true, reducedMotion: true }), false);
  assert.equal(shouldUse3D({ webglOk: undefined, reducedMotion: false }), false);
});

test("pickTier: narrow viewport is mobile", () => {
  assert.equal(pickTier({ viewportWidth: 390 }), "mobile");
  assert.equal(pickTier({ viewportWidth: 899 }), "mobile");
});

test("pickTier: low memory or small textures is mobile", () => {
  assert.equal(pickTier({ viewportWidth: 1440, deviceMemory: 4 }), "mobile");
  assert.equal(pickTier({ viewportWidth: 1440, maxTextureSize: 2048 }), "mobile");
});

test("pickTier: capable desktop", () => {
  assert.equal(
    pickTier({ viewportWidth: 1440, deviceMemory: 8, maxTextureSize: 16384 }),
    "desktop"
  );
  assert.equal(pickTier({ viewportWidth: 1440 }), "desktop");
});

test("modelUrls: builds tiered paths and rejects junk", () => {
  assert.deepEqual(modelUrls("mobile"), {
    cup: "assets/models/cup-mobile.glb",
    props: "assets/models/props-mobile.glb",
  });
  assert.throws(() => modelUrls("tablet"));
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module .../js/koob3d-core.js`

- [ ] **Step 4: Implement the core module**

Create `js/koob3d-core.js`:

```js
/* Pure logic for the KOOB 3D journey — no DOM, no three.js.
   Tested by tools/test/koob3d-core.test.mjs via `npm test`. */

export function shouldUse3D({ webglOk, reducedMotion }) {
  return Boolean(webglOk) && !reducedMotion;
}

export function pickTier({ viewportWidth, deviceMemory, maxTextureSize }) {
  if (viewportWidth < 900) return "mobile";
  if (typeof deviceMemory === "number" && deviceMemory <= 4) return "mobile";
  if (typeof maxTextureSize === "number" && maxTextureSize < 4096) return "mobile";
  return "desktop";
}

export function modelUrls(tier) {
  if (tier !== "desktop" && tier !== "mobile") {
    throw new Error(`Unknown tier: ${tier}`);
  }
  return {
    cup: `assets/models/cup-${tier}.glb`,
    props: `assets/models/props-${tier}.glb`,
  };
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test`
Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add package.json js/koob3d-core.js tools/test/koob3d-core.test.mjs
git commit -m "feat(3d): core module with fallback + tier logic

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Core module — choreography data + roast palette (TDD)

**Files:**
- Modify: `js/koob3d-core.js`
- Modify: `tools/test/koob3d-core.test.mjs`

**Interfaces:**
- Produces: `INITIAL_STATE` (plain object of animatable numbers), `CHOREOGRAPHY` (array of `{id, trigger, start, end, scrub, to}`), `ROASTS` (3 × `{name, body, surface}` hex colors) — consumed by Task 3 (GSAP wiring) and Task 9 (roast material lerp).
- State keys (contract): `cupX cupY cupZ cupRotX cupRotY cupScale liquidFill steam roast beans glass sceneOpacity`.

- [ ] **Step 1: Append failing tests**

Append to `tools/test/koob3d-core.test.mjs`:

```js
import {
  INITIAL_STATE,
  CHOREOGRAPHY,
  ROASTS,
} from "../../js/koob3d-core.js";

const STATE_KEYS = [
  "cupX", "cupY", "cupZ", "cupRotX", "cupRotY", "cupScale",
  "liquidFill", "steam", "roast", "beans", "glass", "sceneOpacity",
];
const SECTION_IDS = [
  "#hero", "#story", "#collection", "#menu",
  "#featured", "#features", "#quiz",
];

test("INITIAL_STATE has exactly the contract keys, all numbers", () => {
  assert.deepEqual(Object.keys(INITIAL_STATE).sort(), [...STATE_KEYS].sort());
  for (const k of STATE_KEYS) assert.equal(typeof INITIAL_STATE[k], "number");
});

test("CHOREOGRAPHY: unique ids, real section triggers, known keys", () => {
  const ids = CHOREOGRAPHY.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CHOREOGRAPHY) {
    if (c.trigger !== null) {
      assert.ok(SECTION_IDS.includes(c.trigger), `bad trigger ${c.trigger}`);
      assert.equal(typeof c.start, "string");
      assert.equal(typeof c.end, "string");
      assert.equal(typeof c.scrub, "number");
    }
    for (const k of Object.keys(c.to)) {
      assert.ok(STATE_KEYS.includes(k), `unknown state key ${k} in ${c.id}`);
    }
  }
});

test("CHOREOGRAPHY: normalized channels stay in [0,1], roast in range", () => {
  for (const c of CHOREOGRAPHY) {
    for (const k of ["liquidFill", "steam", "beans", "glass", "sceneOpacity"]) {
      if (k in c.to) assert.ok(c.to[k] >= 0 && c.to[k] <= 1, `${c.id}.${k}`);
    }
    if ("roast" in c.to) {
      assert.ok(c.to.roast >= 0 && c.to.roast <= ROASTS.length - 1);
    }
  }
});

test("ROASTS: three roasts with hex colors", () => {
  assert.equal(ROASTS.length, 3);
  for (const r of ROASTS) {
    assert.match(r.body, /^#[0-9a-f]{6}$/i);
    assert.match(r.surface, /^#[0-9a-f]{6}$/i);
  }
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npm test`
Expected: 4 new tests FAIL (missing exports); original 5 still PASS.

- [ ] **Step 3: Implement choreography data**

Append to `js/koob3d-core.js`:

```js
/* One state object drives the whole scene. GSAP ScrollTriggers (built from
   CHOREOGRAPHY in koob3d.js) tween it; the render loop applies it. */
export const INITIAL_STATE = {
  cupX: 1.1, cupY: -0.2, cupZ: 0,
  cupRotX: -0.1, cupRotY: -0.4, cupScale: 1,
  liquidFill: 0.05, steam: 0, roast: 2,
  beans: 0, glass: 0, sceneOpacity: 0,
};

/* Liquid colors per collection slide, matching the existing
   white/milk/dark-coffee.webp renders: 0=Latte 1=Americano 2=Espresso */
export const ROASTS = [
  { name: "latte", body: "#d7b08a", surface: "#e8cfae" },
  { name: "americano", body: "#7a4a2b", surface: "#a9744a" },
  { name: "espresso", body: "#3c2414", surface: "#8a5a30" },
];

/* trigger:null = time-based boot tween at load, not scroll-driven.
   cupRotY 6.78 ≈ 0.5 + 2π: one full extra turn through the collection. */
export const CHOREOGRAPHY = [
  { id: "boot", trigger: null, to: { sceneOpacity: 1 }, duration: 1.2 },
  { id: "hero", trigger: "#hero", start: "top top", end: "bottom top",
    scrub: 1.2, to: { liquidFill: 1, steam: 1, cupRotY: 0.5, cupRotX: -0.16 } },
  { id: "story", trigger: "#story", start: "top 85%", end: "bottom 40%",
    scrub: 1.2, to: { cupX: -1.15, cupScale: 0.55, steam: 0.25, beans: 1, roast: 0 } },
  { id: "collection", trigger: "#collection", start: "top top", end: "bottom bottom",
    scrub: 1, to: { cupX: 0, cupY: -0.1, cupScale: 1.15, cupRotY: 6.78, roast: 2, beans: 0.35 } },
  { id: "menu", trigger: "#menu", start: "top 70%", end: "top 15%",
    scrub: 1, to: { sceneOpacity: 0, cupScale: 0.5, steam: 0, beans: 0 } },
  { id: "featured", trigger: "#featured", start: "top 60%", end: "bottom bottom",
    scrub: 1, to: { glass: 1, sceneOpacity: 1 } },
  { id: "features", trigger: "#features", start: "top 80%", end: "center center",
    scrub: 1, to: { sceneOpacity: 1, cupX: 0, cupY: -0.15, cupScale: 1, cupRotY: 0, steam: 1, glass: 0 } },
  { id: "outro", trigger: "#quiz", start: "top 80%", end: "bottom top",
    scrub: 1, to: { sceneOpacity: 0, cupScale: 0.35, steam: 0 } },
];
```

Roast arc: the hero pours espresso (`INITIAL_STATE.roast: 2`); the story tween quietly resets to latte (`roast: 0`) while the cup is small and off-center; the collection scrub then walks 0 → 2, hitting latte/americano/espresso in sync with the three slides.

- [ ] **Step 4: Run tests, verify all pass**

Run: `npm test`
Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add js/koob3d-core.js tools/test/koob3d-core.test.mjs
git commit -m "feat(3d): choreography data, roast palette, initial state

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Runtime scaffold in index.html — placeholder cup, full choreography

**Files:**
- Create: `js/koob3d.js`
- Modify: `index.html` (four surgical insertions + two guards — anchors below)
- Create: `tools/shot.mjs`
- Modify: `package.json` (add playwright devDependency)

**Interfaces:**
- Consumes: everything exported by `js/koob3d-core.js` (Tasks 1–2 signatures).
- Produces: `window.__koob3d` debug handle `{ state, scene, renderer, tier }` (used by Task 12 verification); `html.has-3d` class contract; `buildPlaceholderCup()` internal (replaced in Task 9 by GLB loading — Task 9 modifies this file).

- [ ] **Step 1: Early synchronous gate in `<head>`**

In `index.html`, immediately BEFORE the line `<style>` (search anchor: the sole `<style>` tag, ~line 16), insert:

```html
    <script>
      /* has-3d gate — must run before first paint so legacy visuals never flash.
         Mirrors shouldUse3D() in js/koob3d-core.js (kept inline: must be sync). */
      (function () {
        try {
          var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
          var c = document.createElement("canvas");
          var gl = c.getContext("webgl2") || c.getContext("webgl");
          if (gl && !reduced) document.documentElement.classList.add("has-3d");
        } catch (e) {}
      })();
    </script>
```

- [ ] **Step 2: Canvas element + CSS**

(a) In `index.html`, immediately AFTER `<body>`'s first child comment/element — concretely, right BEFORE the line `<canvas class="bean-field" aria-hidden="true"></canvas>` is NOT the spot; the bean-field is inside `#hero`. Insert as the FIRST element after the `<body>` tag (search anchor: `<body>`):

```html
    <canvas id="koob-3d" aria-hidden="true"></canvas>
```

(b) In the `<style>` block, right after the `section { position: relative; z-index: 2; }` rule (~line 188), insert:

```css
      /* ===== 3D journey layer (html.has-3d gates everything) ===== */
      #koob-3d {
        display: none;
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 1; /* above body bg, below every section (z-index: 2) */
        pointer-events: none;
        opacity: 0; /* no CSS transition — state.sceneOpacity drives inline opacity per frame */
      }
      html.has-3d #koob-3d {
        display: block;
      }
      /* hide the faked 3D while the real one is live */
      html.has-3d .hero-cup-container,
      html.has-3d .bean-field,
      html.has-3d .orbit-cup {
        visibility: hidden;
      }
      /* let the canvas show through the three opaque 3D-hosting sections */
      html.has-3d #collection,
      html.has-3d #featured,
      html.has-3d #features {
        background: transparent;
      }
```

- [ ] **Step 3: Import map + module script**

In `index.html`, AFTER the closing `</script>` of the main inline script (line ~5469, search anchor: the LAST `</script>` before `</body>`), insert:

```html
    <script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
          "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
        }
      }
    </script>
    <script type="module" src="js/koob3d.js"></script>
```

(Import maps must appear before the first module import resolves; placing both at document end together is valid — the module script is deferred by definition and the import map precedes it in document order.)

- [ ] **Step 4: Guard the two legacy IIFEs**

(a) In the `heroExit` IIFE (~line 4472), the ambient video block currently reads:

```js
        if (video) {
          video.muted = true;
```

Change the condition to:

```js
        if (video && !document.documentElement.classList.contains("has-3d")) {
          video.muted = true;
```

(b) In the `beanField` IIFE (~line 4526), after `if (!canvas) return;` add one line:

```js
        if (document.documentElement.classList.contains("has-3d")) return;
```

Also expose a restart hook for downgrade: change `(function beanField() {` to

```js
      function startBeanField() {
```

and its trailing `})();` to `}
      window.__startBeanField = startBeanField;
      startBeanField();` — the guard inside makes the immediate call a no-op when 3D is on, and `koob3d.js` calls `window.__startBeanField()` after removing the class on downgrade.

- [ ] **Step 5: Write the runtime with a placeholder lathe cup**

Create `js/koob3d.js`:

```js
/* KOOB 3D journey runtime. Boots only when html.has-3d is present (set by the
   inline gate in <head>). On any failure: downgrade() restores the legacy
   experience and the page keeps working. */
import * as THREE from "three";
import {
  pickTier,
  modelUrls,
  INITIAL_STATE,
  CHOREOGRAPHY,
  ROASTS,
} from "./koob3d-core.js";

const root = document.documentElement;
if (root.classList.contains("has-3d")) boot();

function downgrade(reason) {
  console.warn("[koob3d] downgrading to legacy experience:", reason);
  root.classList.remove("has-3d");
  const canvas = document.getElementById("koob-3d");
  if (canvas) canvas.remove();
  const video = document.querySelector(".hero-fill-video");
  if (video) {
    video.muted = true;
    video.loop = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }
  if (window.__startBeanField) window.__startBeanField();
}

function boot() {
  const canvas = document.getElementById("koob-3d");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (err) {
    return downgrade(err);
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const tier = pickTier({
    viewportWidth: window.innerWidth,
    deviceMemory: navigator.deviceMemory,
    maxTextureSize: renderer.capabilities.maxTextureSize,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier === "mobile" ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  camera.position.set(0, 0.05, 0.55);

  /* KOOB lighting: warm gold key upper-right, teal fill left, soft ambient —
     matches the art-direction lock in MEDIA_GENERATION.md */
  const key = new THREE.DirectionalLight(0xc8a96e, 2.4);
  key.position.set(0.6, 0.9, 0.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x1a6b52, 0.9);
  fill.position.set(-0.7, 0.2, 0.4);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xf5f0e8, 0.35));

  const state = { ...INITIAL_STATE };
  const parallax = { x: 0, y: 0 };
  let needsRender = true;
  const invalidate = () => { needsRender = true; };

  /* ---- scene contents (placeholder until Task 9 swaps in the GLBs) ---- */
  const rig = new THREE.Group(); // choreography moves the rig
  scene.add(rig);
  const cupParts = buildPlaceholderCup();
  rig.add(cupParts.group);

  window.__koob3d = { state, scene, renderer, tier };

  /* ---- state → scene, executed only when something changed ---- */
  const roastColorA = new THREE.Color();
  const roastColorB = new THREE.Color();
  function applyState() {
    rig.position.set(state.cupX * 0.22, state.cupY * 0.22 + parallax.y, state.cupZ);
    rig.rotation.set(state.cupRotX, state.cupRotY + parallax.x, 0);
    rig.scale.setScalar(state.cupScale);
    // liquid fills bottom-up: origin sits at the liquid's base
    cupParts.liquid.scale.y = Math.max(state.liquidFill, 0.001);
    const i = Math.min(Math.floor(state.roast), ROASTS.length - 2);
    const f = Math.min(state.roast - i, 1);
    roastColorA.set(ROASTS[i].body);
    roastColorB.set(ROASTS[i + 1].body);
    cupParts.liquid.material.color.copy(roastColorA).lerp(roastColorB, f);
    cupParts.steam.forEach((s, n) => {
      s.material.opacity = state.steam * (0.5 - n * 0.12);
    });
    canvas.style.setProperty("opacity", String(state.sceneOpacity));
  }

  /* ---- render-on-demand: gsap.ticker is already running for Lenis ---- */
  window.gsap.ticker.add(() => {
    if (!needsRender || state.sceneOpacity <= 0.001) return;
    needsRender = false;
    applyState();
    animateSteam(cupParts.steam);
    renderer.render(scene, camera);
  });

  /* ---- choreography: every tween just mutates `state` ---- */
  for (const c of CHOREOGRAPHY) {
    if (c.trigger === null) {
      window.gsap.to(state, {
        ...c.to,
        duration: c.duration,
        delay: 3.2, // after the preloader venetian split
        ease: "power2.out",
        onUpdate: invalidate,
      });
    } else {
      window.gsap.to(state, {
        ...c.to,
        ease: "none",
        immediateRender: false,
        onUpdate: invalidate,
        scrollTrigger: {
          trigger: c.trigger,
          start: c.start,
          end: c.end,
          scrub: c.scrub,
        },
      });
    }
  }

  /* mouse parallax (desktop only), ±0.03 rad / ±0.01 units */
  if (tier === "desktop") {
    window.addEventListener("pointermove", (e) => {
      parallax.x = (e.clientX / innerWidth - 0.5) * -0.06;
      parallax.y = (e.clientY / innerHeight - 0.5) * -0.02;
      invalidate();
    });
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  window.addEventListener("resize", resize);
  resize();

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    downgrade("WebGL context lost");
  });

  let steamT = 0;
  function animateSteam(steam) {
    if (state.steam <= 0.01) return;
    steamT += 0.016;
    steam.forEach((s, n) => {
      s.position.y = s.userData.baseY + ((steamT * 0.02 + n * 0.04) % 0.12);
      s.rotation.y = Math.sin(steamT * 0.7 + n) * 0.2;
    });
    needsRender = true; // steam is a continuous loop while visible
  }
}

/* Placeholder KOOB cup from a lathe profile — same object names and
   pivots as the real GLB so Task 9 is a drop-in swap. */
function buildPlaceholderCup() {
  const group = new THREE.Group();
  const pts = [];
  const profile = [
    [0.0, 0.004], [0.024, 0.004], [0.03, 0.006], [0.033, 0.012],
    [0.036, 0.03], [0.038, 0.055], [0.04, 0.078], [0.041, 0.088],
  ];
  for (const [x, y] of profile) pts.push(new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 48),
    new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.32, side: THREE.DoubleSide })
  );
  cup.name = "Cup";
  const saucer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.05, 0.008, 48),
    cup.material.clone()
  );
  saucer.name = "Saucer";
  saucer.position.y = -0.004;
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.03, 0.06, 40),
    new THREE.MeshStandardMaterial({ color: 0x3c2414, roughness: 0.15 })
  );
  liquid.name = "Liquid";
  liquid.geometry.translate(0, 0.03, 0); // pivot at base → scale.y fills upward
  liquid.position.y = 0.012;
  const steam = [];
  for (let n = 0; n < 3; n++) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.14),
      new THREE.MeshBasicMaterial({
        color: 0xf5f0e8, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
    s.name = `Steam${n + 1}`;
    s.position.set((n - 1) * 0.018, 0.16, 0);
    s.userData.baseY = 0.16;
    steam.push(s);
    group.add(s);
  }
  group.add(cup, saucer, liquid);
  group.position.y = -0.05;
  return { group, cup, saucer, liquid, steam };
}
```

- [ ] **Step 6: Playwright screenshot harness**

Run: `npm install --save-dev playwright && npx playwright install chromium`

Create `tools/shot.mjs`:

```js
/* Screenshot the site at given scroll offsets, capturing console errors.
   Usage: node tools/shot.mjs [url] [comma-separated scrollY list] [--mobile] */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:8123/";
const scrolls = (process.argv[3] ?? "0").split(",").map(Number);
const mobile = process.argv.includes("--mobile");
mkdirSync("shots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
});
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(5000); // preloader + boot tween
for (const y of scrolls) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(1500); // let scrub catch up
  const tag = mobile ? `m${y}` : `d${y}`;
  await page.screenshot({ path: `shots/shot-${tag}.png` });
  console.log(`shots/shot-${tag}.png`);
}
console.log("has-3d:", await page.evaluate(() =>
  document.documentElement.classList.contains("has-3d")));
console.log("tier:", await page.evaluate(() => window.__koob3d?.tier));
if (errors.length) { console.error("CONSOLE ERRORS:\n" + errors.join("\n")); process.exit(1); }
await browser.close();
```

- [ ] **Step 7: Verify in the browser**

```bash
npm run serve &   # http://localhost:8123
node tools/shot.mjs http://localhost:8123/ 0,1200,3000,6000,9000,12000
```

Expected: exit code 0 (no console errors), `has-3d: true`, `tier: desktop`. Read each `shots/shot-d*.png` and confirm: placeholder cream cup visible in hero (right of headline, legacy video hidden); liquid rises as hero scrolls; cup drifts left + shrinks at story; cup centered + rotated in collection with orbit images hidden but labels/pips intact; canvas faded out over menu (sand section unobstructed); cup back with steam at features. Fix and re-shoot until all hold.

- [ ] **Step 8: Verify tests still pass and legacy fallback intact**

```bash
npm test
```

Then force-fallback check — temporarily block WebGL:

```bash
node -e '
import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2"] });
  const p = await b.newPage();
  await p.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  await p.waitForTimeout(5000);
  console.log("has-3d (should be false):",
    await p.evaluate(() => document.documentElement.classList.contains("has-3d")));
  await p.screenshot({ path: "shots/fallback.png" });
  await b.close();
});'
```

Expected: `has-3d (should be false): false`; `shots/fallback.png` shows today's site (video cup, 2D beans).

- [ ] **Step 9: Commit**

```bash
git add index.html js/koob3d.js tools/shot.mjs package.json package-lock.json
git commit -m "feat(3d): persistent WebGL scene with placeholder cup + full scroll choreography

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Blender — model the signature KOOB cup (geometry)

**Files:**
- Produce (Blender-side): objects `Cup`, `Saucer` in the MCP-connected Blender scene; scene saved to `assets/models/src/koob-scene.blend`

**Interfaces:**
- Produces: Blender objects named exactly `Cup`, `Saucer` (meters; cup ≈ 9 cm tall, sitting on saucer at z=0) — consumed by Tasks 5–8.
- Tools: `mcp__blender__execute_blender_code`, `mcp__blender__get_viewport_screenshot`, `mcp__blender__get_object_info`.

- [ ] **Step 1: Path sanity + reference review**

Read the brand references first: `Read Cup.png` and `Read CupCoffee.png` (repo root) — note proportions, rim, handle shape. Then in Blender:

```python
import sys, os
print(sys.platform)  # expect "win32" → use C:/ paths below
print(os.path.exists("C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2"))
```

Expected: `win32` / `True`. If platform is `linux`, substitute `/mnt/c/...` in every later path. Set once:

```python
PROJECT = "C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2"
os.makedirs(PROJECT + "/assets/models/src", exist_ok=True)
```

- [ ] **Step 2: Clean scene, lathe the cup body**

```python
import bpy, math
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

profile = [  # (radius, height) traced from Cup.png — tune after screenshot
    (0.000, 0.004), (0.024, 0.004), (0.030, 0.006), (0.033, 0.012),
    (0.036, 0.030), (0.038, 0.055), (0.040, 0.078), (0.041, 0.088),
]
mesh = bpy.data.meshes.new("CupMesh")
obj = bpy.data.objects.new("Cup", mesh)
bpy.context.collection.objects.link(obj)
verts = [(x, 0, z) for x, z in profile]
mesh.from_pydata(verts, [(i, i + 1) for i in range(len(verts) - 1)], [])
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.spin(steps=48, angle=math.tau, axis=(0, 0, 1), center=(0, 0, 0))
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode="OBJECT")
solid = obj.modifiers.new("Solidify", "SOLIDIFY"); solid.thickness = 0.004
sub = obj.modifiers.new("Subsurf", "SUBSURF"); sub.levels = 2; sub.render_levels = 2
bpy.ops.object.shade_smooth()
```

- [ ] **Step 3: Handle + saucer**

```python
import bpy, math
bpy.ops.mesh.primitive_torus_add(
    major_radius=0.022, minor_radius=0.0055,
    location=(0.052, 0, 0.05), rotation=(math.radians(90), 0, 0),
    major_segments=32, minor_segments=16)
handle = bpy.context.active_object
handle.name = "Handle"
cup = bpy.data.objects["Cup"]
handle.select_set(True); cup.select_set(True)
bpy.context.view_layer.objects.active = cup
bpy.ops.object.join()  # handle becomes part of Cup

saucer_profile = [(0.000, 0.000), (0.050, 0.000), (0.070, 0.008), (0.075, 0.012)]
mesh = bpy.data.meshes.new("SaucerMesh")
sc = bpy.data.objects.new("Saucer", mesh)
bpy.context.collection.objects.link(sc)
verts = [(x, 0, z) for x, z in saucer_profile]
mesh.from_pydata(verts, [(i, i + 1) for i in range(len(verts) - 1)], [])
bpy.context.view_layer.objects.active = sc
bpy.ops.object.select_all(action="DESELECT"); sc.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.spin(steps=48, angle=math.tau, axis=(0, 0, 1), center=(0, 0, 0))
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode="OBJECT")
sc.modifiers.new("Subsurf", "SUBSURF").levels = 2
bpy.ops.object.shade_smooth()
cup.location.z = 0.012  # cup sits in the saucer well
```

- [ ] **Step 4: Verify silhouette against reference**

Call `mcp__blender__get_viewport_screenshot` and compare with `Cup.png`. Iterate on the `profile` lists (Step 2/3) until the silhouette matches the brand renders: straight-ish espresso cup with slight outward flare, chunky handle, wide shallow saucer. Check counts:

```python
import bpy
for name in ("Cup", "Saucer"):
    o = bpy.data.objects[name]
    print(name, len(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.polygons))
```

Expected: Cup ≤ ~60k tris evaluated, Saucer ≤ ~20k. (Desktop budget headroom.)

- [ ] **Step 5: Save the .blend**

```python
import bpy
bpy.ops.wm.save_as_mainfile(filepath=PROJECT + "/assets/models/src/koob-scene.blend")
```

Then in WSL: `ls -la assets/models/src/` → `koob-scene.blend` exists. No git commit yet (committed with materials in Task 6).

---

### Task 5: Blender — liquid + steam objects

**Files:**
- Produce (Blender-side): objects `Liquid`, `Steam1`, `Steam2`, `Steam3` in the scene; `assets/models/src/steam.png`
- Create: `tools/make_steam_texture.py`

**Interfaces:**
- Produces: `Liquid` with its origin at the liquid base (so `scale.z` in Blender / `scale.y` in three.js fills upward, matching Task 3's `applyState`); `Steam1..3` planes UV-mapped to `steam.png`.

- [ ] **Step 1: Steam wisp texture (WSL, Pillow)**

Create `tools/make_steam_texture.py`:

```python
"""Generate a soft vertical steam-wisp RGBA texture for the 3D cup."""
import math, random
from PIL import Image, ImageDraw, ImageFilter

W, H = 256, 512
img = Image.new("RGBA", (W, H), (245, 240, 232, 0))
d = ImageDraw.Draw(img)
random.seed(7)
for stroke in range(3):
    x = W * (0.35 + 0.15 * stroke)
    pts = []
    for i in range(40):
        t = i / 39
        pts.append((x + math.sin(t * math.pi * 2.2 + stroke * 2) * W * 0.12 * (0.4 + t),
                    H * (1 - t)))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        alpha = int(150 * (1 - abs(0.5 - y0 / H) * 1.6))
        if alpha > 0:
            d.line([(x0, y0), (x1, y1)], fill=(245, 240, 232, alpha),
                   width=int(10 + 26 * (1 - y0 / H)))
img = img.filter(ImageFilter.GaussianBlur(9))
img.save("assets/models/src/steam.png")
print("wrote assets/models/src/steam.png")
```

Run: `python3 tools/make_steam_texture.py` then `Read assets/models/src/steam.png` — expect a soft, blurred vertical wisp fading at top/bottom.

- [ ] **Step 2: Liquid mesh in Blender**

```python
import bpy
bpy.ops.mesh.primitive_cylinder_add(radius=0.0335, depth=0.058, vertices=48,
                                    location=(0, 0, 0.012 + 0.008 + 0.029))
liq = bpy.context.active_object
liq.name = "Liquid"
# subtle meniscus: inset+raise the top rim later if time allows — flat top is fine
bpy.context.scene.cursor.location = (0, 0, 0.012 + 0.008)  # liquid base height
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
bpy.ops.object.shade_smooth()
```

- [ ] **Step 3: Steam planes**

```python
import bpy
PROJECT = "C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2"
img = bpy.data.images.load(PROJECT + "/assets/models/src/steam.png")
for n in range(3):
    bpy.ops.mesh.primitive_plane_add(size=1, location=((n - 1) * 0.018, 0, 0.16))
    p = bpy.context.active_object
    p.name = f"Steam{n + 1}"
    p.scale = (0.05, 0.14, 1)
    p.rotation_euler = (1.5708, 0, 0)  # face the camera axis
    bpy.ops.object.transform_apply(scale=True, rotation=True)
mat = bpy.data.materials.new("SteamWisp")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = img
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
mat.blend_method = "BLEND"
for n in range(3):
    bpy.data.objects[f"Steam{n + 1}"].data.materials.append(mat)
```

- [ ] **Step 4: Verify + save**

`mcp__blender__get_viewport_screenshot` → liquid cylinder sits inside the cup (not poking through walls); three steam planes hover above the rim. Then save (`bpy.ops.wm.save_mainfile()`), commit the WSL-side file:

```bash
git add tools/make_steam_texture.py assets/models/src/steam.png
git commit -m "feat(3d): steam texture generator + liquid/steam scene objects

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Blender — materials + ceramic detail bake

**Files:**
- Produce (Blender-side): materials `Ceramic` (baked 2048px color+roughness+normal), `GoldRim`, `Espresso`; updated `koob-scene.blend`

**Interfaces:**
- Produces: material names per the Global Constraints contract; `Cup` UV-unwrapped with the gold rim as a separate material slot (top band), everything image-textured or plain-value so glTF export is lossless.

- [ ] **Step 1: Assign base materials**

```python
import bpy

def principled(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m

hexc = lambda h: tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
ceramic = principled("Ceramic", hexc("f5f0e8"), 0.32)
gold = principled("GoldRim", hexc("c8a96e"), 0.25, metal=1.0)
espresso = principled("Espresso", hexc("3c2414"), 0.12)

cup = bpy.data.objects["Cup"]
cup.data.materials.clear()
cup.data.materials.append(ceramic)   # slot 0
cup.data.materials.append(gold)      # slot 1
bpy.data.objects["Saucer"].data.materials.append(ceramic)
bpy.data.objects["Liquid"].data.materials.append(espresso)

# gold rim: faces near the top edge get slot 1
import bmesh
bm = bmesh.new(); bm.from_mesh(cup.data)
for f in bm.faces:
    if all(v.co.z > 0.083 for v in f.verts):
        f.material_index = 1
bm.to_mesh(cup.data); bm.free()
```

Screenshot-verify: cream cup, thin gold band at the rim, dark liquid.

- [ ] **Step 2: Ceramic micro-detail (procedural, to be baked)**

Add subtle noise-driven bump + tonal variation to `Ceramic`'s node tree (Noise Texture scale ≈ 180, Bump strength ≈ 0.04 into Normal; second Noise ≈ 12 mixed 4% into Base Color). Keep values gentle — matte artisan ceramic, not stone.

```python
import bpy
m = bpy.data.materials["Ceramic"]; nt = m.node_tree
b = nt.nodes["Principled BSDF"]
n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 180
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.04
nt.links.new(n1.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
```

- [ ] **Step 3: UV unwrap + bake Ceramic to textures**

```python
import bpy
for name in ("Cup", "Saucer"):
    o = bpy.data.objects[name]
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
```

Bake (Cycles) base color / roughness / normal at 2048 into images `ceramic_col`, `ceramic_rgh`, `ceramic_nrm`; rewire `Ceramic` to use the baked images instead of procedural nodes (glTF only exports image textures). Use `bpy.context.scene.render.engine = "CYCLES"`, `bpy.ops.object.bake(type=...)` per map with an active unconnected Image Texture node selected. If MCP execution times out, split into one call per map.

- [ ] **Step 4: Verify + save + commit**

Screenshot in Material Preview (`bpy.context.screen` areas → set shading to `MATERIAL`). Confirm bake didn't wash out the rim/handle. Save `.blend`. Commit:

```bash
git add assets/models/src/koob-scene.blend
git commit -m "feat(3d): cup materials + ceramic detail bake

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If the .blend exceeds ~80 MB, run `File > Clean Up > Purge` via `bpy.ops.outliner.orphans_purge(do_recursive=True)` before saving; if still huge, commit only on Task 8 with textures packed.)

---

### Task 7: Sketchfab props — bean, portafilter, glass

**Files:**
- Produce (Blender-side): objects `Bean`, `Portafilter`, `Glass` re-materialed to the palette
- Create: `assets/models/ATTRIBUTION.md`

**Interfaces:**
- Produces: three prop objects, real-world metric scale (bean ≈ 12 mm, portafilter ≈ 25 cm, glass ≈ 15 cm), origins at their visual centers — consumed by Task 8 export and Task 9 instancing (`Bean` becomes an `InstancedMesh` source).
- Tools: `mcp__blender__search_sketchfab_models(query, downloadable=True)`, `mcp__blender__get_sketchfab_model_preview`, `mcp__blender__download_sketchfab_model(uid)`. Fallback if nothing suitable: `mcp__blender__generate_hyper3d_model_via_text`.

- [ ] **Step 1: Coffee bean** — search `"coffee bean"` (downloadable). Preview candidates; pick a single high-detail bean (CC0/CC-BY). Download, rename the root mesh to `Bean`, scale to ~0.012 m long, apply transforms, give it a simple Principled material (base `#5a3a22`, roughness 0.45 — no texture needed at its screen size, or keep its albedo if good). Delete any extra scene junk the import brought.
- [ ] **Step 2: Portafilter** — search `"portafilter"` / `"espresso portafilter"`. Rename root to `Portafilter`, ~0.25 m, re-material: handle near-black (`#111411`, rough 0.5), basket brushed steel (metallic 0.9, rough 0.35), subtle gold accent ring if the mesh has one.
- [ ] **Step 3: Tall glass** — search `"highball glass"` / `"tall drinking glass"`. Rename root to `Glass`, ~0.15 m. Material: glass-like Principled (transmission 1.0, rough 0.05, IOR 1.45). Note: three.js renders transmission via `MeshPhysicalMaterial` from the glTF `KHR_materials_transmission` extension — Blender's exporter writes it automatically from the Transmission input.
- [ ] **Step 4: Record licenses** — create `assets/models/ATTRIBUTION.md`:

```markdown
# 3D Model Attribution

| Object | Source model | Author | License | URL |
|---|---|---|---|---|
| Bean | <model title> | <author> | <CC0/CC-BY> | <sketchfab url> |
| Portafilter | ... | ... | ... | ... |
| Glass | ... | ... | ... | ... |

Cup, Saucer, Liquid, Steam: original work, created in Blender for KOOB.
```

If any pick is CC-BY, ALSO add a visible credit line to the footer bottom strip in `index.html` (search anchor: `© 2025 KOOB` / the `footer-bottom` element): append a `<span>` like `3D models: <author> (CC-BY)`.

- [ ] **Step 5: Verify + save + commit** — screenshot: all three props laid out beside the cup, palette-consistent. Poly check (same snippet as Task 4 Step 4): each prop ≤ 40k tris; decimate in place if over. Save `.blend`. Commit `ATTRIBUTION.md` (+ `index.html` if credit added):

```bash
git add assets/models/ATTRIBUTION.md
git commit -m "feat(3d): sketchfab props imported, re-materialed, attributed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Export pipeline — two GLB tiers, compressed, budget-checked

**Files:**
- Create: `assets/models/cup-desktop.glb`, `cup-mobile.glb`, `props-desktop.glb`, `props-mobile.glb`
- Create: `assets/models/src/*-raw.glb` (uncompressed intermediates)

**Interfaces:**
- Produces: the four GLBs with the exact object/material names from Global Constraints — consumed by Task 9's GLTFLoader. `Liquid` must export with its base-pivot origin intact (no "apply transform on export" surprises — verify in Step 4).

- [ ] **Step 1: Export desktop-tier raw GLBs from Blender**

```python
import bpy
PROJECT = "C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2"

def export(names, path):
    bpy.ops.object.select_all(action="DESELECT")
    for n in names:
        bpy.data.objects[n].select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True)

export(["Cup", "Saucer", "Liquid", "Steam1", "Steam2", "Steam3"],
       PROJECT + "/assets/models/src/cup-desktop-raw.glb")
export(["Bean", "Portafilter", "Glass"],
       PROJECT + "/assets/models/src/props-desktop-raw.glb")
```

`export_apply=True` applies modifiers (subsurf) but NOT object transforms' pivots — origins survive. Verify `Liquid`'s pivot in Step 4.

- [ ] **Step 2: Mobile tier — decimate copies, re-export**

```python
import bpy
PROJECT = "C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2"
mobile_names = []
for n in ["Cup", "Saucer", "Liquid", "Steam1", "Steam2", "Steam3",
          "Bean", "Portafilter", "Glass"]:
    src = bpy.data.objects[n]
    dup = src.copy(); dup.data = src.data.copy()
    dup.name = n + "_M"
    bpy.context.collection.objects.link(dup)
    for m in list(dup.modifiers):           # drop subsurf on mobile
        if m.type == "SUBSURF": dup.modifiers.remove(m)
    if n not in ("Steam1", "Steam2", "Steam3"):
        dec = dup.modifiers.new("Dec", "DECIMATE"); dec.ratio = 0.25
    mobile_names.append(dup.name)
# temporarily rename so the GLB node names match the contract
for dn in mobile_names:
    orig = bpy.data.objects[dn[:-2]]; orig.name = dn[:-2] + "_HOLD"
    bpy.data.objects[dn].name = dn[:-2]
# ... export the two mobile raw GLBs (same export() calls, *-mobile-raw.glb) ...
# then restore names: delete the mobile copies, strip _HOLD suffixes
```

(Chunk this across multiple `execute_blender_code` calls: duplicate+decimate, rename, export cup, export props, restore. Verify names restored with `get_scene_info` at the end.)

- [ ] **Step 3: Compress in WSL with gltf-transform**

Try KTX2 first (one attempt): download the latest KTX-Software Linux `.deb` from github.com/KhronosGroup/KTX-Software/releases, `sudo dpkg -i`, confirm `toktx --version`. If that works:

```bash
for f in cup-desktop props-desktop; do
  npx --yes @gltf-transform/cli@4 optimize assets/models/src/$f-raw.glb assets/models/$f.glb \
    --compress draco --texture-compress ktx2 --texture-size 2048;
done
for f in cup-mobile props-mobile; do
  npx --yes @gltf-transform/cli@4 optimize assets/models/src/$f-raw.glb assets/models/$f.glb \
    --compress draco --texture-compress ktx2 --texture-size 1024;
done
```

If `toktx` install fails: same commands with `--texture-compress webp` (accepted deviation per Global Constraints; note it in the commit message).

- [ ] **Step 4: Budget + contract check**

```bash
du -b assets/models/*.glb
npx --yes @gltf-transform/cli@4 inspect assets/models/cup-desktop.glb
```

Expected: cup-desktop + props-desktop ≤ 5,242,880 bytes combined; cup-mobile + props-mobile ≤ 1,572,864 combined. `inspect` output lists meshes named `Cup, Saucer, Liquid, Steam1..3` (cup file) / `Bean, Portafilter, Glass` (props file). If over budget: reduce `--texture-size`, raise decimation, re-run. If names are wrong, fix in Blender and re-export — do NOT rename post-hoc in the GLB.

Also verify the Liquid pivot survived: `npx @gltf-transform/cli@4 inspect` shows Liquid's translation ≈ its base height (z≈0.02 exported as y≈0.02 with yup), not 0,0,0-centered-in-mesh.

- [ ] **Step 5: Commit**

```bash
git add assets/models/
git commit -m "feat(3d): export two-tier draco GLBs within budget

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Runtime — load real GLBs, wire liquid/steam/roast/props

**Files:**
- Modify: `js/koob3d.js`

**Interfaces:**
- Consumes: GLB name contract (Task 8), `modelUrls(tier)` (Task 1), `ROASTS` (Task 2).
- Produces: `window.__koob3d.assets = {cup, props}` for verification; bean `InstancedMesh` (30 desktop / 12 mobile).

- [ ] **Step 1: Add loaders and replace the placeholder**

In `js/koob3d.js`, add imports:

```js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
```

Inside `boot()`, replace the `buildPlaceholderCup()` usage with async loading (keep `buildPlaceholderCup` in the file as the instant stand-in while GLBs stream in — swap when ready):

```js
  const urls = modelUrls(tier);
  const draco = new DRACOLoader().setDecoderPath(
    "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
  const ktx2 = new KTX2Loader().setTranscoderPath(
    "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/")
    .detectSupport(renderer);
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);

  Promise.all([loader.loadAsync(urls.cup), loader.loadAsync(urls.props)])
    .then(([cupGltf, propsGltf]) => {
      rig.remove(cupParts.group);
      cupParts = adoptCupGltf(cupGltf, rig);
      propParts = adoptPropsGltf(propsGltf, scene, tier);
      window.__koob3d.assets = { cup: urls.cup, props: urls.props };
      invalidate();
    })
    .catch((err) => downgrade(err));
```

(`cupParts`/`propParts` become `let` bindings. `applyState` reads whatever `cupParts` currently points at, so the swap is seamless.)

- [ ] **Step 2: adoptCupGltf — bind by the name contract**

```js
function adoptCupGltf(gltf, rig) {
  const g = gltf.scene;
  const find = (n) => {
    const o = g.getObjectByName(n);
    if (!o) throw new Error(`GLB missing object ${n}`);
    return o;
  };
  const parts = {
    group: g,
    cup: find("Cup"),
    saucer: find("Saucer"),
    liquid: find("Liquid"),
    steam: [find("Steam1"), find("Steam2"), find("Steam3")],
  };
  parts.steam.forEach((s) => {
    s.material.transparent = true;
    s.material.depthWrite = false;
    s.material.opacity = 0;
    s.userData.baseY = s.position.y;
  });
  parts.liquid.material = new THREE.MeshStandardMaterial({
    color: 0x3c2414, roughness: 0.12,
  });
  g.position.y = -0.05;
  rig.add(g);
  return parts;
}
```

- [ ] **Step 3: adoptPropsGltf — bean instancing + drifting props**

```js
function adoptPropsGltf(gltf, scene, tier) {
  const src = gltf.scene;
  const bean = src.getObjectByName("Bean");
  const portafilter = src.getObjectByName("Portafilter");
  const glass = src.getObjectByName("Glass");
  const count = tier === "mobile" ? 12 : 30;
  const beans = new THREE.InstancedMesh(bean.geometry, bean.material, count);
  const seeds = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
        p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    seeds.push({
      x: (Math.random() - 0.5) * 0.9, y: (Math.random() - 0.5) * 0.5,
      z: -0.15 - Math.random() * 0.25, spin: Math.random() * 6.28,
      speed: 0.1 + Math.random() * 0.25,
    });
  }
  beans.visible = false;
  glass.visible = false;
  portafilter.visible = false;         // reserved for a future story moment
  glass.position.set(0.28, -0.1, -0.1);
  scene.add(beans, glass, portafilter);
  return { beans, seeds, glass, portafilter, m, q, p, s };
}
```

And extend `applyState` (after the roast block):

```js
    if (propParts) {
      propParts.beans.visible = state.beans > 0.01;
      propParts.glass.visible = state.glass > 0.01;
      if (propParts.glass.material) {
        propParts.glass.material.opacity = state.glass;
        propParts.glass.material.transparent = true;
      }
    }
```

And a bean-drift block inside the ticker (like `animateSteam`, continuous while `state.beans > 0.01`): advance each seed's `spin += speed * 0.016`, set instance matrices from seed position + rotation, `beans.instanceMatrix.needsUpdate = true`, `needsRender = true`.

- [ ] **Step 4: Verify against real assets**

```bash
npm test    # core untouched, still green
npm run serve &
node tools/shot.mjs http://localhost:8123/ 0,1200,3000,6000,9000,12000
node tools/shot.mjs http://localhost:8123/ 0,1200,3000 --mobile
```

Expected: no console errors; `window.__koob3d.assets` populated (add a `console.log` check via shot.mjs output if needed). Read the screenshots: the REAL ceramic cup (gold rim, baked detail) replaces the lathe placeholder; espresso fills on hero scroll; roast color shifts across collection slides; real beans drift in story; glass appears during featured. Mobile shots show the same journey (smaller assets, `tier: mobile`).

- [ ] **Step 5: Commit**

```bash
git add js/koob3d.js
git commit -m "feat(3d): load tiered GLBs — real cup, bean instancing, roast lerp

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Waypoint polish — gold particle burst + collection sync

**Files:**
- Modify: `js/koob3d.js`
- Modify: `js/koob3d-core.js` + `tools/test/koob3d-core.test.mjs` (one new export)

**Interfaces:**
- Produces: `WAYPOINTS` export in core (`[{id, trigger, start, effect}]`, effect ∈ `"goldBurst"`); one-shot GPU particle burst in runtime.

- [ ] **Step 1: TDD the waypoint data** — test: ids unique, triggers in SECTION_IDS ∪ `["#newsletter"]`, effect is a known string. Implementation in core:

```js
export const WAYPOINTS = [
  { id: "cupFull", trigger: "#hero", start: "bottom 25%", effect: "goldBurst" },
  { id: "quizEnter", trigger: "#quiz", start: "top 60%", effect: "goldBurst" },
];
```

Run `npm test` (fail → implement → pass).

- [ ] **Step 2: Gold burst in runtime** — a 60-point `THREE.Points` cloud (gold `#c8a96e`, additive blending, size attenuation) parked invisible at the cup rim; on waypoint `ScrollTrigger.create({ trigger, start, onEnter })`, reset particle positions to the rim and tween them radially outward over 0.9 s (gsap.to on a `progress` uniform or per-frame update), fading opacity 1→0, then hide. Wire one `ScrollTrigger.create` per `WAYPOINTS` entry.
- [ ] **Step 3: Verify** — `node tools/shot.mjs http://localhost:8123/ 1600,10800` right after the hero-fill and quiz-enter waypoints; burst visible in at least one frame (re-run with tweaked scroll offsets if the 1.5 s settle misses the 0.9 s burst — take two screenshots 300 ms apart by adding a scroll value twice).
- [ ] **Step 4: Commit**

```bash
git add js/koob3d.js js/koob3d-core.js tools/test/koob3d-core.test.mjs
git commit -m "feat(3d): gold particle burst waypoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Performance hardening

**Files:**
- Modify: `js/koob3d.js`

**Interfaces:**
- Consumes: existing `needsRender` flag; produces no new API.

- [ ] **Step 1: Hard render pause** — the ticker already skips when `sceneOpacity <= 0.001`; additionally set `renderer.setAnimationLoop(null)`-equivalent discipline: when paused for > 2 s, also skip `applyState` (early-return before it). Verify by logging: scrolled deep into `#menu`, DevTools performance shows ~0 GPU work (via shot.mjs: `page.evaluate(() => { let c = 0; const orig = window.__koob3d.renderer.render; ... })` — simpler: add `window.__koob3d.frames` counter incremented per render; assert it stops growing while parked in menu).
- [ ] **Step 2: Tab visibility** — `document.addEventListener("visibilitychange")` → suspend gsap ticker callback while hidden (`gsap.ticker.remove/add`).
- [ ] **Step 3: DPR clamp under load** — if frame time (measured over a rolling 60-frame window while rendering) exceeds 24 ms, drop `renderer.setPixelRatio(1)` once and log it.
- [ ] **Step 4: Verify + commit** — `npm test`, re-run both shot.mjs sweeps clean, then:

```bash
git add js/koob3d.js
git commit -m "perf(3d): render pause, visibility suspend, adaptive DPR

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Full verification sweep + docs

**Files:**
- Modify: `MEDIA_GENERATION.md` (append a "3D pipeline" section)
- No code changes expected; fixes loop back into the relevant task's files.

- [ ] **Step 1: Test suite** — `npm test` → all green.
- [ ] **Step 2: Desktop journey** — `node tools/shot.mjs http://localhost:8123/ 0,800,1600,3000,4500,6000,7500,9000,10500,12000,14000` → zero console errors; visually confirm every choreography row from the spec table (hero fill → story drift+beans → collection turntable+roasts → menu clean exit → featured glass → features return+steam → outro fade).
- [ ] **Step 3: Mobile journey** — same with `--mobile`; confirm `tier: mobile`.
- [ ] **Step 4: Fallback matrix** — (a) `--disable-webgl` run: `has-3d` false, legacy video + 2D beans work (Task 3 Step 8 script); (b) reduced motion: launch with `page.emulateMedia({ reducedMotion: "reduce" })` before goto in a one-off script → `has-3d` false.
- [ ] **Step 5: Lighthouse** — `npx --yes lighthouse http://localhost:8123/ --only-categories=performance --chrome-flags="--headless" --output=json --output-path=shots/lh.json` then compare LCP/CLS against a baseline run with `has-3d` manually disabled (`?no3d` — add a 2-line URL-param opt-out to the head gate: `if (!location.search.includes("no3d"))` wrap). LCP must not regress > 10%; CLS stays ≈ 0 (canvas is fixed/pointer-events none, so any regression means a layout bug).
- [ ] **Step 6: Document** — append to `MEDIA_GENERATION.md`: the 3D asset pipeline (blend file location, export task commands, gltf-transform commands, budgets, name contract) so future asset swaps don't require re-discovery.
- [ ] **Step 7: Final commit**

```bash
git add MEDIA_GENERATION.md index.html
git commit -m "feat(3d): verification sweep, no3d opt-out, pipeline docs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
