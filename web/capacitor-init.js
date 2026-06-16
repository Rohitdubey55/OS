// Bundled into www/capacitor-bundle.js by esbuild.
// Must run BEFORE main.js so window.Capacitor.Plugins.* is available.
//
// NOTE: After pulling these changes, run `npm install` to fetch the new
// @capacitor/* packages (app, splash-screen, status-bar, keyboard, haptics)
// then `npx cap sync android` to wire the native side.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

window.Capacitor = Capacitor;
window.LocalNotifications = LocalNotifications;

// Expose plugins on the standard Capacitor.Plugins surface so existing
// main.js / view-*.js calls like window.Capacitor.Plugins.Haptics.impact() work.
Capacitor.Plugins = Capacitor.Plugins || {};
Capacitor.Plugins.App = App;
Capacitor.Plugins.SplashScreen = SplashScreen;
Capacitor.Plugins.StatusBar = StatusBar;
Capacitor.Plugins.Keyboard = Keyboard;
Capacitor.Plugins.Haptics = Haptics;
Capacitor.Plugins.Preferences = Preferences;
Capacitor.Plugins.BiometricAuth = BiometricAuth;
Capacitor.Plugins.LocalNotifications = LocalNotifications;

// Custom plugins: registered via registerPlugin() which returns a proxy
// that bridges JS calls to the native implementations
// (android/.../widgets/WidgetBridgePlugin.java + sync/BackgroundSyncPlugin.java).
//
// We expose them under THREE names so any consumer can find them:
//   window.WidgetBridge                      — direct global (preferred)
//   window.Capacitor.Plugins.WidgetBridge    — Capacitor convention
//   (registerPlugin's own internal registry, used by Capacitor itself)
//
// The triple-binding is defensive: Capacitor.Plugins is sometimes a proxy
// managed by core, and direct assignment to it can be silently dropped
// depending on version. window.X is rock-solid.
const WidgetBridge = registerPlugin('WidgetBridge');
const BackgroundSync = registerPlugin('BackgroundSync');

window.WidgetBridge = WidgetBridge;
window.BackgroundSync = BackgroundSync;
try {
    Capacitor.Plugins.WidgetBridge = WidgetBridge;
    Capacitor.Plugins.BackgroundSync = BackgroundSync;
} catch (e) { /* Capacitor.Plugins may be frozen in some versions */ }

// Apply native UX defaults as early as possible (before first paint where possible).
if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#0B0E14' }).catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
}
