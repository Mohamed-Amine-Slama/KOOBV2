/* Screenshot the site at given scroll offsets, capturing console errors.
   Usage: node tools/shot.mjs [url] [comma-separated scrollY list] [--mobile] */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:8123/";
const scrolls = (process.argv[3] ?? "0").split(",").map(Number);
const mobile = process.argv.includes("--mobile");
mkdirSync("shots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
});
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(5000); // preloader + boot tween
for (const y of scrolls) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(1500); // let scrub catch up
  const tag = mobile ? `m${y}` : `d${y}`;
  await page.screenshot({ path: `shots/shot-${tag}.png` });
  console.log(`shots/shot-${tag}.png`);
}
console.log("has-3d:", await page.evaluate(() =>
  document.documentElement.classList.contains("has-3d")));
console.log("tier:", await page.evaluate(() => window.__koob3d?.tier));
if (errors.length) { console.error("CONSOLE ERRORS:\n" + errors.join("\n")); process.exit(1); }
await browser.close();
