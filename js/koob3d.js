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
  camera.position.set(0, 0.22, 0.55);
  // downward tilt toward the cup's rest height so the open rim (and the
  // liquid filling inside it) reads on screen instead of being viewed edge-on
  camera.lookAt(0, -0.05, 0);

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
