# PersonalOS — repo guide for AI agents

This repo ships **one product across three deployment targets**, all built from the same web shell. Each top-level folder owns one concern. Before editing anything, read the folder-specific `README.md` for the area you're touching.

## Folder map

| Folder | Owns | When to edit |
|--------|------|--------------|
| `web/` | The web shell — `index.html`, `main.js`, all `view-*.js`, all CSS, the lazy-loader, the reactive store, the icon system, the service worker, the PWA `manifest.json`. **This is what runs on iOS, Android, and the browser.** | Any UI, view, business logic, or styling change. Almost every change starts here. |
| `android/` | Capacitor Android wrapper. `MainActivity`, `AndroidManifest.xml`, Gradle config, ProGuard rules, **4 home-screen widgets**, `BackgroundSyncPlugin` (WorkManager), `WidgetBridgePlugin`, deep-link + share-target intent filters. | Native Android features (widgets, background sync, intent filters, ProGuard rules, OS-level theming). |
| `ios/` | Capacitor iOS wrapper. Xcode project, `WidgetBridgePlugin.swift`, **5 SwiftUI widgets** in `PersonalOSWidgets/`, App Group config. | Native iOS features (widgets, share extension, Info.plist, App Group keys). |
| `backend/` | Google Apps Script that backs the spreadsheet — `Code.gs` and a couple of helpers. Deploys as a Web App; the web shell reads/writes via `API_BASE` in `web/main.js`. | Schema changes, new sheet endpoints, payload shape changes. |
| `tools/` | Node build/verification scripts: `verify.js` (XML+JS lint), `analyze-css.js`, `bundle-css.js`. | When the verification needs to catch a new failure mode or a new file pattern. |
| `docs/` | Reports, the audit doc, miscellaneous documentation. | Adding documentation. |
| `www/` | **Build artifact — never edit.** Created by `npm run build` from `web/`. Capacitor copies this into the native projects on `npx cap sync`. | Never. Always rebuild. |

## How a change flows to a platform

```
edit web/  ──► npm run build ──► www/ ──► npx cap sync ──► android/ + ios/ ──► AS / Xcode build ──► APK / IPA
                                  │
                                  └─► (also served as the PWA via GitHub Pages or any static host)
```

So an HTML/CSS/JS change in `web/` reaches **all three platforms** with one rebuild + sync. A Java change in `android/` reaches **only Android** and needs an Android Studio rebuild. A Swift change in `ios/` reaches **only iOS** and needs Xcode.

## Build commands (always run from repo root)

```bash
npm install              # one-time, picks up @capacitor plugins
npm run verify           # 91 smoke checks (XML + JS parse + asset refs)
npm run build            # build web shell into www/
npm run sync             # build + npx cap sync android
npm run android          # sync + open Android Studio
npm run ios              # build + sync + open Xcode
npm run lint             # eslint over web/
npm run analyze:css      # report duplicate selectors across web/*.css
npm run build:css-bundle # concatenate all referenced CSS into www/styles.bundle.css
```

## Core rules for AI agents

1. **Always verify before declaring done.** `node tools/verify.js` must report `0 failure(s)`. Right now it runs 91 checks.
2. **Don't edit `www/`.** It's regenerated. Edit `web/` then `npm run build`.
3. **Don't push secrets.** The Apps Script URL in `web/main.js` is effectively public; treat it as such. The git remotes may contain Personal Access Tokens — rotate any tokens that get exposed.
4. **One concern per folder.** A widget bug → `android/`. A view bug → `web/`. A schema bug → `backend/`. Don't mix.
5. **The web shell is platform-neutral.** Always feature-detect (`window.Capacitor?.isNativePlatform()`) before calling a native API. Plain-web users on a deployed PWA must not break.
6. **The widgets are native, not web.** Browsers can't host home-screen widgets. The web shell's `widget-bridge.js` only collects data; the rendering happens in Java (`android/`) or Swift (`ios/`).
7. **Read the folder's README before editing it.** Each folder's README explains its conventions, the file layout, and how to operate safely.

## Quick links

- `web/README.md` — view module pattern, lazy loader, store, icon system
- `android/README.md` — widget anatomy, native plugins, theme, ProGuard
- `ios/README.md` — widget bundle, App Group, build settings
- `backend/README.md` — Apps Script API contract, schema, redeployment
- `tools/README.md` — how the verifier and analyzers work
