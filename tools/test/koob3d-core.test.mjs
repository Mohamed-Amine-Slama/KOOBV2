import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldUse3D,
  pickTier,
  modelUrls,
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
  });
  assert.throws(() => modelUrls("tablet"));
});
