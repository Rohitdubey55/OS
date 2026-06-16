package com.personal.os.widgets;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * WidgetBridge — Capacitor plugin that lets the JS layer push widget data
 * into Android SharedPreferences. AppWidgetProviders read from those prefs
 * on their next update cycle.
 *
 * JS usage:
 *   await Capacitor.Plugins.WidgetBridge.setData({ json: JSON.stringify(payload) });
 *
 * After writing, this plugin broadcasts an APPWIDGET_UPDATE intent so all
 * registered widgets refresh immediately rather than waiting for their
 * configured update period.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    public static final String PREFS_NAME = "personalos_widget_data";
    public static final String KEY_JSON = "widgetData";
    public static final String KEY_UPDATED_AT = "widgetDataUpdatedAt";
    private static final String TAG = "WidgetBridge";

    @PluginMethod
    public void setData(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("Missing 'json' argument");
            return;
        }
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_JSON, json)
                .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
                .apply();

        Log.d(TAG, "Stored widget data (" + json.length() + " bytes), broadcasting update");
        triggerWidgetUpdate(ctx);

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("bytes", json.length());
        call.resolve(ret);
    }

    @PluginMethod
    public void getData(PluginCall call) {
        SharedPreferences prefs = getContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_JSON, "");
        long updatedAt = prefs.getLong(KEY_UPDATED_AT, 0);
        JSObject ret = new JSObject();
        ret.put("json", json);
        ret.put("updatedAt", updatedAt);
        call.resolve(ret);
    }

    /**
     * Every AppWidgetProvider class in this app. Add new widgets here so
     * they refresh whenever JS pushes new data.
     */
    private static final Class<?>[] WIDGET_CLASSES = {
            TodaysTasksWidget.class,
            HabitChecklistWidget.class,
            WeeklyBudgetWidget.class,
            LifeProgressWidget.class
    };

    /**
     * Notify all of this app's AppWidgetProviders that their data has changed.
     * Each provider's onUpdate() will fire.
     */
    public static void triggerWidgetUpdate(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        for (Class<?> cls : WIDGET_CLASSES) {
            ComponentName comp = new ComponentName(ctx, cls);
            int[] ids = mgr.getAppWidgetIds(comp);
            if (ids == null || ids.length == 0) continue;
            android.content.Intent updateIntent = new android.content.Intent(ctx, cls);
            updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            ctx.sendBroadcast(updateIntent);
            Log.d(TAG, "Sent update broadcast for " + ids.length + " " + cls.getSimpleName() + " widget(s)");
        }
    }
}
