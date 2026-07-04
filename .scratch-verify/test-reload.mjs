/* Reload-mid-page test: goto /, wait 6s, scroll to 12000, wait, reload,
   wait 6s, assert sceneOpacity < 0.05 and portal-active is false. Also
   confirm normal top-of-page load still works (portalT 0, arch visible). */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();

// ---- Part A: normal top-of-page load ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);
  const portalT = await page.evaluate(() => window.__koob3d?.state?.portalT);
  const hasPortalActive = await page.evaluate(() =>
    document.documentElement.classList.contains("portal-active"));
  console.log("TOP-LOAD portalT:", portalT, "portal-active:", hasPortalActive);
  await page.screenshot({ path: "shots/reload-test-top-load.png" });
  if (errors.length) console.error("TOP-LOAD console errors:\n" + errors.join("\n"));
  await page.close();
}

// ---- Part B: reload mid-page ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.scrollTo(0, 12000));
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(6000);

  const sceneOpacity = await page.evaluate(() => window.__koob3d?.state?.sceneOpacity);
  const portalActive = await page.evaluate(() =>
    document.documentElement.classList.contains("portal-active"));
  const scrollY = await page.evaluate(() => window.scrollY);

  console.log("RELOAD scrollY:", scrollY);
  console.log("RELOAD sceneOpacity:", sceneOpacity);
  console.log("RELOAD portal-active:", portalActive);
  await page.screenshot({ path: "shots/reload-test-mid-page.png" });

  if (errors.length) {
    console.error("RELOAD console errors:\n" + errors.join("\n"));
  }

  const pass = sceneOpacity < 0.05 && portalActive === false;
  console.log(pass ? "RELOAD TEST: PASS" : "RELOAD TEST: FAIL");
  if (!pass) process.exitCode = 1;
  await page.close();
}

await browser.close();
