#!/usr/bin/env node
/* tools/analyze-css.js
 *
 * CSS analysis report: total payload, duplicate selectors across files,
 * and the top heaviest stylesheets. Does NOT modify anything — output is
 * a guide for manual consolidation.
 *
 * Usage:   node tools/analyze-css.js
 */

const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const webDir = path.join(repo, 'web');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const cssFiles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)]
    .map(m => m[1])
    .filter(href => !/^https?:/.test(href));

console.log('CSS files referenced from index.html:', cssFiles.length);
console.log();

// 1. Sizes
let total = 0;
const sizes = [];
for (const rel of cssFiles) {
    const p = path.join(webDir, rel);
    if (!fs.existsSync(p)) { console.log('  MISSING', rel); continue; }
    const bytes = fs.statSync(p).size;
    total += bytes;
    sizes.push({ rel, bytes });
}
sizes.sort((a, b) => b.bytes - a.bytes);

console.log('=== Top 10 heaviest stylesheets ===');
for (const { rel, bytes } of sizes.slice(0, 10)) {
    console.log('  ' + (bytes / 1024).toFixed(1).padStart(6) + ' KB   ' + rel);
}
console.log('  ──────────');
console.log('  ' + (total / 1024).toFixed(1).padStart(6) + ' KB   total uncompressed');
console.log();

// 2. Duplicate selectors
// Strip comments, then extract each rule head (everything before {).
const selectorMap = new Map(); // selector → [files]
const SELECTOR_RE = /([^{}@/]+)\{[^{}]*\}/g;
const KEYFRAMES_RE = /@(keyframes|-webkit-keyframes|-moz-keyframes)[^{]+\{(?:[^{}]+\{[^{}]+\})*[^{}]*\}/g;

for (const { rel } of sizes) {
    const p = path.join(webDir, rel);
    let src = fs.readFileSync(p, 'utf8');
    // Strip /* ... */ comments
    src = src.replace(/\/\*[\s\S]*?\*\//g, '');
    // Strip @keyframes blocks (have nested braces that break the simple selector regex)
    src = src.replace(KEYFRAMES_RE, '');
    // Pull each top-level rule's selector list
    let m;
    while ((m = SELECTOR_RE.exec(src)) !== null) {
        const head = m[1].trim();
        if (!head || head.startsWith('@')) continue;
        // Split comma-separated selector lists into individual selectors
        for (const sel of head.split(',').map(s => s.trim()).filter(Boolean)) {
            if (sel.length > 200) continue; // skip absurdly long ones
            if (!selectorMap.has(sel)) selectorMap.set(sel, new Set());
            selectorMap.get(sel).add(rel);
        }
    }
}

const dupes = [...selectorMap.entries()]
    .filter(([, files]) => files.size >= 2)
    .map(([sel, files]) => ({ sel, files: [...files] }))
    .sort((a, b) => b.files.length - a.files.length);

console.log('=== Top duplicated selectors (defined in 2+ files) ===');
console.log('  (' + dupes.length + ' selectors appear in multiple files)');
console.log();
for (const { sel, files } of dupes.slice(0, 25)) {
    console.log('  [' + files.length + ']  ' + sel);
    for (const f of files) console.log('        - ' + f);
}
console.log();

// 3. Suggest consolidation candidates
const SMALL = 5 * 1024; // 5 KB
const small = sizes.filter(s => s.bytes < SMALL);
if (small.length >= 2) {
    console.log('=== Small files that could be merged into one ===');
    console.log('  (Each under 5 KB — combining them saves request overhead)');
    let combinedBytes = 0;
    for (const { rel, bytes } of small) {
        combinedBytes += bytes;
        console.log('  ' + (bytes / 1024).toFixed(1).padStart(5) + ' KB   ' + rel);
    }
    console.log('  ──────────');
    console.log('  ' + (combinedBytes / 1024).toFixed(1).padStart(5) + ' KB   combined');
    console.log();
}

console.log('=== Recommendations ===');
console.log('  · ' + (cssFiles.length) + ' stylesheets = ' + cssFiles.length + ' HTTP requests on cold start');
console.log('  · Highest-ROI move: bundle all of these into a single www/styles.bundle.css');
console.log('    via the new `npm run build:css-bundle` script (added in Phase 7).');
console.log('  · Then replace the 22 <link> tags in index.html with a single one.');
console.log('  · Before bundling, audit the top duplicated selectors above for');
console.log('    contradictory rules — cascade order will shift inside the bundle.');
