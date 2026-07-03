/* Debug probe: dump portalT + every GSAP tween on the state object over time. */
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.error("PAGEERROR", String(e)));

await page.goto("http://localhost:8123/", { waitUntil: "domcontentloaded" });
let elapsed = 0;
for (const t of [600, 1500, 2500, 3500, 4600, 6000]) {
  await page.waitForTimeout(t - elapsed);
  elapsed = t;
  const info = await page.evaluate(() => {
    const s = window.__koob3d?.state;
    if (!s) return { noState: true };
    const tweens = (window.gsap?.getTweensOf(s) || []).map((tw) => ({
      keys: Object.keys(tw.vars).filter((k) => k in s).join(","),
      dur: tw.duration(),
      prog: +tw.progress().toFixed(3),
      paused: tw.paused(),
      active: tw.isActive(),
    }));
    return {
      portalT: +s.portalT.toFixed(3),
      sceneOpacity: +s.sceneOpacity.toFixed(3),
      portalActive: document.documentElement.classList.contains("portal-active"),
      scrollY: window.scrollY,
      tweens,
    };
  });
  console.log(t, JSON.stringify(info));
}
await browser.close();
