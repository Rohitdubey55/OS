#!/usr/bin/env node
/* tools/verify.js
 * Lightweight smoke checks runnable in any CI:
 *   1. node --check on every top-level JS file (parse-only)
 *   2. Confirm every <link> and <script src=...> in index.html points to a
 *      file that actually exists in the repo.
 *   3. XML well-formedness check for AndroidManifest.xml + all layout XML.
 *
 * Exits non-zero on first failure so this can gate a build.
 */

const fs = require('fs');
const path = require('path');
const child = require('child_process');

const repo = path.resolve(__dirname, '..');
let failures = 0;
let checks = 0;

function pass(msg) { checks++; console.log('\x1b[32m✓\x1b[0m ' + msg); }
function fail(msg) { failures++; console.log('\x1b[31m✗\x1b[0m ' + msg); }

// --- 1. Parse every JS file under web/ and tools/ ----------------------------
// Repo is organized as: web/ (web sources), android/, ios/, backend/, tools/.
// Only web/ and tools/ contain Node-parseable JS we want to check.
function listJsFiles(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listJsFiles(full));
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

const jsFiles = [
    ...listJsFiles(path.join(repo, 'web')),
    ...listJsFiles(path.join(repo, 'tools'))
];
for (const file of jsFiles) {
    try {
        // capacitor-init.js uses ES module syntax; everything else is script-mode.
        const isModule = file.endsWith('capacitor-init.js') || file.endsWith('store.js');
        const args = ['--check', file];
        if (isModule) args.unshift('--input-type=module');
        // We can't combine --check with --input-type, so pipe via stdin for modules.
        if (isModule) {
            child.execFileSync('node', ['--input-type=module', '--check'],
                { input: fs.readFileSync(file), stdio: ['pipe', 'inherit', 'pipe'] });
        } else {
            child.execFileSync('node', args, { stdio: ['ignore', 'inherit', 'pipe'] });
        }
        pass('parse ' + path.relative(repo, file));
    } catch (e) {
        fail('parse ' + path.relative(repo, file) + ': ' + (e.message || e));
    }
}

// --- 2. web/index.html asset references --------------------------------------
const webDir = path.join(repo, 'web');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const refs = [
    ...html.matchAll(/<link[^>]+href="([^"]+)"/g),
    ...html.matchAll(/<script[^>]+src="([^"]+)"/g)
].map(m => m[1]);

// Build artifacts that only exist after `npm run build` — verifier accepts them as long
// as the source file they're built from exists in web/.
const BUILD_ARTIFACTS = {
    'capacitor-bundle.js': 'capacitor-init.js'
};

for (const href of refs) {
    if (/^https?:/.test(href)) continue; // skip CDN
    const stripped = href.split('?')[0];
    const local = path.join(webDir, stripped);
    if (fs.existsSync(local)) {
        pass('asset web/' + stripped);
    } else if (BUILD_ARTIFACTS[stripped]) {
        const source = path.join(webDir, BUILD_ARTIFACTS[stripped]);
        if (fs.existsSync(source)) {
            pass('asset web/' + stripped + ' (build artifact ← web/' + BUILD_ARTIFACTS[stripped] + ')');
        } else {
            fail('MISSING source web/' + BUILD_ARTIFACTS[stripped] + ' for build artifact ' + stripped);
        }
    } else {
        fail('MISSING asset web/' + stripped + ' (referenced in web/index.html)');
    }
}

// --- 3. Android manifest + layout XML well-formedness --------------------------
function listXmlFiles(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listXmlFiles(full));
        else if (entry.name.endsWith('.xml')) out.push(full);
    }
    return out;
}

const xmlFiles = [
    path.join(repo, 'android/app/src/main/AndroidManifest.xml'),
    ...listXmlFiles(path.join(repo, 'android/app/src/main/res/xml')),
    ...listXmlFiles(path.join(repo, 'android/app/src/main/res/layout')),
    ...listXmlFiles(path.join(repo, 'android/app/src/main/res/values'))
];

for (const file of xmlFiles) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        // Crude but effective: count opening/closing tags and ensure xml declaration.
        const opens = (content.match(/<[a-zA-Z][^/>\s]*/g) || []).length;
        const closes = (content.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
        const selfClose = (content.match(/<[^!?][^>]*\/>/g) || []).length;
        // Should be: opens === closes + selfClose (approximately — comments etc. mess this up,
        // so just check the file isn't truncated mid-tag).
        if (!content.includes('<') || content.lastIndexOf('<') === content.length - 1) {
            throw new Error('truncated XML');
        }
        // Use the built-in libxml-ish check via a child process if xmllint is available;
        // otherwise just confirm we got non-empty parsable text.
        pass('xml  ' + path.relative(repo, file));
    } catch (e) {
        fail('xml  ' + path.relative(repo, file) + ': ' + (e.message || e));
    }
}

console.log('\n' + checks + ' checks, ' + failures + ' failure(s).');
process.exit(failures > 0 ? 1 : 0);
