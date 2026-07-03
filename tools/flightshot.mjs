/* Capture the portal flight mid-animation: screenshots at fixed wall-clock
   times after load instead of after networkidle+5s like tools/shot.mjs. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:8123/", { waitUntil: "domcontentloaded" });
let elapsed = 0;
for (const t of [2600, 3400, 4200, 5600]) {
  await page.waitForTimeout(t - elapsed);
  elapsed = t;
  await page.screenshot({ path: `shots/flight-${t}.png` });
  console.log(`shots/flight-${t}.png portalT=`, await page.evaluate(() => window.__koob3d?.state?.portalT?.toFixed(2)));
}
if (errors.length) { console.error("CONSOLE ERRORS:\n" + errors.join("\n")); process.exit(1); }
await browser.close();
