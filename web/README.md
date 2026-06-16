# `web/` — the web shell

Everything UI lives here. This single codebase runs as:

- A PWA (the `manifest.json` makes it installable on Android/Chrome)
- Embedded in the Android app via Capacitor WebView (after `cap sync`)
- Embedded in the iOS app via Capacitor WKWebView (after `cap sync`)

## File layout

```
web/
├── index.html              ← entry. <head> loads CSS + capacitor-bundle.js + main.js
├── main.js                 ← boot, state, routing, deep-link / share dispatcher
├── store.js                ← tiny pub/sub over window.state (loaded BEFORE main.js)
├── biometric-lock.js       ← optional opt-in lock screen (localStorage.biometricLock='1')
├── capacitor-init.js       ← ESM, bundled by esbuild → www/capacitor-bundle.js
│
├── view-*.js               ← one file per view (dashboard, tasks, habits, diary, etc.)
│                             Lazy-loaded by routeTo() — only fetched on first navigation
│
├── widget-bridge.js        ← collects widget data from state.data and sends to native
├── notification-service.js ← local notifications (uses Capacitor + Notification API)
├── ai-service.js           ← Gemini / ElevenLabs glue
├── command-palette.js      ← Cmd-K command palette
├── fab-menu.js             ← Floating action button speed dial
│
├── components/             ← small reusable bits
│   ├── icon-packs.js       ← the icon system (lucide / fontawesome / etc.)
│   └── empty-state.js
│
├── styles/                 ← design system + shared components
│   ├── design-system.css
│   ├── components.css
│   ├── icon-styles.css
│   └── books-reader.css
│
├── *.css                   ← per-view styles, polish layers, native-chrome overrides
├── manifest.json           ← PWA manifest (shortcuts, share_target, icons)
├── sw.js                   ← service worker (PWA only; disabled in Capacitor by main.js)
├── favicon.svg, icon-*.png ← app icons
├── plans/, extensions/, assets/ ← static content directories
└── (legacy/static helpers: app.js, etc.)
```

## Boot order (critical to understand)

```
1. index.html parsed
2. capacitor-bundle.js (sync, in <head>)        ← sets up window.Capacitor.Plugins.*
3. store.js                                     ← window.personalStore = pub/sub
4. biometric-lock.js                            ← paints lock overlay if enabled
5. main.js                                      ← defines state, routeTo, initApp
6. deferred scripts (notification-service, widget-bridge, ai-service, fab-menu, components/)
7. window 'load' event → initApp()
   a. registers Service Worker (PWA only)
   b. renderAllIcons()
   c. routeTo('dashboard')                      ← shows skeleton, lazy-loads view-dashboard.js
   d. hydrateFromBackgroundCache()              ← reads cached data from WorkManager (Android)
   e. loadAllData()                             ← network fetch from API_BASE
   f. on success: applyPostLoadSettings() → applySettings + updateTabVisibility
   g. scheduleBackgroundSync()                  ← Android only
```

## The lazy view loader (`VIEW_MAP` in `main.js`)

Each view's JS is fetched the first time the user navigates to it. The view file attaches a global render function (e.g. `window.renderTasks`); `routeTo('tasks')` loads `view-tasks.js`, then calls `renderTasks()`. **Do not bundle view files into `main.js`.** They must stay separate so they can be lazy-loaded.

To add a new view:
1. Create `web/view-myview.js` defining `window.renderMyView`
2. Add an entry to `VIEW_MAP` in `main.js`:
   ```js
   myview: { src: 'view-myview.js', render: 'renderMyView' }
   ```
3. Add to `package.json` `build:views` script list if you want it minified

## The reactive store (`store.js`)

Newer pattern that views can opt into instead of full `innerHTML` rebuilds:

```js
personalStore.subscribe('tasks', tasks => { /* incremental render */ });
personalStore.set('tasks', newArray);
personalStore.update('tasks', arr => [...arr, newTask]);
personalStore.notify('tasks');   // if you mutated in place
```

`main.js` already calls `personalStore.notify(key)` for every data slice after `loadAllData` and notifies `'view'` on every `routeTo`. Views can subscribe without any changes to the existing code paths.

## State shape (single source of truth)

```js
window.state = {
    view: 'dashboard',
    data: {
        tasks: [], habits: [], habit_logs: [], diary: [], expenses: [],
        planner: [], vision: [], settings: [], funds: [], assets: [], people: [],
        reminders: [], vision_images: [], vision_affirmations: [], ritual_logs: [],
        vision_tdp: [], gym_plans: [], gym_sessions: [], gym_exercises: [], notes: [],
        book_library: [], book_summaries: [], reader_settings: [], mural: [],
        language_projects: [], language_sessions: []
    },
    loading: false
}
```

`state.data.settings[0]` is the current user's settings record. **If the sheet has multiple settings rows, this picks index 0** — a known foot-gun (see Code.gs comment).

## Icon system (`components/icon-packs.js`)

Pluggable icon packs: lucide (default), fontawesome, remix, tabler, material, feather, heroicons, emoji. The user picks one in Settings. `renderIcon('settings')` returns the right markup for the active pack. Non-Lucide pack CSS is lazy-loaded the first time `renderIcon` is called with that pack.

To add a new semantic icon name:
1. Add an entry to `ICON_MAPPINGS` in `components/icon-packs.js`:
   ```js
   'my-icon': { lucide: 'star', emoji: '⭐', material: 'star', ... }
   ```

## Deep-link / share dispatcher

- **Native Android:** `MainActivity` injects shares as `window._sharedIntent`, fires `appUrlOpen` for `personalos://` URIs
- **PWA:** `dispatchPwaUrlParams()` in `main.js` parses `?share_text=...&action=add&view=tasks` from the URL

Both eventually call `window.handleSharedIntent(payload)` or `window.handlePendingDeepLinkAction()`. Views register handlers like `window.openAddTaskModal`, `window.openNewDiaryEntry`.

## Common gotchas

- **`escH` typo:** earlier bug in `view-dashboard.js`. Use `escapeHtml`, not `escH`.
- **Stroke-width loss:** Lucide's `createIcons()` rebuilds every `[data-lucide]` SVG on every view render, stripping inline stroke-width. The main FAB uses a **static hardcoded SVG** to avoid this. Don't use `<i data-icon="grid">` for the main FAB.
- **Service Worker on Capacitor:** would clash with the `capacitor://` scheme. `main.js` guards SW registration with `!window.Capacitor?.isNativePlatform()`. Don't remove that guard.
- **Default icon pack:** falls back to `lucide`. Never set the default to `'emoji'` (caused the bottom-nav emoji regression earlier).

## How to test changes safely

```bash
# From repo root
npm run verify          # syntax + asset-ref check
npm run lint            # eslint warnings (non-fatal)
npm run build           # produces www/
```

After `npm run build`:
- Open `www/index.html` in a browser to test the web build
- `npm run android` to test in Android Studio
- `npm run ios` to test in Xcode
