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
  "portalT",
];
const SECTION_IDS = [
  "#portal-entry", "#hero", "#story", "#collection", "#menu",
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
    for (const k of ["liquidFill", "steam", "beans", "glass", "sceneOpacity", "portalT"]) {
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
