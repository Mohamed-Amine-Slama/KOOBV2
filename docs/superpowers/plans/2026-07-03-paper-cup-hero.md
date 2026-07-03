# KOOB Paper Cup + 3-Cup Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ceramic cup+saucer 3D model with the shop's branded paper cup (kraft body, separate black lid, dark circle sticker with the cream KOOB logo) and rework the hero into a 3-cup trio where the middle cup's lid lifts off and it fills with coffee on scroll.

**Architecture:** The cup is remodeled in `koob-scene.blend` via Blender MCP and shipped through the existing two-tier GLB pipeline (raw export → gltf-transform Draco+KTX2). The runtime keeps its data-driven shape: two new state scalars (`lidLift`, `sideCups`) are tweened by `CHOREOGRAPHY` scrub entries and mapped to the scene in `applyState()`. The two side cups are runtime clones of the loaded cup+lid — one model, three instances.

**Tech Stack:** Blender 4.x (via MCP `execute_blender_code`), Python/Pillow (texture authoring), `@gltf-transform/cli@4`, three.js 0.170 (GLTFLoader/DRACOLoader/KTX2Loader), GSAP ScrollTrigger, `node --test`.

**Spec:** `docs/superpowers/specs/2026-07-03-paper-cup-hero-design.md`

## Global Constraints

- **Cup GLB object-name contract (exact, case-sensitive):** `Cup`, `Lid`, `Liquid`, `Steam1`, `Steam2`, `Steam3` — **no `Saucer`**. `adoptCupGltf` throws on any missing name (throw → `downgrade()` is the intended failure path).
- **Budgets (hard):** desktop GLBs ≤ 5 MB total, mobile ≤ 1.5 MB. Texture caps 2048px desktop / 1024px mobile. KTX2 preferred (toktx already on PATH from the previous milestone), WebP acceptable fallback.
- **Palette:** gold `#c8a96e`, cream `#f5f0e8`, forest `#0d3b2e`, teal `#1a6b52`, void `#040d08`. New this feature: kraft `#d3c3ab`, sticker `#101e19`, lid `#141414`, logo cream `#efe3cf`.
- **Blender runs on the Windows host.** Python passed to `mcp__blender__execute_blender_code` must use `C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2/...` paths. Shell commands run in WSL and see the same files at `/mnt/c/...`.
- **Work in place on branch `3d-journey`** — no worktree (Blender export paths point into this checkout).
- **The working tree contains unrelated user changes** (staged image deletions, modified `portal.glb`, `index.html`, etc.). Every commit must `git add` **explicit paths only** — never `git add -A`/`-u`.
- **`Liquid` must keep its base-origin pivot** (runtime fills via `scale.y`).
- Commits: `feat(3d): ...` / `chore(3d): ...`, ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Every runtime-touching task ends with `npm test` green and a `tools/shot.mjs` run with zero console errors.

---

### Task 1: Core state + choreography (`lidLift`, `sideCups`, hero split)

**Files:**
- Modify: `js/koob3d-core.js:29-39` (INITIAL_STATE), `js/koob3d-core.js:51-79` (CHOREOGRAPHY)
- Test: `tools/test/koob3d-core.test.mjs`

**Interfaces:**
- Consumes: nothing (pure data).
- Produces: `INITIAL_STATE.lidLift: 0`, `INITIAL_STATE.sideCups: 1`; CHOREOGRAPHY entries `heroLid` (`#hero`, `top top` → `40% top`, writes only `lidLift: 1`) and `heroFill` (`#hero`, `40% top` → `bottom top`, the old `hero` targets); `story.to.sideCups: 0`. Task 5's `applyState()` reads both scalars.

- [ ] **Step 1: Write the failing tests**

In `tools/test/koob3d-core.test.mjs`, update the contract key list (line 47) and the normalized-channel list (line 80), and add two tests at the end of the file:

```js
const STATE_KEYS = [
  "cupX", "cupY", "cupZ", "cupRotX", "cupRotY", "cupScale",
  "liquidFill", "steam", "roast", "beans", "glass", "sceneOpacity",
  "portalT", "lidLift", "sideCups",
];
```

```js
    for (const k of ["liquidFill", "steam", "beans", "glass", "sceneOpacity", "portalT", "lidLift", "sideCups"]) {
```

```js
test("hero: lid lifts first, fill takes over at the same scroll point", () => {
  const ids = CHOREOGRAPHY.map((c) => c.id);
  assert.ok(!ids.includes("hero"), "old monolithic hero entry should be gone");
  const lid = CHOREOGRAPHY.find((c) => c.id === "heroLid");
  const fill = CHOREOGRAPHY.find((c) => c.id === "heroFill");
  assert.ok(lid && fill);
  assert.equal(lid.trigger, "#hero");
  assert.equal(fill.trigger, "#hero");
  assert.deepEqual(Object.keys(lid.to), ["lidLift"]);
  assert.equal(lid.to.lidLift, 1);
  assert.equal(lid.end, fill.start); // phase handoff, no gap and no overlap
  assert.equal(fill.to.liquidFill, 1);
  assert.equal(fill.to.steam, 1);
});

test("story fades the hero side cups out", () => {
  const story = CHOREOGRAPHY.find((c) => c.id === "story");
  assert.equal(story.to.sideCups, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `INITIAL_STATE has exactly the contract keys` (missing lidLift/sideCups) and the two new tests (`heroLid`/`heroFill` not found).

- [ ] **Step 3: Update `js/koob3d-core.js`**

In `INITIAL_STATE` (after `beans: 0, glass: 0, sceneOpacity: 0,`):

```js
  // 0 = lid seated on the middle cup, 1 = lifted clear (heroLid scrubs it).
  // sideCups: 1 = hero trio flanks visible, 0 = faded out (story scrubs it).
  lidLift: 0, sideCups: 1,
```

Replace the single `hero` entry (lines 61-62) with:

```js
  /* The hero scrub is two phases with a shared boundary at 40% of the
     section: first the middle cup's lid lifts away, then — only once the cup
     is open — the coffee fills and the steam rises. Splitting entries (rather
     than staggering one tween) keeps every channel single-writer, same rule
     as the steam-scrub-conflict fix above. */
  { id: "heroLid", trigger: "#hero", start: "top top", end: "40% top",
    scrub: 1.2, to: { lidLift: 1 } },
  { id: "heroFill", trigger: "#hero", start: "40% top", end: "bottom top",
    scrub: 1.2, to: { liquidFill: 1, steam: 1, cupRotY: 0.5, cupRotX: -0.16 } },
```

In the `story` entry, add `sideCups: 0`:

```js
  { id: "story", trigger: "#story", start: "top 85%", end: "bottom 40%",
    scrub: 1.2, to: { cupX: -1.15, cupScale: 0.55, beans: 1, roast: 0, sideCups: 0 } },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add js/koob3d-core.js tools/test/koob3d-core.test.mjs
git commit -m "feat(3d): lidLift + sideCups state, hero split into lid-off then fill

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Cup albedo texture generator (kraft + KOOB sticker)

**Files:**
- Create: `tools/make_cup_texture.py`
- Output (committed): `assets/models/src/paper_col.png`, `assets/models/src/logo_cream.png`

**Interfaces:**
- Consumes: `assets/logo 2.pdf_20260703_174119_0000.png` (cream KOOB mark on solid green).
- Produces: `assets/models/src/paper_col.png` — 2048×2048 albedo for the cup's cylindrical UV layout (u = angle around cup, v = 0 at base). Task 3 loads it as the `Paper` material's Base Color. Sticker position is CLI-tunable (`--u`, `--v`, `--radius`) so misalignment found during visual verification is a re-run, not a remodel.

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""Author the paper-cup albedo: kraft base + dark KOOB sticker.

The cup mesh (tools: koob-scene.blend, object "Cup") is unwrapped
cylindrically — u runs around the cup (seam at the back), v runs base→rim.
The sticker is drawn at a tunable u/v so the logo can be re-aimed at the
camera without touching the mesh: re-run with a different --u and re-export.

Usage: python3 tools/make_cup_texture.py [--u 0.25] [--v 0.52] [--radius 430]
Writes: assets/models/src/paper_col.png   (2048x2048 albedo)
        assets/models/src/logo_cream.png  (keyed logo, kept for reuse/debug)
"""
import argparse
import random

from PIL import Image, ImageDraw

LOGO = "assets/logo 2.pdf_20260703_174119_0000.png"
OUT = "assets/models/src/paper_col.png"
LOGO_OUT = "assets/models/src/logo_cream.png"
SIZE = 2048
KRAFT = (211, 195, 171)   # warm kraft beige, sampled from the product photos
STICKER = (16, 30, 25)    # near-black with the brand green cast
CREAM = (239, 227, 207)   # logo cream


def key_logo():
    """Cream mark on solid green -> cream RGBA on transparent."""
    img = Image.open(LOGO).convert("RGB")
    bg = img.getpixel((4, 4))  # background is a solid fill; sample a corner
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    px, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            a = max(0, min(255, (d - 30) * 2))  # soft key, keeps stroke edges
            po[x, y] = (*CREAM, a)
    return out


def kraft_base():
    """Kraft sheet with vertical paper grain and light speckle."""
    img = Image.new("RGB", (SIZE, SIZE), KRAFT)
    px = img.load()
    rnd = random.Random(7)  # seeded: texture is reproducible run to run
    for x in range(SIZE):
        dv = rnd.randint(-4, 4)
        for y in range(SIZE):
            r, g, b = px[x, y]
            px[x, y] = (r + dv, g + dv, b + dv)
    for _ in range(9000):
        x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
        d = rnd.randint(-10, 6)
        r, g, b = px[x, y]
        px[x, y] = (r + d, g + d, b + d)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--u", type=float, default=0.25)
    ap.add_argument("--v", type=float, default=0.52)
    ap.add_argument("--radius", type=int, default=430)
    args = ap.parse_args()

    logo = key_logo()
    logo.save(LOGO_OUT)

    base = kraft_base()
    cx, cy = int(args.u * SIZE), int((1 - args.v) * SIZE)  # v=0 is image bottom
    ImageDraw.Draw(base).ellipse(
        [cx - args.radius, cy - args.radius, cx + args.radius, cy + args.radius],
        fill=STICKER,
    )
    w = int(args.radius * 2 * 0.72)  # logo spans ~72% of the sticker
    h = int(w * logo.height / logo.width)
    lg = logo.resize((w, h), Image.LANCZOS)
    base.paste(lg, (cx - w // 2, cy - h // 2), lg)
    base.save(OUT)

    # self-checks: sticker edge is dark, far corner is still kraft
    assert base.getpixel((cx + int(args.radius * 0.85), cy))[0] < 70
    assert base.getpixel((40, 40))[0] > 180
    print(f"wrote {OUT} ({SIZE}x{SIZE}) sticker u={args.u} v={args.v} r={args.radius}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it and eyeball the output**

Run (repo root, WSL): `python3 tools/make_cup_texture.py`
Expected: `wrote assets/models/src/paper_col.png (2048x2048) sticker u=0.25 v=0.52 r=430` and no assertion error. Open/Read `assets/models/src/paper_col.png` and `logo_cream.png`: kraft field, crisp dark circle, cream KOOB mark with clean edges (no green halo). If the key leaves a halo, raise the `- 30` threshold to `- 45` and re-run.

- [ ] **Step 3: Commit**

```bash
git add tools/make_cup_texture.py assets/models/src/paper_col.png assets/models/src/logo_cream.png
git commit -m "feat(3d): paper-cup albedo generator — kraft base + KOOB sticker

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Blender — model the paper cup, lid, refit liquid + steam

**Files:**
- Modify: `assets/models/src/koob-scene.blend` (via Blender MCP; Blender currently has a default scene open — the first step opens the blend)

**Interfaces:**
- Consumes: `assets/models/src/paper_col.png` (Task 2).
- Produces: blend objects `Cup` (kraft, `Paper` material), `Lid` (black, `LidPlastic`, **origin at the cup-rim contact plane**, object z = 0.102), rebuilt `Liquid` (base-origin, `Espresso` material), `Steam1..3` repositioned to z = 0.13. Dimensions Task 5 relies on: cup height 0.102, top radius ≈ 0.0415, lid adds ≈ 0.0135.

Verify **every step** below with `mcp__blender__get_viewport_screenshot` before moving on.

- [ ] **Step 1: Open the scene and remove the ceramic cup + saucer**

Via `mcp__blender__execute_blender_code`:

```python
import bpy
bpy.ops.wm.open_mainfile(filepath="C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2/assets/models/src/koob-scene.blend")
for name in ("Cup", "Saucer"):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
print(sorted(o.name for o in bpy.data.objects))
```

Expected print includes `Liquid`, `Steam1..3`, `Bean`, `Portafilter`, `Glass`, `Portal*` — no `Cup`/`Saucer`.

- [ ] **Step 2: Build the cup mesh with deterministic cylindrical UVs**

```python
import bpy, bmesh, math

SEG = 96
H_MAX = 0.1035
# base center → out → up the tapered wall → over the rim bead → down the
# inner wall (reads hollow from above; the lid covers the rest)
profile = [
    (0.0, 0.0), (0.024, 0.0), (0.026, 0.0015), (0.028, 0.004),
    (0.0345, 0.052), (0.0400, 0.096), (0.0415, 0.099), (0.0415, 0.102),
    (0.0400, 0.1035), (0.0385, 0.101), (0.0370, 0.094), (0.0330, 0.050),
    (0.0285, 0.010),
]

bm = bmesh.new()
verts = [bm.verts.new((r, 0.0, z)) for (r, z) in profile]
for i in range(len(verts) - 1):
    bm.edges.new((verts[i], verts[i + 1]))
bmesh.ops.spin(bm, geom=list(bm.verts) + list(bm.edges), axis=(0, 0, 1),
               cent=(0, 0, 0), angle=2 * math.pi, steps=SEG, use_merge=True)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

# cylindrical UVs: u = angle (seam at -X), v = height. Faces spanning the
# seam get their low-u loops pushed past 1.0 (texture wraps) to avoid smears.
uv = bm.loops.layers.uv.new("UVMap")
for f in bm.faces:
    loops = []
    for l in f.loops:
        x, y, z = l.vert.co
        u = math.atan2(y, x) / (2 * math.pi) + 0.5
        loops.append((l, u, z))
    umax = max(u for _, u, _ in loops)
    for l, u, z in loops:
        if umax - u > 0.5:
            u += 1.0
        l[uv].uv = (u, z / H_MAX)

mesh = bpy.data.meshes.new("Cup")
bm.to_mesh(mesh)
bm.free()
for p in mesh.polygons:
    p.use_smooth = True
cup = bpy.data.objects.new("Cup", mesh)
bpy.context.scene.collection.objects.link(cup)
print("Cup tris:", sum(len(p.vertices) - 2 for p in mesh.polygons))
```

Expected: `Cup tris:` ≈ 2300 (far under budget — the smooth-shaded spin needs no Subsurf).

- [ ] **Step 3: `Paper` material with the Task 2 albedo**

```python
import bpy
mat = bpy.data.materials.new("Paper")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.65
img = bpy.data.images.load("C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2/assets/models/src/paper_col.png")
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = img
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bpy.data.objects["Cup"].data.materials.append(mat)
```

Screenshot in Material Preview (viewport shading set via code or the existing viewport): kraft cup with the dark sticker visible. If the sticker faces away from the front (-Y) view, re-run Task 2's script with a different `--u` (each 0.25 of u = quarter turn) and `img.reload()`.

- [ ] **Step 4: Build the lid (separate object, origin at the contact plane)**

```python
import bpy, bmesh, math

SEG = 96
# outer clamp band → step → raised sip plateau → center, z=0 is where it
# meets the cup rim so lifting animates from the object origin
profile = [
    (0.0280, 0.0000), (0.0435, 0.0000), (0.0445, 0.0030), (0.0435, 0.0075),
    (0.0360, 0.0075), (0.0330, 0.0040), (0.0300, 0.0110), (0.0180, 0.0130),
    (0.0000, 0.0135),
]
bm = bmesh.new()
verts = [bm.verts.new((r, 0.0, z)) for (r, z) in profile]
for i in range(len(verts) - 1):
    bm.edges.new((verts[i], verts[i + 1]))
bmesh.ops.spin(bm, geom=list(bm.verts) + list(bm.edges), axis=(0, 0, 1),
               cent=(0, 0, 0), angle=2 * math.pi, steps=SEG, use_merge=True)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
mesh = bpy.data.meshes.new("Lid")
bm.to_mesh(mesh)
bm.free()
for p in mesh.polygons:
    p.use_smooth = True
lid = bpy.data.objects.new("Lid", mesh)
lid.location = (0, 0, 0.102)  # seated on the cup rim
bpy.context.scene.collection.objects.link(lid)

mat = bpy.data.materials.new("LidPlastic")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.008, 0.008, 0.008, 1)  # #141414 linear-ish
bsdf.inputs["Roughness"].default_value = 0.35
lid.data.materials.append(mat)
```

- [ ] **Step 5: Rebuild `Liquid` for the paper cup interior, reposition steam**

```python
import bpy, bmesh

old = bpy.data.objects.get("Liquid")
esp = bpy.data.materials.get("Espresso")
if old:
    bpy.data.objects.remove(old, do_unlink=True)

bm = bmesh.new()
# truncated cone fitted inside the wall: base r 0.026 → top r 0.0365, h 0.09,
# origin at the BASE (runtime fills via scale.y — contract)
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=48,
                            radius1=0.026, radius2=0.0365, depth=0.09)
for v in bm.verts:
    v.co.z += 0.045  # cone comes origin-centered; shift so origin = base
mesh = bpy.data.meshes.new("Liquid")
bm.to_mesh(mesh)
bm.free()
for p in mesh.polygons:
    p.use_smooth = True
liquid = bpy.data.objects.new("Liquid", mesh)
liquid.location = (0, 0, 0.006)
bpy.context.scene.collection.objects.link(liquid)
if esp:
    liquid.data.materials.append(esp)

for i in (1, 2, 3):
    s = bpy.data.objects[f"Steam{i}"]
    s.location.z = 0.13  # just above the open rim (cup top is 0.102)
print("rebuilt Liquid, steam at z=0.13")
bpy.ops.wm.save_mainfile()
```

- [ ] **Step 6: Visual gate + commit the blend**

`mcp__blender__get_viewport_screenshot` from a front-ish angle: kraft cup with sticker facing front, black lid seated flush, no gap or intersection at the rim, liquid hidden inside. Fix proportions before continuing if it doesn't match the product photos.

```bash
git add assets/models/src/koob-scene.blend
git commit -m "feat(3d): paper cup + separate lid modeled in koob-scene.blend

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Note: the blend had pre-existing uncommitted modifications from the portal milestone — committing the whole file here is expected and fine on this branch.

---

### Task 4: Export two-tier GLBs, compress, verify contract + budgets

**Files:**
- Create: `assets/models/src/cup-desktop-raw.glb`, `assets/models/src/cup-mobile-raw.glb` (raw, git-ignored)
- Modify: `assets/models/cup-desktop.glb`, `assets/models/cup-mobile.glb` (shipped)

**Interfaces:**
- Consumes: Task 3's blend objects.
- Produces: shipped GLBs whose scene graph contains exactly `Cup`, `Lid`, `Liquid`, `Steam1`, `Steam2`, `Steam3` — what `adoptCupGltf` (Task 5) binds. **The site's 3D will be broken between this commit and Task 5** (old runtime demands `Saucer`) — fine on a feature branch; browser verification happens in Task 5.

- [ ] **Step 1: Export desktop tier** (Blender MCP)

```python
import bpy
bpy.ops.object.select_all(action='DESELECT')
for n in ("Cup", "Lid", "Liquid", "Steam1", "Steam2", "Steam3"):
    o = bpy.data.objects[n]
    o.hide_set(False)
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath="C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2/assets/models/src/cup-desktop-raw.glb",
    use_selection=True, export_yup=True, export_apply=True)
print("desktop raw exported")
```

- [ ] **Step 2: Export mobile tier** (decimated copies under the contract names; steam planes are 2 tris — exported as-is)

```python
import bpy
copies = []
for n in ("Cup", "Lid", "Liquid"):
    src = bpy.data.objects[n]
    dup = src.copy()
    dup.data = src.data.copy()
    bpy.context.scene.collection.objects.link(dup)
    dup.modifiers.new("Dec", "DECIMATE").ratio = 0.25
    src.name = n + "_desk"
    dup.name = n
    copies.append((n, src, dup))
bpy.ops.object.select_all(action='DESELECT')
for n in ("Cup", "Lid", "Liquid", "Steam1", "Steam2", "Steam3"):
    bpy.data.objects[n].select_set(True)
bpy.ops.export_scene.gltf(
    filepath="C:/Users/moham/OneDrive/Desktop/Projects/KOOBV2/assets/models/src/cup-mobile-raw.glb",
    use_selection=True, export_yup=True, export_apply=True)
for n, src, dup in copies:
    bpy.data.objects.remove(dup, do_unlink=True)
    src.name = n
bpy.ops.wm.save_mainfile()
print("mobile raw exported, names restored")
```

- [ ] **Step 3: Compress both tiers** (WSL, repo root)

```bash
npx --yes @gltf-transform/cli@4 optimize assets/models/src/cup-desktop-raw.glb \
  assets/models/cup-desktop.glb --compress draco --texture-compress ktx2 --texture-size 2048
npx --yes @gltf-transform/cli@4 optimize assets/models/src/cup-mobile-raw.glb \
  assets/models/cup-mobile.glb --compress draco --texture-compress ktx2 --texture-size 1024
```

(If `toktx` has dropped off PATH, re-add the KTX-Software bin dir per `MEDIA_GENERATION.md`; WebP fallback `--texture-compress webp` is acceptable if KTX2 is unrecoverable.)

- [ ] **Step 4: Verify contract + budgets**

```bash
npx @gltf-transform/cli@4 inspect assets/models/cup-desktop.glb
ls -la assets/models/cup-desktop.glb assets/models/cup-mobile.glb
```

Expected: node names exactly `Cup`, `Lid`, `Liquid`, `Steam1`, `Steam2`, `Steam3` (spot-check `Liquid`'s translation is its base, z-offset ≈ 0.006); desktop well under 5 MB (likely < 1 MB), mobile under 1.5 MB. If `optimize`'s join pass merged/renamed named nodes, re-run with `--join false` and re-inspect.

- [ ] **Step 5: Commit**

```bash
git add assets/models/cup-desktop.glb assets/models/cup-mobile.glb
git commit -m "feat(3d): ship two-tier paper-cup GLBs (Cup/Lid/Liquid/Steam contract)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Runtime — placeholder trio, Lid contract, lid-off + side-cup mapping

**Files:**
- Modify: `js/koob3d.js` — `buildPlaceholderCup()` (625-669), `adoptCupGltf()` (688-737), `applyState()` (373-399), boot wiring (264-325); add `buildSideCups()` near the other builders.

**Interfaces:**
- Consumes: `INITIAL_STATE.lidLift` / `.sideCups` (Task 1); GLB objects `Cup`/`Lid`/`Liquid`/`Steam1-3` (Task 4).
- Produces: `cupParts = { group, cup, lid, lidMaterials, liquid, steam }` (both placeholder and GLB paths — `saucer` is gone); `buildSideCups(cupParts)` → `{ group, materials }`.

- [ ] **Step 1: Rewrite `buildPlaceholderCup()`** (paper silhouette, lid, no saucer)

```js
/* Placeholder KOOB paper cup from a lathe profile — same object names and
   pivots as the real GLB so the stream-in swap is drop-in. */
function buildPlaceholderCup() {
  const group = new THREE.Group();
  const pts = [];
  const profile = [
    [0.0, 0.0], [0.026, 0.0], [0.028, 0.004],
    [0.0345, 0.052], [0.04, 0.096], [0.0415, 0.102],
  ];
  for (const [x, y] of profile) pts.push(new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 48),
    new THREE.MeshStandardMaterial({ color: 0xd3c3ab, roughness: 0.65, side: THREE.DoubleSide })
  );
  cup.name = "Cup";
  // black dome lid: clamp band + raised sip plateau, origin at the rim plane
  const lidMat = new THREE.MeshStandardMaterial({
    color: 0x141414, roughness: 0.35, transparent: true,
  });
  const lid = new THREE.Group();
  lid.name = "Lid";
  const lidRim = new THREE.Mesh(new THREE.CylinderGeometry(0.0445, 0.0435, 0.0075, 48), lidMat);
  lidRim.position.y = 0.0037;
  const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.033, 0.008, 48), lidMat);
  lidTop.position.y = 0.0105;
  lid.add(lidRim, lidTop);
  lid.position.y = 0.102;
  lid.userData.baseX = 0;
  lid.userData.baseY = 0.102;
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0365, 0.026, 0.09, 40),
    new THREE.MeshStandardMaterial({ color: 0x3c2414, roughness: 0.15 })
  );
  liquid.name = "Liquid";
  liquid.geometry.translate(0, 0.045, 0); // pivot at base → scale.y fills upward
  liquid.position.y = 0.006;
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
    s.position.set((n - 1) * 0.018, 0.19, 0);
    s.userData.baseY = 0.19;
    steam.push(s);
    group.add(s);
  }
  group.add(cup, lid, liquid);
  group.position.y = -0.06;
  return { group, cup, lid, lidMaterials: [lidMat], liquid, steam };
}
```

- [ ] **Step 2: Update `adoptCupGltf()`** — bind `Lid` instead of `Saucer`, clone its materials for the fade:

Replace `const saucer = find("Saucer");` with:

```js
  const lid = find("Lid");
```

After the steam/liquid material blocks (before `g.position.y = ...`), add:

```js
  // The lid fades out near the top of its lift arc; clone its material(s) so
  // opacity writes never leak into the side-cup clones sharing the GLB source
  // (same GLTFLoader de-dupe hazard as the steam planes above).
  const lidMaterials = [];
  lid.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      lidMaterials.push(o.material);
    }
  });
  lid.userData.baseX = lid.position.x;
  lid.userData.baseY = lid.position.y;
```

Change the group offset comment + return:

```js
  // Group offset frames the taller paper cup (~0.116 with lid) the way the
  // ceramic cup+saucer (~0.09) sat at -0.05.
  g.position.y = -0.06;
  rig.add(g);
  return { group: g, cup, lid, lidMaterials, liquid, steam };
```

Also update the function's doc comment: contract is now `Cup, Lid, Liquid, Steam1-3`.

- [ ] **Step 3: Add `buildSideCups()`** (below `buildPlaceholderCup`):

```js
/* Two lidded clones flanking the journey cup for the hero trio. Materials
   are cloned so the #story fade (state.sideCups → opacity) can never touch
   the middle cup's originals. Works with placeholder and GLB cupParts alike. */
function buildSideCups(cupParts) {
  const group = new THREE.Group();
  const materials = [];
  const makeClone = (dx, dz, rotY, scale) => {
    const c = new THREE.Group();
    for (const src of [cupParts.cup, cupParts.lid]) {
      const n = src.clone(true);
      n.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          materials.push(o.material);
        }
      });
      c.add(n);
    }
    c.position.set(dx, 0, dz);
    c.rotation.y = rotY;
    c.scale.setScalar(scale);
    group.add(c);
  };
  makeClone(-0.115, -0.10, 0.55, 0.92); // left flank, angled toward center
  makeClone(0.10, -0.14, -0.7, 0.88);   // right flank, further back
  return { group, materials };
}
```

- [ ] **Step 4: Wire the side cups in `boot()`**

After `rig.add(cupParts.group);` (line ~269):

```js
  // hero trio: two static lidded clones flanking the journey cup. Parented to
  // the scene (not the rig) so choreography/parallax only move the middle cup;
  // position mirrors the rig's hero framing (cupX 1.1, cupY -0.2)·0.22 plus
  // the cup group's own -0.06.
  const sideCupsGroup = new THREE.Group();
  sideCupsGroup.position.set(0.242, -0.104, 0);
  scene.add(sideCupsGroup);
  let sideCupParts = buildSideCups(cupParts);
  sideCupsGroup.add(sideCupParts.group);
```

Inside the `Promise.all(...).then(...)` after `cupParts = adoptCupGltf(cupGltf, rig);`:

```js
      sideCupsGroup.remove(sideCupParts.group);
      disposeObject3D(sideCupParts.group);
      sideCupParts = buildSideCups(cupParts);
      sideCupsGroup.add(sideCupParts.group);
```

- [ ] **Step 5: Map the new state in `applyState()`**

After the steam `forEach` (line ~387):

```js
    // lid-off: rises, tilts, drifts right, fades near the top of the arc
    // (heroLid scrubs state.lidLift 0→1; fully reversible on scroll-up)
    const lid = cupParts.lid;
    const ll = state.lidLift;
    lid.position.y = lid.userData.baseY + ll * 0.17;
    lid.position.x = lid.userData.baseX + ll * 0.12;
    lid.rotation.z = -0.85 * ll;
    const lidFade = 1 - smooth01((ll - 0.6) / 0.35);
    for (const m of cupParts.lidMaterials) m.opacity = lidFade;
    lid.visible = lidFade > 0.02;
    // hero trio flanks: hold lids, fade + sink back as #story arrives
    const sc = state.sideCups;
    for (const m of sideCupParts.materials) m.opacity = sc;
    sideCupParts.group.position.z = -(1 - sc) * 0.3;
    sideCupParts.group.visible = sc > 0.01;
```

- [ ] **Step 6: Verify in the browser**

```bash
npm test
npm run serve &
node tools/shot.mjs http://localhost:8123/ 0,2340,2900,3400,4200,5400
```

Expected: exit 0, no console errors, `has-3d: true`. Read the shots in order and confirm: portal approach → trio with lids after the crossing → middle lid lifting mid-hero → coffee filling + steam with lid gone → side cups fading as Story arrives → single cup drifting left. Tune `sideCupsGroup.position`/clone offsets and the sticker `--u` (re-run Task 2 + Task 4 steps 1-4 if the logo isn't facing camera) until the trio composition reads well at 1440×900 and 390×844 (`--mobile`).

- [ ] **Step 7: Commit**

```bash
git add js/koob3d.js
git commit -m "feat(3d): hero cup trio, lid-off scrub, Lid contract replaces Saucer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Docs + full verification sweep

**Files:**
- Modify: `MEDIA_GENERATION.md` (3D pipeline section, lines ~200-229), `assets/models/ATTRIBUTION.md`
- Possibly modify: `index.html` (`.hero-glow` position, only if the visual pass demands it)

**Interfaces:** none — documentation and final gates.

- [ ] **Step 1: Update `MEDIA_GENERATION.md`**

In the "3D asset pipeline" section: replace the cup contract sentence — objects are now `Cup`, `Lid` (separate so it can lift off on scroll), `Liquid`, `Steam1..3`; materials `Paper` (albedo `src/paper_col.png`, authored by `tools/make_cup_texture.py` — kraft + KOOB sticker, sticker position tunable via `--u/--v/--radius`), `LidPlastic`, `Espresso`, `SteamWisp`. Note the ceramic texture set (`src/ceramic_*.png`) is superseded but kept in git history. Export/compress recipe text is unchanged.

- [ ] **Step 2: Update `assets/models/ATTRIBUTION.md`**

Change the original-work line to: `Cup, Lid, Liquid, Steam: original work, created in Blender for KOOB. Logo artwork: KOOB brand asset.`

- [ ] **Step 3: Full verification sweep**

```bash
npm test
node tools/shot.mjs http://localhost:8123/ 0,2340,2900,3400,4200,5400,7000,9000,12000
node tools/shot.mjs http://localhost:8123/ 0,2340,2900,3400 --mobile
node tools/shot.mjs "http://localhost:8123/?no3d" 0,1200
```

Expected: all exit 0, zero console errors. Desktop shots confirm the full journey (trio → lid-off → fill → story drift → collection turntable with the sticker reading during the spin → features return). Mobile shots confirm the mobile-tier GLB renders the trio. `?no3d` confirms the video-fallback hero still works untouched. If the hero glow sits oddly against the new trio, adjust `.hero-glow` `left` (index.html:1884-1893) and re-shoot.

- [ ] **Step 4: Commit**

```bash
git add MEDIA_GENERATION.md assets/models/ATTRIBUTION.md
git commit -m "docs(3d): paper-cup contract + sticker pipeline in media docs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Include `index.html` in the add only if Step 3 changed it.)
