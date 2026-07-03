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

if (root.classList.contains("has-3d")) boot();

// scratch object reused by animateBeans so the ticker never allocates
const beanEuler = new THREE.Euler();

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
  scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
  scene.environmentIntensity = 0.06;
  pmrem.dispose();

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
  const invalidate = () => { needsRender = true; };

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

  window.__koob3d = { state, scene, renderer, tier, goldBurst };

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
  window.gsap.ticker.add(() => {
    if (!needsRender || state.sceneOpacity <= 0.001) return;
    needsRender = false;
    applyState();
    animateSteam(cupParts.steam);
    if (propParts) animateBeans(propParts);
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
          fastScrollEnd: true,
        },
      });
    }
  }

  /* ---- WAYPOINTS: one-shot effects layered on top of the scrub tweens
     above. Each entry gets its own ScrollTrigger (onEnter, not scrubbed) so
     the effect fires exactly once as the reader crosses the milestone. */
  for (const w of WAYPOINTS) {
    if (w.effect === "goldBurst") {
      window.ScrollTrigger.create({
        trigger: w.trigger,
        start: w.start,
        onEnter: () => triggerGoldBurst(goldBurst, invalidate),
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
  const steam = ["Steam1", "Steam2", "Steam3"].map((n) => {
    const node = find(n);
    const mesh = firstMesh(node);
    // GLTFLoader de-dupes identical materials across nodes, so all three
    // Steam1-3 planes arrive sharing one material instance: without cloning,
    // applyState's per-plane opacity gradient (0.50/0.38/0.26) just has each
    // plane overwrite the same .opacity in turn, and every plane ends up at
    // whatever the last one set it to.
    mesh.material = mesh.material.clone();
    mesh.material.transparent = true;
    mesh.material.depthWrite = false;
    mesh.material.opacity = 0;
    node.userData.baseY = node.position.y;
    return node; // node === mesh for every current export (single material)
  });
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
  glass.position.set(0.28, -0.1, -0.1);
  // Glass is MeshPhysicalMaterial with transmission — captured before any
  // scale mutation so applyState's fade-in ramps toward the authored size,
  // not toward whatever scale happened to be set last.
  const glassBaseScale = glass.scale.x || 1;
  scene.add(beans, glass, portafilter);
  return { beans, seeds, glass, portafilter, glassBaseScale, m, q, p, s };
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
