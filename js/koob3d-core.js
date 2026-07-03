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
    scrub: 1.2, to: { cupX: -1.15, cupScale: 0.55, beans: 1, roast: 0 } },
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

/* One-shot moments layered on top of the scrubbed CHOREOGRAPHY above: a
   ScrollTrigger per entry fires `effect` once via onEnter (not scrubbed).
   cupFull lands near the end of the hero fill; quizEnter greets the reader
   as the quiz section arrives. */
export const WAYPOINTS = [
  { id: "cupFull", trigger: "#hero", start: "bottom 25%", effect: "goldBurst" },
  { id: "quizEnter", trigger: "#quiz", start: "top 60%", effect: "goldBurst" },
];
