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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Today's Tasks home-screen widget.
 *
 * Reads the JSON blob written by WidgetBridgePlugin out of SharedPreferences,
 * pulls out the top 3 entries from data.tasks, and renders them in the widget.
 *
 * Tap on widget body  → opens app at personalos://tasks
 * Tap on header       → opens app at personalos://dashboard
 */
public class TodaysTasksWidget extends AppWidgetProvider {

    private static final String TAG = "TodaysTasksWidget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            updateAppWidget(context, manager, id);
        }
    }

    static void updateAppWidget(Context ctx, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_todays_tasks);

        // Header date — always current, regardless of data freshness.
        String today = new SimpleDateFormat("EEE, MMM d", Locale.getDefault()).format(new Date());
        views.setTextViewText(R.id.widget_date, today);

        // Pull the JSON blob written by JS via WidgetBridgePlugin.setData(...)
        SharedPreferences prefs = ctx.getSharedPreferences(
                WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(WidgetBridgePlugin.KEY_JSON, "");

        int taskCount = 0;
        int rendered = 0;

        try {
            if (!json.isEmpty()) {
                JSONObject root = new JSONObject(json);
                JSONArray tasks = root.optJSONArray("tasks");
                if (tasks != null) {
                    taskCount = tasks.length();
                    // Show up to 3 rows; the layout has 3 fixed slots.
                    int[] titleIds = { R.id.task_1_title, R.id.task_2_title, R.id.task_3_title };
                    int[] dotIds   = { R.id.task_1_dot,   R.id.task_2_dot,   R.id.task_3_dot   };
                    int[] rowIds   = { R.id.task_1_row,   R.id.task_2_row,   R.id.task_3_row   };

                    for (int i = 0; i < titleIds.length; i++) {
                        if (i < taskCount) {
                            JSONObject t = tasks.getJSONObject(i);
                            String title = t.optString("title", "Untitled");
                            String priority = t.optString("priority", "P3");
                            boolean done = t.optBoolean("done", false);

                            views.setTextViewText(titleIds[i], title);
                            views.setInt(dotIds[i], "setBackgroundResource",
                                    priorityDrawable(priority));
                            // Indicate completed via dim color (setPaintFlags is
                            // not reliably remotable across launchers).
                            views.setTextColor(titleIds[i], done ? 0xFF6B7280 : 0xFFE4E7EC);
                            views.setViewVisibility(rowIds[i], View.VISIBLE);
                            rendered++;
                        } else {
                            views.setViewVisibility(rowIds[i], View.GONE);
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to parse widget data: " + e.getMessage());
        }

        // Empty state
        if (rendered == 0) {
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            views.setViewVisibility(R.id.task_1_row, View.GONE);
            views.setViewVisibility(R.id.task_2_row, View.GONE);
            views.setViewVisibility(R.id.task_3_row, View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_empty, View.GONE);
        }

        // Count pill in top-right (only when there are tasks)
        if (taskCount > 0) {
            views.setTextViewText(R.id.widget_count_pill, taskCount + " TODAY");
            views.setViewVisibility(R.id.widget_count_pill, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_count_pill, View.GONE);
        }

        // Footer "more" pill
        if (taskCount > 3) {
            views.setTextViewText(R.id.widget_footer,
                    "+ " + (taskCount - 3) + " MORE");
            views.setViewVisibility(R.id.widget_footer, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_footer, View.GONE);
        }

        // Tap → open app at tasks view via the existing deep-link intent-filter
        Intent openTasks = new Intent(ctx, MainActivity.class);
        openTasks.setAction(Intent.ACTION_VIEW);
        openTasks.setData(Uri.parse("personalos://tasks"));
        openTasks.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, widgetId, openTasks, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pi);

        manager.updateAppWidget(widgetId, views);
    }

    private static int priorityDrawable(String priority) {
        if ("P1".equals(priority)) return R.drawable.widget_dot_p1;
        if ("P2".equals(priority)) return R.drawable.widget_dot_p2;
        return R.drawable.widget_dot_p3;
    }
}
