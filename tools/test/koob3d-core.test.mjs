import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldUse3D,
  pickTier,
  modelUrls,
  INITIAL_STATE,
  CHOREOGRAPHY,
  ROASTS,
  WAYPOINTS,
} from "../../js/koob3d-core.js";

test("shouldUse3D: needs WebGL and no reduced-motion", () => {
  assert.equal(shouldUse3D({ webglOk: true, reducedMotion: false }), true);
  assert.equal(shouldUse3D({ webglOk: false, reducedMotion: false }), false);
  assert.equal(shouldUse3D({ webglOk: true, reducedMotion: true }), false);
  assert.equal(shouldUse3D({ webglOk: undefined, reducedMotion: false }), false);
});

test("pickTier: narrow viewport is mobile", () => {
  assert.equal(pickTier({ viewportWidth: 390 }), "mobile");
  assert.equal(pickTier({ viewportWidth: 899 }), "mobile");
});

test("pickTier: low memory or small textures is mobile", () => {
  assert.equal(pickTier({ viewportWidth: 1440, deviceMemory: 4 }), "mobile");
  assert.equal(pickTier({ viewportWidth: 1440, maxTextureSize: 2048 }), "mobile");
});

test("pickTier: capable desktop", () => {
  assert.equal(
    pickTier({ viewportWidth: 1440, deviceMemory: 8, maxTextureSize: 16384 }),
    "desktop"
  );
  assert.equal(pickTier({ viewportWidth: 1440 }), "desktop");
});

test("modelUrls: builds tiered paths and rejects junk", () => {
  assert.deepEqual(modelUrls("mobile"), {
    cup: "assets/models/cup-mobile.glb",
    props: "assets/models/props-mobile.glb",
    portal: "assets/models/portal.glb",
  });
  assert.throws(() => modelUrls("tablet"));
});

const STATE_KEYS = [
  "cupX", "cupY", "cupZ", "cupRotX", "cupRotY", "cupScale",
  "liquidFill", "steam", "roast", "beans", "glass", "sceneOpacity",
  "portalT", "lidLift", "sideCups", "heroBg",
];
const SECTION_IDS = [
  "#hero", "#story", "#collection", "#menu",
  "#featured", "#features", "#quiz",
];

test("INITIAL_STATE has exactly the contract keys, all numbers", () => {
  assert.deepEqual(Object.keys(INITIAL_STATE).sort(), [...STATE_KEYS].sort());
  for (const k of STATE_KEYS) assert.equal(typeof INITIAL_STATE[k], "number");
});

test("CHOREOGRAPHY: unique ids, real section triggers, known keys", () => {
  const ids = CHOREOGRAPHY.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CHOREOGRAPHY) {
    if (c.trigger !== null) {
      assert.ok(SECTION_IDS.includes(c.trigger), `bad trigger ${c.trigger}`);
      assert.equal(typeof c.start, "string");
      assert.equal(typeof c.end, "string");
      assert.equal(typeof c.scrub, "number");
    }
    for (const k of Object.keys(c.to)) {
      assert.ok(STATE_KEYS.includes(k), `unknown state key ${k} in ${c.id}`);
    }
  }
});

test("CHOREOGRAPHY: normalized channels stay in [0,1], roast in range", () => {
  for (const c of CHOREOGRAPHY) {
    for (const k of ["liquidFill", "steam", "beans", "glass", "sceneOpacity", "portalT", "lidLift", "sideCups", "heroBg"]) {
      if (k in c.to) assert.ok(c.to[k] >= 0 && c.to[k] <= 1, `${c.id}.${k}`);
    }
    if ("roast" in c.to) {
      assert.ok(c.to.roast >= 0 && c.to.roast <= ROASTS.length - 1);
    }
  }
});

test("ROASTS: three roasts with hex colors", () => {
  assert.equal(ROASTS.length, 3);
  for (const r of ROASTS) {
    assert.match(r.body, /^#[0-9a-f]{6}$/i);
    assert.match(r.surface, /^#[0-9a-f]{6}$/i);
  }
});

const KNOWN_EFFECTS = ["goldBurst"];

test("WAYPOINTS: unique ids, valid section triggers, known effects", () => {
  const ids = WAYPOINTS.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
  const validTriggers = [...SECTION_IDS, "#newsletter"];
  for (const w of WAYPOINTS) {
    assert.ok(validTriggers.includes(w.trigger), `bad trigger ${w.trigger}`);
    assert.equal(typeof w.start, "string");
    assert.ok(KNOWN_EFFECTS.includes(w.effect), `unknown effect ${w.effect}`);
  }
});

test("hero: lid lifts first, fill takes over at the same scroll point", () => {
  const ids = CHOREOGRAPHY.map((c) => c.id);
  assert.ok(!ids.includes("hero"), "old monolithic hero entry should be gone");
  const lid = CHOREOGRAPHY.find((c) => c.id === "heroLid");
  const fill = CHOREOGRAPHY.find((c) => c.id === "heroFill");
  assert.ok(lid && fill);
  assert.equal(lid.trigger, "#hero");
  assert.equal(fill.trigger, "#hero");
  assert.deepEqual(Object.keys(lid.to), ["lidLift"]);
  assert.equal(lid.to.lidLift, 1);
  assert.equal(lid.end, fill.start); // phase handoff, no gap and no overlap
  assert.equal(fill.to.liquidFill, 1);
  assert.equal(fill.to.steam, 1);
});

test("heroLeave fades the side cups and teal backdrop before story copy", () => {
  const leave = CHOREOGRAPHY.find((c) => c.id === "heroLeave");
  assert.ok(leave);
  assert.equal(leave.to.sideCups, 0);
  assert.equal(leave.to.heroBg, 0);
  // single-writer: no other entry touches these hero-only channels
  for (const c of CHOREOGRAPHY) {
    if (c.id === "heroLeave") continue;
    assert.ok(!("sideCups" in c.to), `${c.id} writes sideCups`);
    assert.ok(!("heroBg" in c.to), `${c.id} writes heroBg`);
  }
});

test("portal entry is a time-based overlay flight, not scroll-driven", () => {
  const portal = CHOREOGRAPHY.find((c) => c.id === "portalEntry");
  assert.ok(portal);
  assert.equal(portal.trigger, null);
  assert.equal(typeof portal.duration, "number");
  assert.equal(portal.to.portalT, 1);
});

test("the glass prop is retired: no entry ever shows it", () => {
  for (const c of CHOREOGRAPHY) {
    assert.ok(!(c.to.glass > 0), `${c.id} raises glass`);
  }
});
