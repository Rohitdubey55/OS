package com.personal.os;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;
import com.personal.os.sync.BackgroundSyncPlugin;
import com.personal.os.widgets.WidgetBridgePlugin;

/**
 * MainActivity adds share-intent handling on top of Capacitor's default bridge.
 *
 * When another app sends text via ACTION_SEND (e.g. "Share to PersonalOS" from
 * Chrome's share sheet), Capacitor's appUrlOpen listener does NOT fire — that
 * event is only emitted for ACTION_VIEW. We intercept the SEND intent here,
 * pull the shared text out, and inject it into the WebView as
 *   window._sharedIntent = { text, subject, ts }
 * The JS side reads this in main.js on init / resume and routes the user
 * to the right view with the content prefilled.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugins BEFORE super.onCreate so the
        // bridge picks them up during its plugin discovery pass.
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(BackgroundSyncPlugin.class);

        super.onCreate(savedInstanceState);

        // Force-disable edge-to-edge enforcement: tell the system to pad
        // content INSIDE the system bars instead of drawing under them. This
        // is the Java-level equivalent of windowOptOutEdgeToEdgeEnforcement,
        // applied here as a fallback because some launchers / OEMs ignore
        // the theme flag on Android 15+.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // Handle the case where the app is cold-launched by a share.
        handleShareIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle the case where the app is already running and the user
        // shares into it (the activity is singleTask, so this fires
        // instead of a fresh onCreate).
        setIntent(intent);
        handleShareIntent(intent);
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();
        if (!Intent.ACTION_SEND.equals(action) || type == null) return;
        if (!"text/plain".equals(type)) return;

        final String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
        final String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (shared == null || shared.isEmpty()) return;

        // Defer until the WebView is ready. Capacitor sets up the bridge in
        // onResume / onPostCreate; injecting on the next tick is reliable.
        final WebView webView = getBridge().getWebView();
        webView.post(new Runnable() {
            @Override
            public void run() {
                final String js =
                    "window._sharedIntent = {"
                    + "  text: " + jsString(shared) + ","
                    + "  subject: " + jsString(subject == null ? "" : subject) + ","
                    + "  ts: Date.now()"
                    + "};"
                    + "if (typeof window.handleSharedIntent === 'function') {"
                    + "  try { window.handleSharedIntent(window._sharedIntent); } catch (e) { console.error(e); }"
                    + "}";
                webView.evaluateJavascript(js, null);
            }
        });
    }

    /** Escape a Java string for safe embedding inside a JS string literal. */
    private String jsString(String s) {
        if (s == null) return "''";
        StringBuilder sb = new StringBuilder(s.length() + 4);
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"':  sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '<':  sb.append("\\u003C"); break; // safer inside <script>
                case '>':  sb.append("\\u003E"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
    }
}
