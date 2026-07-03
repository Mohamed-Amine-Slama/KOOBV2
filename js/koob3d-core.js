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
  cupX: 0.88, cupY: -0.24, cupZ: 0,
  cupRotX: -0.1, cupRotY: -0.4, cupScale: 1.3,
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
  // Brand-teal backdrop the canvas paints behind the hero trio (the #hero DOM
  // is transparent under has-3d so the cups can render in front of it). Gated
  // in koob3d.js by portalT so the portal flight stays in the dark void; the
  // story scrub fades it back out to the page's deep-void backdrop.
  heroBg: 1,
};

/* Liquid colors per collection slide, matching the existing
   white/milk/dark-coffee.webp renders: 0=Latte 1=Americano 2=Espresso */
export const ROASTS = [
  { name: "latte", body: "#d7b08a", surface: "#e8cfae" },
  { name: "americano", body: "#7a4a2b", surface: "#a9744a" },
  { name: "espresso", body: "#3c2414", surface: "#8a5a30" },
];

/* trigger:null = time-based tween at load (delay/ease optional, see the
   tween-creation loop in koob3d.js), not scroll-driven.
   cupRotY 6.78 ≈ 0.5 + 2π: one full extra turn through the collection. */
export const CHOREOGRAPHY = [
  { id: "boot", trigger: null, to: { sceneOpacity: 1 }, duration: 1.0, delay: 2.0 },
  /* The portal entry is a time-based overlay flight, not a scroll runway:
     #hero sits at the top of the page and the #portal-veil hides it while
     the camera flies through the arch, so the site "appears inside" the
     portal the moment the flight lands. koob3d.js creates this tween paused
     and plays it only once the GLBs are adopted and shaders are compiled
     (never on a wall clock — with Lenis's lagSmoothing(0), load-time main-
     thread stalls would jump a delayed tween straight to its end), holding
     at least until the preloader clears. Scrolling stays locked (Lenis
     stopped) until its onComplete releases it. */
  { id: "portalEntry", trigger: null, duration: 2.4,
    ease: "power2.inOut", to: { portalT: 1 } },
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
    scrub: 1.2, to: { cupX: -1.15, cupScale: 0.55, beans: 1, roast: 0 } },
  /* The hero trio's flanks and the canvas-painted teal backdrop both belong
     to the hero alone — they finish fading before the story copy arrives
     (a tighter range than story's own, which keeps ghost cups from lingering
     over the chapter text). Separate entry so story's long scrub never
     re-writes these channels. */
  { id: "heroLeave", trigger: "#story", start: "top bottom", end: "top 55%",
    scrub: 0.8, to: { sideCups: 0, heroBg: 0 } },
  { id: "collection", trigger: "#collection", start: "top top", end: "bottom bottom",
    scrub: 1, to: { cupX: 0, cupY: -0.1, cupScale: 1.15, cupRotY: 6.78, roast: 2, beans: 0.35 } },
  { id: "menu", trigger: "#menu", start: "top 70%", end: "top 15%",
    scrub: 1, to: { sceneOpacity: 0, cupScale: 0.5, steam: 0, beans: 0 } },
  /* No entry for #featured: the glass prop that used to fade in there is
     retired, and the scene stays dark (menu's sceneOpacity 0 holds) until
     the cup returns for #features below — restoring opacity over #featured
     just floated the parked cup over the drink cards. */
  /* cup parks in the standard-panel's clear bottom-right corner (below the
     chapter copy, right of the ticks) — dead center put it straight over the
     chapter titles, which the section's pinned crossfade keeps at screen
     center for its whole 288% pin range */
  { id: "features", trigger: "#features", start: "top 80%", end: "center center",
    scrub: 1, to: { sceneOpacity: 1, cupX: 1.0, cupY: -0.62, cupScale: 0.72, cupRotY: 0, steam: 1 } },
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
