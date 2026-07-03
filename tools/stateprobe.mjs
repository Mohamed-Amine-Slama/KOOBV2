/* Debug probe: scroll to a position and dump koob3d state + ScrollTrigger
   progress for the state-driven scrub tweens. Usage: node tools/stateprobe.mjs [scrollY] */
import { chromium } from "playwright";

const scrollY = Number(process.argv[2] ?? 6500);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.error("PAGEERROR", String(e)));

await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
await page.evaluate((y) => window.scrollTo(0, y), scrollY);
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const s = window.__koob3d?.state;
  const sts = (window.ScrollTrigger?.getAll() || []).map((st) => ({
    trig: st.trigger?.id || st.trigger?.className || "?",
    start: Math.round(st.start),
    end: Math.round(st.end),
    prog: +st.progress.toFixed(2),
  }));
  return {
    scrollY: window.scrollY,
    state: Object.fromEntries(
      Object.entries(s).map(([k, v]) => [k, +(+v).toFixed(2)])
    ),
    triggers: sts,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
// settled screenshot appended by verification run
