package com.personal.os.sync;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

/**
 * BackgroundSync — Capacitor plugin that lets JS schedule a WorkManager
 * periodic sync, push the API endpoint URL to it, and read the last-sync
 * status back.
 *
 * Typical JS usage on app start:
 *   await Capacitor.Plugins.BackgroundSync.configure({ apiBase: API_BASE });
 *   await Capacitor.Plugins.BackgroundSync.schedule({ intervalMinutes: 60 });
 *
 * The Worker will then run roughly every `intervalMinutes` (Android enforces
 * a 15-minute minimum), pull from apiBase, and stash the response in
 * SharedPreferences for the next app launch + widgets.
 */
@CapacitorPlugin(name = "BackgroundSync")
public class BackgroundSyncPlugin extends Plugin {

    private static final String TAG = "BackgroundSync";
    private static final String WORK_NAME = "personalos_background_sync";

    @PluginMethod
    public void configure(PluginCall call) {
        String apiBase = call.getString("apiBase");
        if (apiBase == null || apiBase.isEmpty()) {
            call.reject("apiBase is required");
            return;
        }
        SharedPreferences prefs = getContext()
                .getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(SyncWorker.KEY_API_BASE, apiBase).apply();
        Log.d(TAG, "Stored apiBase (" + apiBase.length() + " chars)");
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        long intervalMinutes = call.getLong("intervalMinutes", 60L);
        if (intervalMinutes < 15) intervalMinutes = 15; // Android floor

        boolean requireUnmetered = call.getBoolean("requireUnmetered", false);
        boolean requireCharging  = call.getBoolean("requireCharging",  false);

        Constraints.Builder constraints = new Constraints.Builder()
                .setRequiredNetworkType(requireUnmetered
                        ? NetworkType.UNMETERED
                        : NetworkType.CONNECTED);
        if (requireCharging) constraints.setRequiresCharging(true);

        PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(
                SyncWorker.class, intervalMinutes, TimeUnit.MINUTES)
                .setConstraints(constraints.build())
                .build();

        WorkManager.getInstance(getContext())
                .enqueueUniquePeriodicWork(WORK_NAME,
                        ExistingPeriodicWorkPolicy.UPDATE, work);

        Log.d(TAG, "Scheduled background sync every " + intervalMinutes + " min");
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("intervalMinutes", intervalMinutes);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK_NAME);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences prefs = getContext()
                .getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("lastSyncAt", prefs.getLong(SyncWorker.KEY_LAST_SYNC, 0));
        ret.put("lastSyncOk", prefs.getBoolean(SyncWorker.KEY_LAST_SYNC_OK, false));
        ret.put("serverDataAt", prefs.getLong(SyncWorker.KEY_SERVER_DATA_AT, 0));
        ret.put("apiBaseSet",
                prefs.getString(SyncWorker.KEY_API_BASE, "") != null
                && !prefs.getString(SyncWorker.KEY_API_BASE, "").isEmpty());
        call.resolve(ret);
    }

    /**
     * Return the most recent server-data blob the Worker fetched in the
     * background, so JS can hydrate from it instead of waiting on the
     * network on next launch.
     */
    @PluginMethod
    public void getCachedData(PluginCall call) {
        SharedPreferences prefs = getContext()
                .getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("data", prefs.getString(SyncWorker.KEY_SERVER_DATA, ""));
        ret.put("fetchedAt", prefs.getLong(SyncWorker.KEY_SERVER_DATA_AT, 0));
        call.resolve(ret);
    }
}
