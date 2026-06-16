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

import org.json.JSONObject;

/**
 * Life Progress widget — shows percentage of life lived (using DOB → 50-year
 * lifespan from the iOS widget data model) plus age in years.
 */
public class LifeProgressWidget extends AppWidgetProvider {
    private static final String TAG = "LifeProgressWidget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateAppWidget(ctx, mgr, id);
    }

    static void updateAppWidget(Context ctx, AppWidgetManager mgr, int widgetId) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_life_progress);

        SharedPreferences prefs = ctx.getSharedPreferences(
                WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(WidgetBridgePlugin.KEY_JSON, "");

        int pct = 0, weeksLived = 0, totalWeeks = 0, ageYears = 0;
        boolean hasDob = false;

        try {
            if (!json.isEmpty()) {
                JSONObject root = new JSONObject(json);
                JSONObject lp = root.optJSONObject("lifeProgress");
                if (lp != null) {
                    pct        = lp.optInt("percentage", 0);
                    weeksLived = lp.optInt("weeksLived", 0);
                    totalWeeks = lp.optInt("totalWeeks", 2600);
                    ageYears   = lp.optInt("ageYears", 0);
                    hasDob     = weeksLived > 0;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "parse failure: " + e.getMessage());
        }

        if (hasDob) {
            // Just the number — the "%" symbol is rendered separately in the layout.
            v.setTextViewText(R.id.life_pct, String.valueOf(pct));
            v.setTextViewText(R.id.life_meta,
                    ageYears + " yrs · " + weeksLived + " of " + totalWeeks + " weeks");
            v.setProgressBar(R.id.life_bar, 100, pct, false);
            v.setViewVisibility(R.id.life_pct, View.VISIBLE);
            v.setViewVisibility(R.id.life_meta, View.VISIBLE);
            v.setViewVisibility(R.id.life_bar, View.VISIBLE);
            v.setViewVisibility(R.id.life_empty, View.GONE);
        } else {
            v.setViewVisibility(R.id.life_pct, View.GONE);
            v.setViewVisibility(R.id.life_meta, View.GONE);
            v.setViewVisibility(R.id.life_bar, View.GONE);
            v.setViewVisibility(R.id.life_empty, View.VISIBLE);
        }

        // Tap → life calendar
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("personalos://lifeCalendar"));
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        v.setOnClickPendingIntent(R.id.life_root,
                PendingIntent.getActivity(ctx, widgetId, open, flags));

        mgr.updateAppWidget(widgetId, v);
    }
}
