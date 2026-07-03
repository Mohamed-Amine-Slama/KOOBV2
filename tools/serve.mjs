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
// An explicit PORT is honored exactly; the default hops to the next free
// port when 8123 is taken (a second `npm run serve`, a screenshot run's
// server still up) instead of crashing with an EADDRINUSE stack trace.
const PORT = Number(process.env.PORT) || 8123;
const PORT_IS_EXPLICIT = Boolean(process.env.PORT);
const MAX_PORT_HOPS = 10;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".ktx2": "image/ktx2",
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

const server = createServer(async (req, res) => {
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
});

let port = PORT;
server.on("error", (err) => {
  if (err.code !== "EADDRINUSE") throw err;
  if (PORT_IS_EXPLICIT || port >= PORT + MAX_PORT_HOPS) {
    console.error(
      `Port ${port} is already in use — is the dev server already running?\n` +
        `Stop it, or pick another port: PORT=${port + 1} npm run serve`
    );
    process.exit(1);
  }
  console.warn(`Port ${port} in use, trying ${port + 1}…`);
  port += 1;
  server.listen(port);
});

server.listen(port, () => {
  console.log(`KOOB dev server → http://localhost:${port}/`);
  console.log("(Ctrl+C to stop)");
});
