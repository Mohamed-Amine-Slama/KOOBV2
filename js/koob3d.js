/* KOOB 3D journey runtime. Boots only when html.has-3d is present (set by the
   inline gate in <head>). On any failure: downgrade() restores the legacy
   experience and the page keeps working. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  pickTier,
  modelUrls,
  INITIAL_STATE,
  CHOREOGRAPHY,
  ROASTS,
  WAYPOINTS,
} from "./koob3d-core.js";

const root = document.documentElement;

const GOLD_BURST_COUNT = 60;
const GOLD_BURST_COLOR = 0xc8a96e; // KOOB palette gold

// Set by boot() once its per-instance teardown() closure exists; downgrade()
// calls through this so the render loop, listeners, and every scroll-driven
// tween/ScrollTrigger get torn down before the legacy experience takes over —
// otherwise they keep running forever against a canvas that's been removed
// from the DOM. Stays null (a harmless no-op) for the renderer-creation
// failure path in boot(), which can only happen before teardown exists —
// and before anything teardown would need to clean up has been created.
// Declared (and must stay) above the `if (has-3d) boot()` call below: boot()
// runs synchronously and assigns this before control ever returns to this
// line, so declaring it any later leaves that assignment hitting the
// temporal dead zone.
let currentTeardown = null;

if (root.classList.contains("has-3d")) boot();

// scratch object reused by animateBeans so the ticker never allocates
const beanEuler = new THREE.Euler();

function downgrade(reason) {
  console.warn("[koob3d] downgrading to legacy experience:", reason);
  if (currentTeardown) currentTeardown();
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
  camera.position.set(0, 0.22, 0.55);
  // downward tilt toward the cup's rest height so the open rim (and the
  // liquid filling inside it) reads on screen instead of being viewed edge-on
  camera.lookAt(0, -0.05, 0);

  // Neutral studio IBL: without it the Glass transmission material has
  // nothing to refract (reads as a flat gray blob) and the GoldRim/ceramic
  // PBR materials have no specular reflections, so the beans in particular
  // read as near-black silhouettes instead of lit coffee beans. The canvas
  // itself stays transparent (scene.background is untouched) so this only
  // feeds material lighting, not the page's dark backdrop.
  // scene.environmentIntensity (r170+) scales the whole contribution back
  // down: pixel-diffed against the pre-Task-10 screenshots (a fixed point on
  // the cup body measured ~(91,86,65) before), anything above ~0.1 visibly
  // brightened *and* desaturated the cup toward gray — RoomEnvironment is a
  // neutral-gray studio, so its IBL dilutes the warm cream/gold tone the
  // brand relies on. 0.06 was the highest value that stayed within ~10-20%
  // of the original brightness/warmth at that sample point while still
  // giving the rim/glass a real (if subtle) Fresnel reflection — the void
  // behind the cup is untouched either way (confirmed byte-identical).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmrem.fromScene(roomEnv).texture;
  scene.environmentIntensity = 0.06;
  pmrem.dispose();
  // fromScene() has already baked roomEnv into the PMREM texture above; the
  // temporary studio-room meshes it built are otherwise never referenced
  // again and would leak their geometries/materials for the life of the page.
  disposeObject3D(roomEnv);

  /* KOOB lighting: warm gold key upper-right, teal fill left, soft ambient —
     matches the art-direction lock in MEDIA_GENERATION.md. Energies were
     trimmed slightly from their pre-IBL values (key 2.4→2.0, fill 0.9→0.75,
     ambient 0.35→0.28) to offset the environment map's added light so overall
     brightness stays close to the pre-Task-10 screenshots once the env map
     is in — see the environmentIntensity comment above for the measurement. */
  const key = new THREE.DirectionalLight(0xc8a96e, 2.0);
  key.position.set(0.6, 0.9, 0.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x1a6b52, 0.75);
  fill.position.set(-0.7, 0.2, 0.4);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xf5f0e8, 0.28));

  const state = { ...INITIAL_STATE };
  const parallax = { x: 0, y: 0 };
  let needsRender = true;

  /* ---- render-loop discipline: hard pause, tab-visibility suspend, and an
     adaptive DPR drop all hang off the same `tick` function, so they're
     declared together here rather than scattered through boot(). ---- */
  let tickerAttached = false; // becomes true the instant attachTicker() runs below
  let pauseTimer = null; // armed while idle; fires the hard detach after 2s
  // Flips true once (see teardown() near the end of boot()); every re-attach
  // path (attachTicker itself, and invalidate() which is its only caller)
  // checks it so a downgrade() mid-session can't have some later scroll/
  // pointermove event silently re-arm the render loop against a canvas
  // that's already been removed from the DOM.
  let dead = false;
  function attachTicker() {
    if (dead || tickerAttached) return;
    window.gsap.ticker.add(tick);
    tickerAttached = true;
  }
  function detachTicker() {
    if (!tickerAttached) return;
    window.gsap.ticker.remove(tick);
    tickerAttached = false;
  }
  function armHardPause() {
    if (pauseTimer !== null) return; // already armed for this idle streak
    // Hard render pause: 2s of continuous idle (nothing invalidated, or the
    // scene is fully faded) detaches `tick` from gsap.ticker entirely — not
    // just an early return inside it, but zero per-frame calls at all, the
    // same end state as renderer.setAnimationLoop(null). invalidate()
    // reverses this instantly (scroll, pointermove, resize, a new GLB
    // arriving) by re-adding the callback.
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      detachTicker();
    }, 2000);
  }
  function disarmHardPause() {
    if (pauseTimer !== null) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
  }
  const invalidate = () => {
    if (dead) return;
    needsRender = true;
    // Don't fight the tab-visibility suspend below: while hidden, just record
    // that a render is owed; the visibilitychange handler re-attaches (and
    // calls invalidate() again) the moment the tab becomes visible.
    if (document.hidden) return;
    disarmHardPause();
    attachTicker();
  };

  // Adaptive DPR: average frame time over a rolling window of the last 60
  // *actively rendered* frames (idle/paused frames don't count — see tick()
  // resetting lastActiveFrameTime whenever it skips). If that average creeps
  // past a 24ms/frame budget (sustained GPU/CPU pressure), drop to
  // pixelRatio 1 once — cheap, irreversible for this session, logged once.
  const FRAME_TIME_WINDOW = 60;
  const FRAME_TIME_BUDGET_MS = 24;
  const frameTimeWindow = [];
  let lastActiveFrameTime = null;
  let dprDropped = false;

  /* ---- scene contents: instant placeholder cup, swapped for the real GLBs
     as soon as they stream in (both loaders run behind the preloader) ---- */
  const rig = new THREE.Group(); // choreography moves the rig
  scene.add(rig);
  let cupParts = buildPlaceholderCup();
  let propParts = null;
  rig.add(cupParts.group);

  // gold particle burst: parked invisible at the cup rim, fired once per
  // WAYPOINTS entry (see the ScrollTrigger wiring below)
  const goldBurst = buildGoldBurst();
  rig.add(goldBurst.points);

  window.__koob3d = { state, scene, renderer, tier, goldBurst, frames: 0 };

  const urls = modelUrls(tier);
  const draco = new DRACOLoader().setDecoderPath(
    "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
  const ktx2 = new KTX2Loader().setTranscoderPath(
    "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/")
    .detectSupport(renderer);
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);

  Promise.all([loader.loadAsync(urls.cup), loader.loadAsync(urls.props)])
    .then(([cupGltf, propsGltf]) => {
      const oldPlaceholder = cupParts.group;
      rig.remove(oldPlaceholder);
      disposeObject3D(oldPlaceholder); // placeholder is discarded for good — free its GPU buffers
      cupParts = adoptCupGltf(cupGltf, rig);
      propParts = adoptPropsGltf(propsGltf, scene, tier);
      window.__koob3d.assets = { cup: urls.cup, props: urls.props };

      // Recompute the gold-burst rim anchor from the real cup now that it's
      // loaded — the placeholder-era estimate (rimRadius 0.037/rimY 0.036 in
      // buildGoldBurst) was a guess at the eventual GLB's rim. Box3.setFromObject
      // walks *world* matrices, which would bake in whatever scroll-driven
      // transform `rig` currently happens to have — zero it out first so the
      // box comes back in rig-local space, the same frame goldBurst.points is
      // parented in. Safe to mutate transiently: applyState() unconditionally
      // re-derives rig.position/rotation/scale from `state` on every active
      // tick, and invalidate() below guarantees one runs before the next render.
      const savedPos = rig.position.clone();
      const savedRot = rig.rotation.clone();
      const savedScale = rig.scale.clone();
      rig.position.set(0, 0, 0);
      rig.rotation.set(0, 0, 0);
      rig.scale.setScalar(1);
      rig.updateWorldMatrix(true, true);
      const rimBox = new THREE.Box3().setFromObject(cupParts.cup);
      rig.position.copy(savedPos);
      rig.rotation.copy(savedRot);
      rig.scale.copy(savedScale);
      goldBurst.rimY = rimBox.max.y;
      goldBurst.rimRadius = ((rimBox.max.x - rimBox.min.x) / 2) * 0.85;

      invalidate();
    })
    .catch((err) => downgrade(err));

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
    if (propParts) {
      propParts.beans.visible = state.beans > 0.01;
      // Glass is a MeshPhysicalMaterial with transmission — fading it via
      // material.opacity fights the transmission pass (renders as a flat,
      // artifacted plane). Faking a fade-in with visibility + a scale ramp
      // from near-zero avoids that entirely and reads just as well since the
      // glass only ever appears/disappears, it never dissolves mid-scene.
      propParts.glass.visible = state.glass > 0.01;
      propParts.glass.scale.setScalar(0.001 + state.glass * propParts.glassBaseScale);
    }
    canvas.style.setProperty("opacity", String(state.sceneOpacity));
  }

  /* ---- render-on-demand: gsap.ticker is already running for Lenis ---- */
  function tick() {
    if (!needsRender || state.sceneOpacity <= 0.001) {
      lastActiveFrameTime = null; // break the frame-time window across idle gaps
      armHardPause();
      return;
    }
    disarmHardPause();
    needsRender = false;
    applyState();
    animateSteam(cupParts.steam);
    if (propParts) {
      animateGlass(propParts);
      animateBeans(propParts);
    }
    renderer.render(scene, camera);
    window.__koob3d.frames++;

    const now = performance.now();
    if (lastActiveFrameTime !== null) {
      const dt = now - lastActiveFrameTime;
      frameTimeWindow.push(dt);
      if (frameTimeWindow.length > FRAME_TIME_WINDOW) frameTimeWindow.shift();
      if (!dprDropped && frameTimeWindow.length === FRAME_TIME_WINDOW) {
        const avg = frameTimeWindow.reduce((a, b) => a + b, 0) / FRAME_TIME_WINDOW;
        if (avg > FRAME_TIME_BUDGET_MS) {
          dprDropped = true;
          renderer.setPixelRatio(1);
          console.warn(
            `[koob3d] adaptive DPR: average frame time ${avg.toFixed(1)}ms ` +
            `over the last ${FRAME_TIME_WINDOW} rendered frames exceeded the ` +
            `${FRAME_TIME_BUDGET_MS}ms budget — dropping pixelRatio to 1`
          );
        }
      }
    }
    lastActiveFrameTime = now;
  }
  attachTicker();

  // Tab visibility: suspend the render loop entirely while the tab is
  // hidden (rAF is throttled by the browser anyway, but detaching also stops
  // gsap from bothering to call into a hidden canvas at all) and force one
  // fresh render on return in case anything invalidated silently while away.
  // Named (rather than inline) so teardown() below can remove it.
  function onVisibilityChange() {
    if (document.hidden) {
      disarmHardPause();
      detachTicker();
    } else {
      invalidate();
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  /* ---- choreography: every tween just mutates `state` ----
     #hero ("top top" -> "bottom top") and #story ("top 85%" -> "bottom 40%")
     used to both write state.steam over ~700px of overlapping scrollY, so
     whichever tween's onUpdate ran last in a given frame won the write — a
     visible flicker rather than a monotonic ramp. That's fixed at the data
     level now (see CHOREOGRAPHY in koob3d-core.js): #story no longer touches
     steam at all, so hero owns the only steam-writing range until menu fades
     it out. `overwrite: "auto"` was tried here as a runtime fix instead, but
     it's unsound for scrub tweens that live for the whole page's scroll
     range: GSAP's auto-overwrite kills the *other* tween's conflicting
     property tween permanently the first time both are simultaneously
     active, not just for that frame — so scrolling back up after visiting
     #story left hero's steam sub-tween dead and state.steam frozen instead of
     tracking the scrubber. Every tween below is collected into `tweens` (and
     every WAYPOINTS ScrollTrigger into `scrollTriggers`) purely for
     teardown() — see the bottom of boot() — not for overwrite bookkeeping. */
  const tweens = [];
  for (const c of CHOREOGRAPHY) {
    if (c.trigger === null) {
      tweens.push(window.gsap.to(state, {
        ...c.to,
        duration: c.duration,
        delay: 3.2, // after the preloader venetian split
        ease: "power2.out",
        onUpdate: invalidate,
      }));
    } else {
      // Scrub tweens ease toward their target over `c.scrub` seconds rather than
      // snapping instantly, so a tween can still be "catching up" for a moment
      // after a fast scroll (e.g. clicking the "Explore The Menu" anchor jump,
      // or a fast flick) lands past its trigger's end. Because every
      // choreography entry shares the same `state` object, that lingering catch
      // -up can out-live the next trigger's own writes and clobber them
      // (observed: landing just past a boundary froze cupX/cupScale/roast at the
      // previous section's target instead of the new section's interpolation).
      // fastScrollEnd is GSAP's built-in fix: when the user stops after a fast
      // scroll, the scrub snaps to the resting value immediately instead of
      // continuing to ease, closing the window where two tweens' writes race.
      tweens.push(window.gsap.to(state, {
        ...c.to,
        ease: "none",
        immediateRender: false,
        onUpdate: invalidate,
        scrollTrigger: {
          trigger: c.trigger,
          start: c.start,
          end: c.end,
          scrub: c.scrub,
          fastScrollEnd: true,
        },
      }));
    }
  }

  /* ---- WAYPOINTS: one-shot effects layered on top of the scrub tweens
     above. Each entry gets its own ScrollTrigger (onEnter, not scrubbed) so
     the effect fires exactly once as the reader crosses the milestone. */
  const scrollTriggers = [];
  for (const w of WAYPOINTS) {
    if (w.effect === "goldBurst") {
      scrollTriggers.push(window.ScrollTrigger.create({
        trigger: w.trigger,
        start: w.start,
        onEnter: () => triggerGoldBurst(goldBurst, invalidate),
      }));
    }
  }

  /* mouse parallax (desktop only), ±0.03 rad / ±0.01 units. Named (rather
     than inline) so teardown() below can remove it. */
  function onPointerMove(e) {
    parallax.x = (e.clientX / innerWidth - 0.5) * -0.06;
    parallax.y = (e.clientY / innerHeight - 0.5) * -0.02;
    invalidate();
  }
  if (tier === "desktop") {
    window.addEventListener("pointermove", onPointerMove);
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

  /* ---- full teardown, run once by downgrade() before it restores the
     legacy experience: without this, the ticker machinery, the three
     listeners above, and every scroll-driven tween/ScrollTrigger created in
     this boot() call would keep running forever (and re-arm the render loop
     via invalidate()) against a canvas that's already been removed from the
     DOM. `dead` (checked by attachTicker/invalidate) makes every one of those
     re-arm paths a no-op from this point on. */
  function teardown() {
    if (dead) return;
    dead = true;
    disarmHardPause();
    detachTicker();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    tweens.forEach((t) => t.kill());
    scrollTriggers.forEach((st) => st.kill());
  }
  currentTeardown = teardown;
  window.__koob3d.forceDowngrade = () => downgrade("debug");

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

  /* glass idles gently while visible in #featured's left gutter — same
     render-on-demand contract as animateSteam/animateBeans: a slow turntable
     spin plus a small vertical bob so it reads as a living prop rather than a
     static cutout planted in the margin. */
  let glassT = 0;
  function animateGlass(pp) {
    if (state.glass <= 0.01) return;
    glassT += 0.016;
    pp.glass.rotation.y = glassT * 0.15;
    pp.glass.position.y = pp.glassBaseY + Math.sin(glassT * 0.6) * 0.015;
    needsRender = true; // continuous loop while the glass is visible
  }

  /* beans drift slowly through the story section — same render-on-demand
     contract as animateSteam: keeps invalidating while state.beans is up */
  function animateBeans(pp) {
    if (state.beans <= 0.01) return;
    pp.seeds.forEach((seed, i) => {
      seed.spin += seed.speed * 0.016;
      pp.p.set(seed.x, seed.y + Math.sin(seed.spin * 0.5) * 0.04, seed.z);
      pp.q.setFromEuler(beanEuler.set(seed.spin * 0.6, seed.spin, seed.spin * 0.3));
      pp.m.compose(pp.p, pp.q, pp.s);
      pp.beans.setMatrixAt(i, pp.m);
    });
    pp.beans.instanceMatrix.needsUpdate = true;
    needsRender = true; // continuous loop while beans are visible
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

/* glTF gives one Mesh per material on a node; an object exported with N
   materials (Cup: Ceramic+GoldRim, Portafilter: Handle+Gold+Steel) arrives
   as a Group wrapping N (possibly unnamed) Mesh children rather than a
   single Mesh. Use the named object itself for position/visibility/scale
   (Object3D methods, work on both) and this resolver only when geometry or
   material must be touched directly. */
function firstMesh(obj) {
  let mesh = null;
  obj.traverse((o) => {
    if (!mesh && o.isMesh) mesh = o;
  });
  return mesh;
}

/* Binds the loaded cup GLB by the Task 8 name contract: Cup, Saucer,
   Liquid, Steam1-3. Mirrors buildPlaceholderCup()'s returned shape so
   applyState/animateSteam work unchanged against either. */
function adoptCupGltf(gltf, rig) {
  const g = gltf.scene;
  const find = (n) => {
    const o = g.getObjectByName(n);
    if (!o) throw new Error(`GLB missing object ${n}`);
    return o;
  };
  const cup = find("Cup");
  const saucer = find("Saucer");
  const liquid = find("Liquid");
  const steamNodes = ["Steam1", "Steam2", "Steam3"].map(find);
  const steamMeshes = steamNodes.map(firstMesh);
  // GLTFLoader de-dupes identical materials across nodes, so all three
  // Steam1-3 planes arrive sharing one material instance: without cloning,
  // applyState's per-plane opacity gradient (0.50/0.38/0.26) just has each
  // plane overwrite the same .opacity in turn, and every plane ends up at
  // whatever the last one set it to. Grab the shared instance before cloning
  // so it can be disposed exactly once afterward — once every plane holds its
  // own clone, this original is unreferenced by any mesh but never freed on
  // its own, leaking a Material for the life of the page.
  const sharedSteamMaterial = steamMeshes[0].material;
  const steam = steamNodes.map((node, i) => {
    const mesh = steamMeshes[i];
    mesh.material = mesh.material.clone();
    mesh.material.transparent = true;
    mesh.material.depthWrite = false;
    mesh.material.opacity = 0;
    node.userData.baseY = node.position.y;
    return node; // node === mesh for every current export (single material)
  });
  sharedSteamMaterial.dispose();
  // The baked Liquid material (Espresso) is replaced with one we own so the
  // roast lerp in applyState can drive its color; everything else (Ceramic,
  // GoldRim, SteamWisp — which carries the KTX2 alpha texture) keeps its
  // baked GLB material untouched.
  firstMesh(liquid).material = new THREE.MeshStandardMaterial({
    color: 0x3c2414, roughness: 0.12,
  });
  // Liquid's translation is its base pivot (y≈0.007 in the GLB) — applyState's
  // liquid.scale.y fills upward from there, same contract as the placeholder.
  // Group offset matches the placeholder's framing (verified: real cup+saucer
  // measure ~0.09 units tall, essentially identical to the placeholder's).
  g.position.y = -0.05;
  rig.add(g);
  return { group: g, cup, saucer, liquid, steam };
}

/* Binds the loaded props GLB: Bean (instanced 30/12), Portafilter (hidden,
   reserved for a future story moment), Glass (fades in for #featured). */
function adoptPropsGltf(gltf, scene, tier) {
  const src = gltf.scene;
  const beanNode = src.getObjectByName("Bean");
  const portafilter = src.getObjectByName("Portafilter");
  const glass = src.getObjectByName("Glass");
  if (!beanNode || !portafilter || !glass) {
    throw new Error("props GLB missing Bean/Portafilter/Glass");
  }
  const bean = firstMesh(beanNode);
  const count = tier === "mobile" ? 12 : 30;
  const beans = new THREE.InstancedMesh(bean.geometry, bean.material, count);
  beans.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // InstancedMesh derives its culling bounds from the single source
  // geometry, not the spread of per-instance transforms, so the whole field
  // of beans (scattered ±0.45 in x, ±0.25 in y, out to z -0.4) can vanish the
  // moment the camera/rig framing shifts the (uninstanced) geometry origin
  // out of frame. The instances are cheap; skip frustum culling entirely.
  beans.frustumCulled = false;
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
  portafilter.visible = false; // reserved for a future story moment
  // Was (0.28, -0.1, -0.1): that screen position sits entirely behind the
  // opaque #featured drink-card DOM images at standard viewports (traced
  // screen-space bbox x:1136-1438 @1440x900 — fully under card 4), so the
  // "glass refracts in the featured section" effect was never actually
  // visible. Moved into the section's left gutter instead: `.featured-wrapper`
  // has `padding-left:10vw` and only holds pointer-events:none header text
  // there, so nothing DOM-side occludes this world position while #featured
  // is pinned. Verified via ScrollTrigger.getAll() + a screenshot at a
  // scrollY inside the actual pin range.
  glass.position.set(-0.34, -0.05, -0.1);
  // Glass is MeshPhysicalMaterial with transmission — captured before any
  // scale mutation so applyState's fade-in ramps toward the authored size,
  // not toward whatever scale happened to be set last.
  const glassBaseScale = glass.scale.x || 1;
  const glassBaseY = glass.position.y;
  scene.add(beans, glass, portafilter);
  return { beans, seeds, glass, portafilter, glassBaseScale, glassBaseY, m, q, p, s };
}

/* Frees GPU buffers for a whole subtree. Used once the placeholder cup is
   swapped out for the real GLB and permanently discarded — otherwise its
   geometries/materials just leak for the life of the page. */
function disposeObject3D(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => m?.dispose());
  });
}

/* A 60-point cloud parked invisible at the cup rim (rig-local coordinates,
   so it inherits the cup's current position/rotation/scale every frame same
   as the cup meshes themselves). triggerGoldBurst() resets it to a ring at
   the rim and animates outward. */
function buildGoldBurst() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GOLD_BURST_COUNT * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: GOLD_BURST_COLOR,
    size: 0.012,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.frustumCulled = false; // rim-anchored burst can reach past the cup's own bounds mid-animation
  // each particle's fixed angle around the rim ring + a random upward-drift
  // bias, both reused unchanged on every subsequent trigger
  const dirs = [];
  for (let i = 0; i < GOLD_BURST_COUNT; i++) {
    const a = (i / GOLD_BURST_COUNT) * Math.PI * 2;
    dirs.push({ cos: Math.cos(a), sin: Math.sin(a), up: 0.5 + Math.random() * 0.7 });
  }
  return {
    points, dirs,
    rimRadius: 0.037, rimY: 0.036, // rig-local cup-rim estimate, shared by placeholder & GLB pivots
    tween: { t: 1 }, // t=1 => settled/hidden; triggerGoldBurst rewinds to 0
  };
}

/* Fires one burst: rewinds the shared progress tween to 0 and, every frame
   until it reaches 1 (0.9s, power2.out), re-positions each particle along
   its fixed rim angle at a growing radius/height while fading opacity 1→0,
   then hides the cloud again. */
function triggerGoldBurst(burst, invalidate) {
  const { points, dirs, rimRadius, rimY, tween } = burst;
  const pos = points.geometry.attributes.position;
  points.visible = true;
  points.material.opacity = 1;
  window.gsap.killTweensOf(tween);
  tween.t = 0;
  window.gsap.to(tween, {
    t: 1,
    duration: 0.9,
    ease: "power2.out",
    onUpdate: () => {
      const reach = tween.t * 0.16;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        pos.setXYZ(i, d.cos * (rimRadius + reach), rimY + d.up * reach, d.sin * (rimRadius + reach));
      }
      pos.needsUpdate = true;
      points.material.opacity = 1 - tween.t;
      invalidate();
    },
    onComplete: () => { points.visible = false; },
  });
}
