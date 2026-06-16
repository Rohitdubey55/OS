package com.personal.os.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import com.personal.os.MainActivity;
import com.personal.os.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Habit Checklist widget — shows up to 4 of today's scheduled habits with
 * done / not-done indicators. Tap opens app at the Habits view.
 */
public class HabitChecklistWidget extends AppWidgetProvider {
    private static final String TAG = "HabitChecklistWidget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateAppWidget(ctx, mgr, id);
    }

    static void updateAppWidget(Context ctx, AppWidgetManager mgr, int widgetId) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_habit_checklist);

        SharedPreferences prefs = ctx.getSharedPreferences(
                WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(WidgetBridgePlugin.KEY_JSON, "");

        int total = 0, completed = 0, rendered = 0;
        int[] rowIds   = { R.id.habit_1_row,  R.id.habit_2_row,  R.id.habit_3_row,  R.id.habit_4_row };
        int[] dotIds   = { R.id.habit_1_dot,  R.id.habit_2_dot,  R.id.habit_3_dot,  R.id.habit_4_dot };
        int[] nameIds  = { R.id.habit_1_name, R.id.habit_2_name, R.id.habit_3_name, R.id.habit_4_name };

        try {
            if (!json.isEmpty()) {
                JSONObject root = new JSONObject(json);
                JSONObject habits = root.optJSONObject("habits");
                if (habits != null) {
                    total = habits.optInt("total", 0);
                    completed = habits.optInt("completed", 0);
                    JSONArray items = habits.optJSONArray("items");
                    if (items != null) {
                        int n = Math.min(items.length(), rowIds.length);
                        for (int i = 0; i < n; i++) {
                            JSONObject h = items.getJSONObject(i);
                            String name = h.optString("name", "Habit");
                            boolean done = h.optBoolean("done", false);
                            v.setTextViewText(nameIds[i], name);
                            v.setInt(dotIds[i], "setBackgroundResource",
                                    done ? R.drawable.widget_check_done : R.drawable.widget_check_empty);
                            // Dim completed habits instead of strike-through
                            // (setPaintFlags isn't reliably remotable).
                            v.setTextColor(nameIds[i], done ? 0xFF6B7280 : 0xFFE4E7EC);
                            v.setViewVisibility(rowIds[i], View.VISIBLE);
                            rendered++;
                        }
                        for (int i = n; i < rowIds.length; i++) {
                            v.setViewVisibility(rowIds[i], View.GONE);
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "parse failure: " + e.getMessage());
        }

        // Header: big "X / Y" stat + percent pill + progress bar
        if (total > 0) {
            v.setTextViewText(R.id.habit_header, completed + " / " + total);
            int pct = Math.round((completed * 100f) / total);
            v.setTextViewText(R.id.habit_pct_pill, pct + "%");
            v.setViewVisibility(R.id.habit_pct_pill, View.VISIBLE);
            v.setProgressBar(R.id.habit_progress, 100, pct, false);
            v.setViewVisibility(R.id.habit_progress, View.VISIBLE);
            v.setViewVisibility(R.id.habit_empty, View.GONE);
        } else {
            v.setTextViewText(R.id.habit_header, "0 / 0");
            v.setViewVisibility(R.id.habit_pct_pill, View.GONE);
            v.setViewVisibility(R.id.habit_progress, View.GONE);
            v.setViewVisibility(R.id.habit_empty, View.VISIBLE);
        }

        // Tap → habits view
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("personalos://habits"));
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        v.setOnClickPendingIntent(R.id.habit_root,
                PendingIntent.getActivity(ctx, widgetId, open, flags));

        mgr.updateAppWidget(widgetId, v);
    }
}
