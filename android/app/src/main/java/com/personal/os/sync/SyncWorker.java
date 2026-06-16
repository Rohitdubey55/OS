package com.personal.os.sync;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.personal.os.widgets.WidgetBridgePlugin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * SyncWorker — periodic background sync.
 *
 * Pulls the latest data from the Google Apps Script bulk-fetch endpoint and
 * stuffs the response into the same SharedPreferences blob that the
 * widgets read. After writing, broadcasts an APPWIDGET_UPDATE so widgets
 * refresh even if the app hasn't been opened today.
 *
 * The endpoint URL and the JS-side data shape are not duplicated here — we
 * stash the raw Apps Script response as `serverData` alongside the widget
 * JSON. The next time the app opens, main.js reads it on init to skip the
 * cold-start network call (a soft "stale-while-revalidate" pattern).
 *
 * Scheduled by BackgroundSyncPlugin on app start: a PeriodicWorkRequest
 * with a 15-minute minimum interval (Android's hard floor for periodic work).
 */
public class SyncWorker extends Worker {

    public static final String PREFS_NAME = "personalos_widget_data";
    public static final String KEY_API_BASE = "apiBase";
    public static final String KEY_SERVER_DATA = "serverData";
    public static final String KEY_SERVER_DATA_AT = "serverDataAt";
    public static final String KEY_LAST_SYNC = "lastBackgroundSyncAt";
    public static final String KEY_LAST_SYNC_OK = "lastBackgroundSyncOk";

    private static final String TAG = "SyncWorker";
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS    = 30_000;

    public SyncWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String apiBase = prefs.getString(KEY_API_BASE, null);

        if (apiBase == null || apiBase.isEmpty()) {
            Log.d(TAG, "No apiBase set yet — JS hasn't pushed it. Skipping this run.");
            return Result.success(); // Don't retry until JS provides it.
        }

        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiBase);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestMethod("GET");
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("Accept", "application/json");

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                StringBuilder buf = new StringBuilder(8192);
                try (BufferedReader r = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = r.readLine()) != null) buf.append(line);
                }
                String body = buf.toString();
                long now = System.currentTimeMillis();

                prefs.edit()
                        .putString(KEY_SERVER_DATA, body)
                        .putLong(KEY_SERVER_DATA_AT, now)
                        .putLong(KEY_LAST_SYNC, now)
                        .putBoolean(KEY_LAST_SYNC_OK, true)
                        .apply();

                // Refresh widgets — they read widgetData (set by JS), but trigger
                // a refresh anyway so any time-based content (e.g. today's date)
                // gets re-evaluated.
                WidgetBridgePlugin.triggerWidgetUpdate(ctx);

                Log.i(TAG, "Background sync OK (" + body.length() + " bytes)");
                return Result.success();
            } else {
                Log.w(TAG, "HTTP " + code + " from " + apiBase);
                markFailure(prefs);
                return Result.retry();
            }
        } catch (IOException e) {
            Log.w(TAG, "Background sync IO error: " + e.getMessage());
            markFailure(prefs);
            return Result.retry();
        } catch (Exception e) {
            Log.e(TAG, "Background sync unexpected error", e);
            markFailure(prefs);
            return Result.failure();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void markFailure(SharedPreferences prefs) {
        prefs.edit()
                .putLong(KEY_LAST_SYNC, System.currentTimeMillis())
                .putBoolean(KEY_LAST_SYNC_OK, false)
                .apply();
    }
}
