/* Swap the paper-cup albedo inside the raw cup GLBs with the current
   assets/models/src/paper_col.png — re-texturing without a Blender roundtrip.
   The raws are uncompressed (Draco/KTX2 happen in the gltf-transform optimize
   step afterwards), so no decoder plumbing is needed here.

   Usage: node tools/swap_cup_texture.mjs */
import { NodeIO } from "@gltf-transform/core";
import { readFileSync } from "node:fs";

const PNG = "assets/models/src/paper_col.png";
const RAWS = [
  "assets/models/src/cup-desktop-raw.glb",
  "assets/models/src/cup-mobile-raw.glb",
];

const png = readFileSync(PNG);
const io = new NodeIO();

for (const path of RAWS) {
  const doc = await io.read(path);
  const paper = doc
    .getRoot()
    .listMaterials()
    .find((m) => m.getName() === "Paper");
  if (!paper) throw new Error(`${path}: no material named Paper`);
  const tex = paper.getBaseColorTexture();
  if (!tex) throw new Error(`${path}: Paper has no baseColorTexture`);
  tex.setImage(png).setMimeType("image/png");
  await io.write(path, doc);
  console.log(`${path}: swapped Paper baseColor <- ${PNG} (${png.length} bytes)`);
}
