/**
 * Post-processes the single-file build.
 *
 * Vite emits `<script type="module" crossorigin>`. The `crossorigin`
 * attribute is meaningless on an inline script, but some browsers treat it
 * strictly, so we strip it. The bundle contains no imports, no dynamic
 * imports and no `import.meta`, so it runs happily from a `file://` URL.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'dist-single/index.html');
let html = readFileSync(file, 'utf8');

const before = html;
html = html.replace('<script type="module" crossorigin>', '<script type="module">');
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');

if (html === before) {
  console.warn('[single-file] nothing to rewrite — the script tag may have changed shape');
} else {
  writeFileSync(file, html, 'utf8');
  console.log('[single-file] cleaned up the script tag');
}

// Copy the "how to play" note next to the game.
const shareDir = resolve(process.cwd(), 'share');
if (existsSync(shareDir)) {
  mkdirSync(resolve(process.cwd(), 'dist-single'), { recursive: true });
  for (const name of readdirSync(shareDir)) {
    copyFileSync(resolve(shareDir, name), resolve(process.cwd(), 'dist-single', name));
  }
  console.log('[single-file] copied the notes from share/');
}

const size = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`[single-file] dist-single/index.html — ${size} KB, self-contained`);
