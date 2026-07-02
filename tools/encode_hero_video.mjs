// KOOB hero video encoder — makes a SCROLL-SCRUBBABLE clip + poster + empty frame.
// Scrubbing seeks video.currentTime, so we encode dense keyframes (-g) + faststart.
//
//   npm i -D ffmpeg-static            # one-time
//   node tools/encode_hero_video.mjs raw/hero-fill.mp4
//
// Outputs: assets/hero-fill.mp4, assets/hero-fill.webm, assets/hero-cup-poster.webp, assets/hero-cup-empty.webp
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { mkdirSync } from 'node:fs';

const input = process.argv[2];
if (!input) { console.error('usage: node tools/encode_hero_video.mjs <input.mp4>'); process.exit(1); }
mkdirSync('assets', { recursive: true });
const run = (args) => { console.log('ffmpeg', args.join(' ')); execFileSync(ffmpegPath, args, { stdio: 'inherit' }); };

// H.264 MP4 — iOS-required. -g 6 = keyframe ~every 0.2s (smooth seek, reasonable size). Use -g 1 for buttery scrub if size allows.
run(['-y','-i',input,'-an','-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p',
     '-vf','scale=-2:720','-g','6','-keyint_min','6','-sc_threshold','0','-crf','23',
     '-movflags','+faststart','assets/hero-fill.mp4']);
// VP9 WebM — smaller for Chrome/Firefox.
run(['-y','-i',input,'-an','-c:v','libvpx-vp9','-vf','scale=-2:720','-g','6','-crf','30','-b:v','0','assets/hero-fill.webm']);
// Poster = LAST frame (full cup) — this is the LCP image + fallback "full" state.
run(['-y','-sseof','-0.1','-i',input,'-vframes','1','-vf','scale=-2:760','assets/_poster.png']);
// Empty = FIRST frame (empty cup) — fallback "empty" state for the crossfade.
run(['-y','-i',input,'-vframes','1','-vf','scale=-2:760','assets/_empty.png']);
console.log('Now: python3 tools/optimize_image.py assets/_poster.png assets/hero-cup-poster.webp 760 86');
console.log('     python3 tools/optimize_image.py assets/_empty.png  assets/hero-cup-empty.webp  760 86');
