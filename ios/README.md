# `ios/` — Capacitor iOS wrapper

Native iOS side of PersonalOS. The web shell lives in `../web/` and is copied here by `npx cap sync ios` into `App/public/`. Everything in this folder is **iOS-only** — Swift, Objective-C bridging, Info.plist, Xcode project files.

## File layout

```
ios/
├── App/
│   ├── App.xcodeproj/                   ← Xcode project (open this in Xcode)
│   ├── App.xcworkspace/                 ← preferred entry point — use this in Xcode
│   ├── Podfile                          ← CocoaPods deps (Capacitor + plugins)
│   │
│   ├── App/                             ← main app target
│   │   ├── AppDelegate.swift            ← UIApplicationDelegate
│   │   ├── App-Bridging-Header.h        ← Obj-C → Swift bridging
│   │   ├── App.entitlements             ← App Groups, capabilities
│   │   ├── Info.plist                   ← bundle ID, URL schemes, permissions, app transport security
│   │   ├── public/                      ← www/ gets copied here by cap sync
│   │   └── WidgetBridgePlugin.swift     ← Capacitor plugin (WKScriptMessageHandler → App Group UserDefaults)
│   │
│   ├── PersonalOSWidgets/               ← Widget Extension target (SwiftUI)
│   │   ├── PersonalOSWidgetBundle.swift ← WidgetBundle (registers all widgets)
│   │   ├── WidgetDataModels.swift       ← Codable structs matching widget-bridge.js shape
│   │   ├── TodaysTasksWidget.swift
│   │   ├── HabitChecklistWidget.swift
│   │   ├── HabitsProgressWidget.swift
│   │   ├── LifeProgressWidget.swift
│   │   ├── ReadingStatsWidget.swift
│   │   ├── WeeklyBudgetWidget.swift
│   │   ├── CircularProgressView.swift   ← shared SwiftUI helper
│   │   └── Info.plist
│   │
│   └── PersonalOSWidgetsExtension.entitlements ← App Group access for the widget process
```

## Build / install

```bash
# From repo root, NOT from ios/
npm run ios       # rebuilds web shell, runs cap sync ios, opens Xcode
```

Or manually:
```bash
cd ios/App
pod install                       # if Podfile changes
open App.xcworkspace              # Always .xcworkspace, never .xcodeproj
# Then: select a device/simulator in Xcode, hit Run
```

## How web ↔ widget data flows

iOS doesn't use SharedPreferences; it uses an **App Group** (`group.com.personal.os`) shared between the main app and the widget extension. The plumbing:

```
web/widget-bridge.js
  collects state.data → JSON string
  → window.webkit.messageHandlers.widgetBridge.postMessage(jsonStr)
       │
       ▼
App/App/WidgetBridgePlugin.swift  (WKScriptMessageHandler)
  receives the postMessage
  → UserDefaults(suiteName: "group.com.personal.os").set(jsonStr, forKey: "widgetData")
  → WidgetCenter.shared.reloadAllTimelines()
       │
       ▼
PersonalOSWidgets/*.swift (TimelineProvider)
  reads UserDefaults from the same App Group
  → parses JSON via Codable models in WidgetDataModels.swift
  → SwiftUI view renders
```

Both ends MUST use the **same App Group ID**. It's hardcoded as `"group.com.personal.os"` in `WidgetBridgePlugin.swift` and must match `App.entitlements` + `PersonalOSWidgetsExtension.entitlements`.

## Adding a new widget

1. **Codable model** in `WidgetDataModels.swift` matching the JSON shape from `web/widget-bridge.js`'s collector.
2. **SwiftUI widget file** in `PersonalOSWidgets/MyWidget.swift`:
   - `Provider: TimelineProvider`
   - `EntryView: View`
   - `@main` is on the bundle, not here
3. **Register in bundle** in `PersonalOSWidgetBundle.swift`:
   ```swift
   @main
   struct PersonalOSWidgetBundle: WidgetBundle {
       var body: some Widget {
           TodaysTasksWidget()
           MyWidget()       // ← add here
       }
   }
   ```
4. **No manifest changes** — iOS doesn't have an AppWidgetProvider receiver concept. The bundle's `@main` + `WidgetKit` runtime handles it.
5. **Deep-link tap target:** widgets use `widgetURL("personalos://tasks")` on the view. The main app's `Info.plist` must declare the `personalos` URL scheme (already done).

## URL scheme + universal link

`Info.plist` declares the `personalos` URL scheme. Capacitor's `App.addListener('appUrlOpen')` in `web/main.js` catches these and routes via the existing deep-link dispatcher — same flow as Android.

## Common gotchas

- **"Cannot find App Group":** the entitlements file on each target (main app AND widget extension) must list the same App Group ID. Xcode → target → Signing & Capabilities → App Groups.
- **Widget shows old data forever:** `WidgetCenter.shared.reloadAllTimelines()` must be called after `UserDefaults.set`. The plugin does this — but only if the WKScriptMessageHandler was successfully installed. Check `NSLog` in Console.app for `[WidgetBridge] Message handler registered`.
- **App Group write but widget can't read:** entitlements mismatch or wrong suite name. Both must be identical strings.
- **`pod install` fails after Capacitor plugin add:** delete `Pods/`, `Podfile.lock`, then re-run `pod install`. Xcode's derived data cache can also lie — `rm -rf ~/Library/Developer/Xcode/DerivedData/App-*`.
- **Capacitor sync overwrites:** `App/App/public/` regenerates on every `cap sync`. Never edit it. The `Info.plist`, `entitlements`, `AppDelegate.swift` are yours.
