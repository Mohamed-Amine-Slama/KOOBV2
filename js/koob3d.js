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

/* Portal entry constants. The camera dollies from FAR_Z to NEAR_Z as the
   time-based portalEntry tween plays state.portalT 0→1 over the hero; the
   portal arch plane sits at PORTAL_Z between them, so the camera physically
   crosses it (at portalT ≈ 0.9 given the dolly's pow-1.35 easing). NEAR_Z is
   the cup journey's long-standing fixed camera position — the fly-through
   lands exactly where every later choreography frame expects the camera. */
const PORTAL_CAM_FAR_Z = 3.4;
const PORTAL_CAM_NEAR_Z = 0.55;
const PORTAL_Z = 0.85;
const PORTAL_SCALE = 0.3; // GLB is authored at real size (2.57m tall)
// arch centerline is 1.3m up in the GLB; place it dead ahead of the camera
const PORTAL_Y = 0.22 - 1.3 * PORTAL_SCALE;
// Brand-teal the canvas clears to behind the hero trio (#hero DOM is
// transparent under has-3d); matches the no-3d hero's CSS background so the
// fallback and the 3D hero read as the same design.
const HERO_BG_COLOR = new THREE.Color(0x275c59);

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
  // Idempotent: teardown() already killed every tween/listener/ScrollTrigger
  // and this function has already stripped has-3d on a first call, so a
  // second call (e.g. forceDowngrade() invoked twice, or a webglcontextlost
  // event arriving after the canvas is already gone) must be a no-op —
  // otherwise it re-runs __startBeanField() and ScrollTrigger.refresh()
  // against a page that's already downgraded.
  if (!root.classList.contains("has-3d")) return;
  console.warn("[koob3d] downgrading to legacy experience:", reason);
  if (currentTeardown) currentTeardown();
  root.classList.remove("has-3d");
  root.classList.remove("portal-active");
  // a downgrade mid-flight leaves Lenis stopped (the flight's onComplete
  // never fires once its tween is killed) — hand scrolling back here
  if (window.__lenis) window.__lenis.start();
  const canvas = document.getElementById("koob-3d");
  if (canvas) canvas.remove();
  // removing has-3d restores the sections' opaque backgrounds, so every
  // ScrollTrigger built against the 3D layout — including the DOM-only ones
  // created in index.html — is stale
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
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
  // The 3D layer owns the hero visual once has-3d holds; the legacy fallback
  // <video> underneath never becomes visible, but browsers still decode a
  // hidden autoplaying <video> in the background. Stop that decode for the
  // (expected) case boot succeeds — downgrade() above restores muted/loop/
  // play if the 3D layer ever hands control back to it mid-session.
  const heroVideo = document.querySelector(".hero-fill-video");
  if (heroVideo) {
    heroVideo.pause();
    heroVideo.removeAttribute("autoplay");
    heroVideo.preload = "none";
  }

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
  // Start of the portal approach (state.portalT = 0). applyPortalState()
  // re-derives position + gaze from state.portalT on every applied frame:
  // portalT 1 lands exactly on the cup journey's fixed vantage — position
  // (0, 0.22, 0.55) with the downward tilt to lookAt(0, -0.05, 0) so the open
  // cup rim (and the liquid filling inside it) reads on screen instead of
  // being viewed edge-on.
  camera.position.set(0, 0.22, PORTAL_CAM_FAR_Z);
  camera.lookAt(0, 0.22, 0);

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
  // 0.06 was measured against the ceramic cup (see above); the kraft paper
  // cup is both lighter and rougher, so it takes a touch more IBL (0.09,
  // still under the ~0.1 desaturation ceiling) to keep body in the paper
  // now that the key light is trimmed below.
  scene.environmentIntensity = 0.09;
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
  // key trimmed 2.0→1.55 for the paper cup: the light kraft albedo was
  // rolling off to white under ACES on lit faces, flattening the cups
  const key = new THREE.DirectionalLight(0xc8a96e, 1.55);
  key.position.set(0.6, 0.9, 0.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x1a6b52, 0.75);
  fill.position.set(-0.7, 0.2, 0.4);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xf5f0e8, 0.28));

  const state = { ...INITIAL_STATE };
  const parallax = { x: 0, y: 0 };
  let needsRender = true;

  /* ---- portal entry DOM layers (all display-gated on html.has-3d in CSS,
     so none of this exists for legacy users). portal-active additionally
     raises the canvas above the veil for the fly-through, then comes off at
     portalT ≥ 0.97 to restore normal stacking for the cup journey. Added here
     (not in static markup) so a non-3D load never shows the veil at all. ---- */
  const portalVeil = document.getElementById("portal-veil");
  const portalFlash = document.getElementById("portal-flash");
  const portalHint = portalVeil ? portalVeil.querySelector(".portal-hint") : null;

  /* ---- reload-mid-page guard: browsers restore scrollY *before* this module
     runs, so a reader who hits F5 deep in the page lands here with scroll
     already at, say, the quiz section. The scrub tweens created below resolve
     correctly against that scrollY the instant their ScrollTriggers are
     created — but the time-based CHOREOGRAPHY tweens (the sceneOpacity boot
     fade and the portal overlay flight) assume a top-of-page load and must be
     held back instead: replaying the flight would veil the section the reader
     actually landed on, and the fixed-timer fade would ghost a cup in over
     it. When pastPortal is true both are skipped, portalT snaps to its
     landed state, and the scroll lock is released immediately. */
  const pastPortal = (window.scrollY || document.documentElement.scrollTop) > 4;
  if (!pastPortal) root.classList.add("portal-active");

  // Lenis is exposed as window.__lenis by index.html; under has-3d the intro
  // timeline leaves it stopped so the page can't scroll out from under the
  // time-based portal flight. Every path out of the flight (landing,
  // reload-skip, downgrade mid-flight) must release it — start() is
  // idempotent, so overlapping calls in an odd teardown ordering are harmless.
  function releaseScroll() {
    if (window.__lenis) window.__lenis.start();
  }
  if (pastPortal) {
    state.portalT = 1;
    releaseScroll();
  }

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
  let portalParts = null; // set when portal.glb streams in (see Promise.all below)
  rig.add(cupParts.group);

  // Mobile composition: the choreography's x offsets and the 1.3 hero scale
  // were framed for a landscape frustum (half-width ≈ 0.28 at z=0); a 390px
  // portrait frame is only ≈ 0.08 wide there, which threw the trio almost
  // entirely off-frame. Pull every x toward centre and shrink the cups so
  // the same choreography reads on both.
  const comFX = tier === "mobile" ? 0.3 : 1;
  const comFS = tier === "mobile" ? 0.78 : 1;

  // hero trio: two static lidded clones stacked behind the journey cup
  // (middle front, flanks tucked behind its shoulders — the product-lineup
  // composition). Parented to the scene (not the rig) so choreography/
  // parallax only move the middle cup; transform mirrors the rig's hero
  // framing: (cupX 0.88, cupY -0.24)·0.22, the cup group's own -0.06 scaled
  // by the 1.3 hero cupScale, and the same 1.3 scale so all three read as
  // the same physical cup.
  const sideCupsGroup = new THREE.Group();
  sideCupsGroup.position.set(0.194 * comFX, -0.131, 0);
  sideCupsGroup.scale.setScalar(1.3 * comFS);
  scene.add(sideCupsGroup);
  let sideCupParts = buildSideCups(cupParts);
  sideCupsGroup.add(sideCupParts.group);

  // gold particle burst: parked invisible at the cup rim, fired once per
  // WAYPOINTS entry (see the ScrollTrigger wiring below)
  const goldBurst = buildGoldBurst();
  rig.add(goldBurst.points);

  window.__koob3d = { state, scene, renderer, tier, goldBurst, frames: 0 };

  // The portal flight tween (created paused in the CHOREOGRAPHY loop below)
  // and the boot timestamp its start is measured against: the flight plays
  // once assets are adopted AND the preloader has had time to clear.
  let portalFlight = null;
  const bootAt = performance.now();

  const urls = modelUrls(tier);
  const draco = new DRACOLoader().setDecoderPath(
    "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
  const ktx2 = new KTX2Loader().setTranscoderPath(
    "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/")
    .detectSupport(renderer);
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);

  Promise.all([
    loader.loadAsync(urls.cup),
    loader.loadAsync(urls.props),
    loader.loadAsync(urls.portal),
  ])
    .then(([cupGltf, propsGltf, portalGltf]) => {
      const oldPlaceholder = cupParts.group;
      rig.remove(oldPlaceholder);
      disposeObject3D(oldPlaceholder); // placeholder is discarded for good — free its GPU buffers
      cupParts = adoptCupGltf(cupGltf, rig);
      sideCupsGroup.remove(sideCupParts.group);
      disposeObject3D(sideCupParts.group);
      sideCupParts = buildSideCups(cupParts);
      sideCupsGroup.add(sideCupParts.group);
      propParts = adoptPropsGltf(propsGltf, scene, tier);
      portalParts = adoptPortalGltf(portalGltf, scene);
      window.__koob3d.assets = { cup: urls.cup, props: urls.props, portal: urls.portal };

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

      // Play the portal flight now that the real assets are in the scene.
      // compile() pushes every shader through the GPU first — the initial
      // program compile is the biggest main-thread stall left, and with
      // lagSmoothing(0) (Lenis needs it) a stall mid-flight would advance
      // the tween by the whole stall at once. The delayedCall holds the
      // start until the preloader's venetian slats have cleared (~2.3s from
      // boot) on fast loads; on slow loads the assets themselves were the
      // wait and the flight starts immediately.
      renderer.compile(scene, camera);
      const holdMs = Math.max(0, 2300 - (performance.now() - bootAt));
      tweens.push(window.gsap.delayedCall(holdMs / 1000, () => {
        if (!dead && portalFlight) portalFlight.play();
      }));
    })
    .catch((err) => downgrade(err));

  /* ---- portal entry: everything derives from the one portalT scalar so the
     scrub is fully reversible — scroll back up and the mist re-forms, the
     veil returns, the camera backs out through the arch. ---- */
  function applyPortalState() {
    const t = state.portalT;
    // dolly with pow easing: velocity builds as the portal nears, so crossing
    // the arch reads as "stepping through" rather than a constant conveyor
    const dolly = Math.pow(t, 1.35);
    // slight camera sway from the pointer during the approach only (the cup
    // journey already gets its parallax via the rig); fades out by portalT 1
    camera.position.set(
      parallax.x * -1.2 * (1 - t),
      0.22,
      PORTAL_CAM_FAR_Z + (PORTAL_CAM_NEAR_Z - PORTAL_CAM_FAR_Z) * dolly
    );
    // gaze holds the arch center, then settles down onto the cup in the last
    // 30% — ending exactly at the cup journey's lookAt(0, -0.05, 0)
    camera.lookAt(0, 0.22 - 0.27 * smooth01((t - 0.7) / 0.3), 0);
    if (portalParts) {
      const brighten = smooth01((t - 0.4) / 0.3); // mist flares as you close in
      // burns off completely by t=0.8 — before the veil lifts and the flash
      // pops — so the through-the-arch glimpse is clean, not washed gray by
      // a lingering high-emissive film
      const dissolve = smooth01((t - 0.5) / 0.3);
      const mat = portalParts.mist.material;
      mat.emissiveIntensity = portalParts.baseMistIntensity * (1 + 1.8 * brighten);
      mat.opacity = 1 - dissolve;
      portalParts.mist.visible = mat.opacity > 0.02;
      portalParts.glow.intensity = portalParts.baseGlow * (1 - 0.6 * t);
    }
    // DOM layers: the dark void hiding the page lifts just before the
    // crossing; a cyan gaussian flash pops exactly as the camera pierces the
    // arch plane (t≈0.9). Inline styles per frame, same contract as the
    // canvas opacity below.
    if (portalVeil) portalVeil.style.opacity = String(1 - smooth01((t - 0.8) / 0.17));
    if (portalHint) portalHint.style.opacity = String(1 - smooth01(t / 0.12));
    if (portalFlash) {
      const x = (t - 0.9) / 0.05;
      portalFlash.style.opacity = String(Math.exp(-x * x) * 0.85);
    }
    root.classList.toggle("portal-active", t < 0.97);
  }

  /* ---- state → scene, executed only when something changed ---- */
  const roastColorA = new THREE.Color();
  const roastColorB = new THREE.Color();
  function applyState() {
    applyPortalState();
    rig.position.set(state.cupX * 0.22 * comFX, state.cupY * 0.22 + parallax.y, state.cupZ);
    rig.rotation.set(state.cupRotX, state.cupRotY + parallax.x, 0);
    rig.scale.setScalar(state.cupScale * comFS);
    // liquid fills bottom-up: origin sits at the liquid's base. The authored
    // cone matches the cup's interior taper at FULL height — squashing only
    // scale.y would leave its wide top rim poking through the narrower wall
    // lower down, so x/z track the wall taper as the fill rises.
    const fill = Math.max(state.liquidFill, 0.001);
    cupParts.liquid.scale.set(0.68 + 0.32 * fill, fill, 0.68 + 0.32 * fill);
    const i = Math.min(Math.floor(state.roast), ROASTS.length - 2);
    const f = Math.min(state.roast - i, 1);
    roastColorA.set(ROASTS[i].body);
    roastColorB.set(ROASTS[i + 1].body);
    cupParts.liquid.material.color.copy(roastColorA).lerp(roastColorB, f);
    cupParts.steam.forEach((s, n) => {
      s.material.opacity = state.steam * (0.5 - n * 0.12);
    });
    // lid-off: rises, tilts, drifts right, fades near the top of the arc
    // (heroLid scrubs state.lidLift 0→1; fully reversible on scroll-up)
    const lid = cupParts.lid;
    const ll = state.lidLift;
    lid.position.y = lid.userData.baseY + ll * 0.12;
    lid.position.x = lid.userData.baseX + ll * 0.04;
    lid.rotation.z = -0.85 * ll;
    const lidFade = 1 - smooth01((ll - 0.6) / 0.35);
    for (const m of cupParts.lidMaterials) m.opacity = lidFade;
    lid.visible = lidFade > 0.02;
    // hero trio flanks: hold lids, fade + sink back as #story arrives
    const sc = state.sideCups;
    for (const m of sideCupParts.materials) m.opacity = sc;
    sideCupParts.group.position.z = -(1 - sc) * 0.3;
    sideCupParts.group.visible = sc > 0.01;
    // Brand-teal backdrop painted by the canvas itself: the #hero DOM is
    // transparent under has-3d so the trio renders in front of the teal, and
    // the portalT gate keeps the flight in the dark void — the wash arrives
    // only as the camera pierces the arch, then heroLeave scrubs it back out.
    renderer.setClearColor(
      HERO_BG_COLOR,
      state.heroBg * smooth01((state.portalT - 0.85) / 0.15)
    );
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
      // Keep the DOM opacity in sync even when skipping the render: an
      // instant scroll jump (anchor click, test harness) can drop
      // sceneOpacity from 1 to 0 between two ticks, and bailing before
      // applyState() would freeze the canvas at its last-painted opacity —
      // a stale hero frame left showing through the transparent sections.
      if (state.sceneOpacity <= 0.001) {
        canvas.style.setProperty("opacity", "0");
      }
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
      // Skip on a reload-mid-page landing (see the pastPortal guard above):
      // the scrub tweens below already own sceneOpacity for wherever the
      // reader actually is, and these fixed-timer tweens (boot fade, portal
      // flight) have no idea where that is — letting them run would fade a
      // ghost cup in, or replay the veiled flight, over that section.
      if (pastPortal) continue;
      // The flight is created PAUSED and played from the asset .then above,
      // never on a delay: gsap.ticker runs with lagSmoothing(0) (Lenis
      // needs it), so a load-time main-thread stall (CDN fetch, GLB decode,
      // first shader compile) would otherwise advance a delayed tween by
      // the whole stall at once and skip the flight entirely.
      const isFlight = c.id === "portalEntry";
      const tw = window.gsap.to(state, {
        ...c.to,
        duration: c.duration,
        delay: isFlight ? 0 : (c.delay ?? 3.2),
        ease: c.ease || "power2.out",
        paused: isFlight,
        onUpdate: invalidate,
        // the flight owns the scroll lock on a normal load; landing hands
        // the page back to the reader (see releaseScroll above)
        onComplete: isFlight ? releaseScroll : undefined,
      });
      if (isFlight) portalFlight = tw;
      tweens.push(tw);
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

  // Named (rather than inline) so teardown() below can remove it — otherwise
  // it survives on the detached canvas element after a downgrade() and can
  // fire again on a stray contextlost event, re-entering downgrade() (now a
  // no-op thanks to its own idempotency guard, but the listener should still
  // be gone like every other one teardown() cleans up).
  function onContextLost(e) {
    e.preventDefault();
    downgrade("WebGL context lost");
  }
  canvas.addEventListener("webglcontextlost", onContextLost);

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
    canvas.removeEventListener("webglcontextlost", onContextLost);
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
  // stacked lineup: flanks tucked close behind the middle cup's shoulders so
  // the silhouettes overlap (reference: three-cup product shot), logos angled
  // just enough to stay readable without mirroring the front cup exactly
  makeClone(-0.058, -0.075, 0.42, 1.0); // left-back shoulder
  makeClone(0.058, -0.095, -0.48, 1.0); // right-back, a touch deeper
  return { group, materials };
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

/* Binds the loaded cup GLB by the name contract: Cup, Lid, Liquid, Steam1-3.
   Mirrors buildPlaceholderCup()'s returned shape so applyState/animateSteam
   work unchanged against either. */
function adoptCupGltf(gltf, rig) {
  const g = gltf.scene;
  const find = (n) => {
    const o = g.getObjectByName(n);
    if (!o) throw new Error(`GLB missing object ${n}`);
    return o;
  };
  const cup = find("Cup");
  const lid = find("Lid");
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
    mesh.userData.baseY = mesh.position.y;
    // Return the mesh whose material was just cloned (identical to `node`
    // for every current single-material export), not `node` itself: a
    // future multi-material Steam export would make `node` a Group without
    // a .material, and applyState's `s.material.opacity = ...` would throw.
    return mesh;
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
  // Group offset frames the taller paper cup (~0.116 with lid) the way the
  // ceramic cup+saucer (~0.09) sat at -0.05.
  g.position.y = -0.06;
  rig.add(g);
  return { group: g, cup, lid, lidMaterials, liquid, steam };
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

/* clamped smoothstep over [0,1] — the shaping function behind every
   portal-entry ramp (mist dissolve, veil lift, gaze settle) */
function smooth01(x) {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

/* Binds the loaded portal GLB (PortalFrame/PortalGlass/PortalNeon/PortalSill,
   authored at real scale — 2.57m tall — in assets/models/src/koob-scene.blend)
   and stations it on the camera's approach path: arch centerline dead ahead
   at the cup journey's eye height, arch plane at PORTAL_Z so the fly-through
   physically crosses it. Also adds the glow the GLB can't carry itself:
   there's no postprocessing bloom in this pipeline, so two additive shells
   fan the neon band out into a halo, and a cyan point light kisses the
   bronze frame (emissive materials don't illuminate neighbors). */
function adoptPortalGltf(gltf, scene) {
  const g = gltf.scene;
  const find = (n) => {
    const o = g.getObjectByName(n);
    if (!o) throw new Error(`portal GLB missing object ${n}`);
    return o;
  };
  const mist = firstMesh(find("PortalGlass"));
  const neon = firstMesh(find("PortalNeon"));
  // the mist dissolves mid-journey (applyPortalState drives opacity);
  // depthWrite off keeps the fade free of self-sorting artifacts
  mist.material.transparent = true;
  mist.material.depthWrite = false;
  // 4.0, from KHR_materials_emissive_strength — the dissolve brightens from here
  const baseMistIntensity = mist.material.emissiveIntensity;
  const shells = [
    [1.04, 0.2],
    [1.085, 0.09],
  ].map(([s, opacity]) => {
    const shell = new THREE.Mesh(
      neon.geometry,
      new THREE.MeshBasicMaterial({
        color: 0x55ead0,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    // the neon band is authored portal-local about the origin, so scaling a
    // clone about that same origin fans it outward into a soft halo layer
    shell.scale.setScalar(s);
    g.add(shell);
    return shell;
  });
  const glow = new THREE.PointLight(0x66f0d8, 1.2, 1.5, 2);
  glow.position.set(0, 1.55, 0.3); // portal-local: upper arch, just in front
  g.add(glow);
  g.scale.setScalar(PORTAL_SCALE);
  g.position.set(0, PORTAL_Y, PORTAL_Z);
  scene.add(g);
  return { group: g, mist, neon, shells, glow, baseMistIntensity, baseGlow: glow.intensity };
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
