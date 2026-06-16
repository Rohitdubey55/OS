#!/usr/bin/env node
/* tools/bundle-css.js
 *
 * Concatenates every CSS file referenced from index.html, in the exact order
 * they appear, into a single www/styles.bundle.css. Preserves cascade order.
 *
 * Run via `npm run build:css-bundle` after `npm run build:css`.
 * Output is OPT-IN — you have to swap the 22 <link> tags in index.html for a
 * single <link href="styles.bundle.css"> to actually use the bundle.
 */

const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const webDir = path.join(repo, 'web');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const cssFiles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)]
    .map(m => m[1])
    .filter(href => !/^https?:/.test(href));

const outDir = path.join(repo, 'www');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const parts = [];
let totalIn = 0;
for (const rel of cssFiles) {
    const src = path.join(webDir, rel);
    if (!fs.existsSync(src)) {
        console.warn('  skip (missing):', rel);
        continue;
    }
    const content = fs.readFileSync(src, 'utf8');
    parts.push('/* ===== ' + rel + ' ===== */');
    parts.push(content);
    totalIn += content.length;
}

const bundled = parts.join('\n');
const outFile = path.join(outDir, 'styles.bundle.css');
fs.writeFileSync(outFile, bundled);

console.log('Bundled', cssFiles.length, 'stylesheets →', path.relative(repo, outFile));
console.log('  input:  ' + (totalIn / 1024).toFixed(1) + ' KB');
console.log('  output: ' + (bundled.length / 1024).toFixed(1) + ' KB');
console.log();
console.log('To use the bundle, replace all <link rel="stylesheet" href="*.css"> in');
console.log('index.html with a single:');
console.log('  <link rel="stylesheet" href="styles.bundle.css">');
