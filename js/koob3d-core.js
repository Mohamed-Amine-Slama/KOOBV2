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
