/* Zero-dependency static server for local development.
   Usage: npm start   →   http://localhost:8123/

   Why this exists: the site cannot run from file:// (double-clicking
   index.html). Browsers block ES-module imports and the GLB fetches under
   file:// security rules, so the 3D layer downgrades to the legacy page.
   Python's http.server works on WSL/macOS but on Windows it often serves
   .js as text/plain (registry MIME lookup), which also breaks ES modules —
   hence a tiny Node server with an explicit MIME map. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT) || 8123;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let rel = normalize(urlPath).replace(/^([/\\])+/, "");
    if (rel === "" || rel.endsWith("/") || rel.endsWith(sep)) rel += "index.html";
    // normalize() collapses any ../ — reject anything that still escapes
    if (rel.split(sep).includes("..")) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, {
      "content-type": MIME[extname(rel).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-cache", // always revalidate — dev server
    });
    res.end(body);
  } catch (err) {
    res.writeHead(err?.code === "ENOENT" ? 404 : 500).end("not found");
  }
}).listen(PORT, () => {
  console.log(`KOOB dev server → http://localhost:${PORT}/`);
  console.log("(Ctrl+C to stop)");
});
