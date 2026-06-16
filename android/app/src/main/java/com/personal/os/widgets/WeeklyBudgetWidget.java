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
 * Weekly Budget widget — shows current-week spend vs budget with a horizontal
 * progress bar. Bar color shifts red once spending exceeds the budget.
 */
public class WeeklyBudgetWidget extends AppWidgetProvider {
    private static final String TAG = "WeeklyBudgetWidget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateAppWidget(ctx, mgr, id);
    }

    static void updateAppWidget(Context ctx, AppWidgetManager mgr, int widgetId) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_weekly_budget);

        SharedPreferences prefs = ctx.getSharedPreferences(
                WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(WidgetBridgePlugin.KEY_JSON, "");

        int spent = 0, budget = 0;
        String currency = "₹";

        try {
            if (!json.isEmpty()) {
                JSONObject root = new JSONObject(json);
                JSONObject b = root.optJSONObject("budget");
                if (b != null) {
                    spent  = b.optInt("weeklySpent", 0);
                    budget = b.optInt("weeklyBudget", 0);
                    currency = b.optString("currency", "₹");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "parse failure: " + e.getMessage());
        }

        if (budget > 0) {
            int pct = Math.min(100, Math.round((spent * 100f) / budget));
            int rawPct = Math.round((spent * 100f) / budget);
            int remaining = budget - spent;

            // Big primary number = amount remaining (positive = under, negative = over)
            if (remaining >= 0) {
                v.setTextViewText(R.id.budget_amount, currency + remaining);
                v.setTextViewText(R.id.budget_caption,
                        "remaining · " + currency + spent + " of " + currency + budget + " spent");
                v.setTextColor(R.id.budget_amount, 0xFFF9FAFB);
            } else {
                v.setTextViewText(R.id.budget_amount, "−" + currency + Math.abs(remaining));
                v.setTextViewText(R.id.budget_caption,
                        "over · " + currency + spent + " of " + currency + budget);
                v.setTextColor(R.id.budget_amount, 0xFFF87171);
            }

            v.setTextViewText(R.id.budget_pct, rawPct + "%");
            v.setProgressBar(R.id.budget_bar, 100, pct, false);

            // Swap progress drawable based on usage: green under 80%, red over 100%.
            int progressDrawable;
            if (rawPct > 100)      progressDrawable = R.drawable.widget_progress_red;
            else if (rawPct > 80)  progressDrawable = R.drawable.widget_progress_indigo;
            else                   progressDrawable = R.drawable.widget_progress_green;
            v.setInt(R.id.budget_bar, "setProgressDrawable", progressDrawable);

            v.setViewVisibility(R.id.budget_empty,   View.GONE);
            v.setViewVisibility(R.id.budget_amount,  View.VISIBLE);
            v.setViewVisibility(R.id.budget_caption, View.VISIBLE);
            v.setViewVisibility(R.id.budget_bar,     View.VISIBLE);
            v.setViewVisibility(R.id.budget_pct,     View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.budget_empty,   View.VISIBLE);
            v.setViewVisibility(R.id.budget_amount,  View.GONE);
            v.setViewVisibility(R.id.budget_caption, View.GONE);
            v.setViewVisibility(R.id.budget_bar,     View.GONE);
            v.setViewVisibility(R.id.budget_pct,     View.GONE);
        }

        // Tap → finance view
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("personalos://finance"));
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        v.setOnClickPendingIntent(R.id.budget_root,
                PendingIntent.getActivity(ctx, widgetId, open, flags));

        mgr.updateAppWidget(widgetId, v);
    }
}
