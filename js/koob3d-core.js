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
    // one file serves both tiers: 14k tris / ~1.9MB with embedded baked textures
    portal: "assets/models/portal.glb",
  };
}

/* One state object drives the whole scene. GSAP ScrollTriggers (built from
   CHOREOGRAPHY in koob3d.js) tween it; the render loop applies it. */
export const INITIAL_STATE = {
  cupX: 1.1, cupY: -0.2, cupZ: 0,
  cupRotX: -0.1, cupRotY: -0.4, cupScale: 1,
  liquidFill: 0.05, steam: 0, roast: 2,
  beans: 0, glass: 0, sceneOpacity: 0,
  // 0 = camera far out in the dark, facing the portal; 1 = through the arch,
  // settled at the cup journey's fixed vantage. Everything about the entry
  // (camera dolly, mist dissolve, veil/flash DOM layers) derives from this one
  // scalar in koob3d.js's applyPortalState().
  portalT: 0,
  // 0 = lid seated on the middle cup, 1 = lifted clear (heroLid scrubs it).
  // sideCups: 1 = hero trio flanks visible, 0 = faded out (story scrubs it).
  lidLift: 0, sideCups: 1,
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
  /* #portal-entry is a 260vh scroll runway above #hero that only exists in 3D
     mode (display gated on html.has-3d). Scrubbing portalT 0→1 flies the
     camera through the portal arch; the page underneath is hidden by the
     #portal-veil overlay until the crossing, so the site "appears inside" the
     portal. Ends at "bottom top": portalT hits 1 exactly when #hero reaches
     the top of the viewport and the cup journey takes over. */
  { id: "portalEntry", trigger: "#portal-entry", start: "top top", end: "bottom top",
    scrub: 0.8, to: { portalT: 1 } },
  /* The hero scrub is two phases with a shared boundary at 40% of the
     section: first the middle cup's lid lifts away, then — only once the cup
     is open — the coffee fills and the steam rises. Splitting entries (rather
     than staggering one tween) keeps every channel single-writer, same rule
     as the steam-scrub-conflict fix above. */
  { id: "heroLid", trigger: "#hero", start: "top top", end: "40% top",
    scrub: 1.2, to: { lidLift: 1 } },
  { id: "heroFill", trigger: "#hero", start: "40% top", end: "bottom top",
    scrub: 1.2, to: { liquidFill: 1, steam: 1, cupRotY: 0.5, cupRotX: -0.16 } },
  { id: "story", trigger: "#story", start: "top 85%", end: "bottom 40%",
    scrub: 1.2, to: { cupX: -1.15, cupScale: 0.55, beans: 1, roast: 0, sideCups: 0 } },
  { id: "collection", trigger: "#collection", start: "top top", end: "bottom bottom",
    scrub: 1, to: { cupX: 0, cupY: -0.1, cupScale: 1.15, cupRotY: 6.78, roast: 2, beans: 0.35 } },
  { id: "menu", trigger: "#menu", start: "top 70%", end: "top 15%",
    scrub: 1, to: { sceneOpacity: 0, cupScale: 0.5, steam: 0, beans: 0 } },
  { id: "featured", trigger: "#featured", start: "top 60%", end: "bottom bottom",
    scrub: 1, to: { glass: 1, sceneOpacity: 1 } },
  /* cup parks in the standard-panel's clear bottom-right corner (below the
     chapter copy, right of the ticks) — dead center put it straight over the
     chapter titles, which the section's pinned crossfade keeps at screen
     center for its whole 288% pin range */
  { id: "features", trigger: "#features", start: "top 80%", end: "center center",
    scrub: 1, to: { sceneOpacity: 1, cupX: 1.0, cupY: -0.62, cupScale: 0.72, cupRotY: 0, steam: 1, glass: 0 } },
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
