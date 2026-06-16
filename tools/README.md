# `tools/` — build & verification scripts

Node-only utility scripts. They have no external dependencies (`fs`, `path`, `child_process` from Node stdlib only) so they run in any CI environment.

## Files

```
tools/
├── verify.js        ← npm run verify  — XML well-formedness + JS parse + asset refs
├── analyze-css.js   ← npm run analyze:css  — duplicate selector report across web/*.css
└── bundle-css.js    ← npm run build:css-bundle  — concat all CSS into www/styles.bundle.css
```

## `verify.js` — the smoke check

Runs three things and exits non-zero on any failure:

1. **Parses every `.js` file under `web/` and `tools/`** with `node --check`. Catches syntax errors before the build.
2. **Confirms every `<link href>` and `<script src>` in `web/index.html` points to a real file.** Catches dead asset references.
3. **XML well-formedness on `android/app/src/main/AndroidManifest.xml` plus all `res/xml/`, `res/layout/`, `res/values/` XML files.** Catches broken manifest edits, malformed widget layouts, etc.

Run after every meaningful change:

```bash
npm run verify
```

Should report `0 failure(s)`. If something fails, the offending file is named in the output.

### Build artifacts whitelist

`www/capacitor-bundle.js` is referenced from `web/index.html` but only exists after `npm run build`. The verifier whitelists it as long as its source (`web/capacitor-init.js`) exists. Add more entries to `BUILD_ARTIFACTS` in `verify.js` if you introduce more build-time-only files.

## `analyze-css.js` — duplicate selector report

Reports CSS files referenced from `web/index.html`, total bytes, top heaviest files, and selectors that appear in 2+ files (candidates for consolidation).

```bash
npm run analyze:css
```

Useful before doing a CSS cleanup pass. Does not modify anything.

## `bundle-css.js` — opt-in concatenation

Concatenates every CSS file referenced from `web/index.html` (in source order) into `www/styles.bundle.css`. Lets you collapse the 22 `<link>` tags into 1 for faster cold start.

```bash
npm run build:css-bundle
```

Then you'd manually replace the 22 `<link rel="stylesheet">` tags in `web/index.html` with a single `<link rel="stylesheet" href="styles.bundle.css">`. **Not done by default** because cascade order can be subtle and you should eyeball the duplicates first.

## Adding a new check to `verify.js`

The script is intentionally simple — no abstractions, no test framework. Pattern:

```js
// New check:
try {
    // some assertion
    if (badCondition) throw new Error('reason');
    pass('description of what passed');
} catch (e) {
    fail('description: ' + e.message);
}
```

`pass()` and `fail()` are defined at the top. They increment `checks` / `failures` and print colored ✓/✗ lines. The final summary prints `N checks, M failure(s)`.

## Why no test framework?

The verifier needs to:
- Run in any CI (no `npm install` of test deps)
- Take under 5 seconds
- Have zero false positives

A test framework would add a dependency, slow it down, and obscure the "either it parses or it doesn't" simplicity. If you need real unit tests for a specific module, add them as a separate `test/` directory using whatever framework you like.
