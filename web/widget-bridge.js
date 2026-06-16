/* widget-bridge.js — iOS Widget Data Bridge
   ═══════════════════════════════════════════════════════════════
   Collects widget-relevant data from state.data.* and sends it
   to the native Capacitor plugin which writes to App Group
   UserDefaults for WidgetKit to read.

   Data flow:
   JS (state.data) → this file → Capacitor Plugin → UserDefaults → SwiftUI Widgets
   ═══════════════════════════════════════════════════════════════ */

// ═══ WIDGET DATA COLLECTOR ═══

function collectWidgetData() {
  if (!window.state?.data) return null;
  const d = state.data;

  return {
    habits:       _collectHabitsData(d),
    tasks:        _collectTasksData(d),
    lifeProgress: _collectLifeProgressData(d),
    budget:       _collectBudgetData(d),
    reading:      _collectReadingData(d),
    updatedAt:    new Date().toISOString()
  };
}

// ── Habits: total scheduled today, completed count, item list ──
function _collectHabitsData(d) {
  const habits = d.habits || [];
  const logs   = d.habit_logs || [];
  const today  = new Date().toISOString().slice(0, 10);
  const dayIdx = new Date().getDay(); // 0=Sun
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDay = DAY_NAMES[dayIdx];

  // Filter to habits scheduled today
  const scheduled = habits.filter(h => {
    if ((h.frequency || 'daily') === 'weekly') {
      const days = (h.days || '').split(',').map(s => s.trim());
      return days.includes(todayDay);
    }
    return true; // daily habits always scheduled
  });

  const items = scheduled.map(h => {
    const done = logs.some(l =>
      String(l.habit_id) === String(h.id) &&
      (l.date || '').startsWith(today)
    );
    return {
      name: h.habit_name || h.name || 'Habit',
      icon: h.icon || '✅',
      done
    };
  });

  return {
    total:     items.length,
    completed: items.filter(i => i.done).length,
    items
  };
}

// ── Tasks: top 5 due today or overdue, sorted by priority ──
function _collectTasksData(d) {
  const tasks = d.tasks || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

  console.log('[WidgetBridge] Tasks total:', tasks.length, 'today:', today, 'day:', todayDay);

  // Log first 5 tasks for debugging
  tasks.slice(0, 5).forEach(t => {
    console.log('[WidgetBridge] Task:', t.title, 'due:', t.due_date, 'status:', t.status, 'rec:', t.recurrence);
  });

  function shouldShow(t) {
    // Skip completed non-recurring tasks
    if (t.status === 'completed' && (!t.recurrence || t.recurrence === 'none')) return false;

    // Recurring tasks
    if (t.recurrence && t.recurrence !== 'none') {
      if (t.status === 'completed') {
        const completedDates = (t.completed_dates || '').split(',').map(s => s.trim());
        if (completedDates.includes(today)) return false;
      }
      return _isRecurringToday(t, today, todayDay);
    }

    // Non-recurring: due today, overdue, or no due date
    if (!t.due_date) return true;
    return t.due_date <= today;
  }

  function _isRecurringToday(t, today, todayDay) {
    if (t.recurrence_end && t.recurrence_end < today) return false;
    if (t.recurrence === 'daily') return true;
    if (t.recurrence === 'weekly') {
      return (t.recurrence_days || '').split(',').map(s => s.trim()).includes(todayDay);
    }
    if (t.recurrence === 'monthly') {
      return new Date().getDate() === new Date(t.due_date).getDate();
    }
    return false;
  }

  const PRIO = { P1: 0, P2: 1, P3: 2 };

  const filtered = tasks
    .filter(shouldShow)
    .sort((a, b) => (PRIO[a.priority] ?? 2) - (PRIO[b.priority] ?? 2))
    .slice(0, 5)
    .map(t => ({
      title:    t.title || 'Untitled',
      priority: t.priority || 'P3',
      done:     t.status === 'completed'
    }));

  console.log('[WidgetBridge] Tasks for widget:', filtered.length);
  return filtered;
}

// ── Life Progress: weeks lived / total weeks (Memento Mori) ──
function _collectLifeProgressData(d) {
  const dob = d.settings?.[0]?.dob;
  if (!dob) return { weeksLived: 0, totalWeeks: 2600, ageYears: 0, percentage: 0 };

  const dobDate    = new Date(dob);
  const now        = new Date();
  const msPerWeek  = 7 * 24 * 60 * 60 * 1000;
  const weeksLived = Math.floor((now.getTime() - dobDate.getTime()) / msPerWeek);
  const totalWeeks = 50 * 52; // 2600 weeks = 50 years (matches view-life-calendar.js)
  const ageYears   = Math.floor((now.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  return {
    weeksLived,
    totalWeeks,
    ageYears,
    percentage: Math.min(100, Math.round((weeksLived / totalWeeks) * 100))
  };
}

// ── Weekly Budget: spent vs budget for current Mon–Sun week ──
function _collectBudgetData(d) {
  const weeklyBudget = Number(d.settings?.[0]?.weekly_budget) || 0;
  const expenses     = d.expenses || [];

  // Get current week bounds (Monday to Sunday)
  const now  = new Date();
  const day  = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday offset
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);

  const weekStart = mon.toISOString().slice(0, 10);
  const weekEnd   = sun.toISOString().slice(0, 10);

  const weekExpenses = expenses.filter(e =>
    (e.type || 'expense') === 'expense' &&
    e.date >= weekStart &&
    e.date <= weekEnd
  );
  const weeklySpent = weekExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  console.log('[WidgetBridge] Budget: weekly_budget=' + weeklyBudget,
    'expenses total=' + expenses.length, 'this week=' + weekExpenses.length,
    'weekStart=' + weekStart, 'weekEnd=' + weekEnd,
    'spent=' + weeklySpent);

  return {
    weeklyBudget: Math.round(weeklyBudget),
    weeklySpent:  Math.round(weeklySpent),
    currency:     '₹'
  };
}

// ── Reading: currently reading book + progress ──
function _collectReadingData(d) {
  const books   = d.book_library || [];
  const reading = books.find(b => b.status === 'reading');

  if (!reading) {
    return { currentBook: '', author: '', currentPage: 0, totalPages: 0, percentage: 0 };
  }

  // Reading progress stored in localStorage (0-indexed page)
  const progress   = JSON.parse(localStorage.getItem('bookReadingProgress') || '{}');
  const summaries  = d.book_summaries || [];
  const summary    = summaries.find(s => String(s.book_id) === String(reading.id));
  const totalPages = Number(summary?.total_pages) ||
                     (summary?.summary_json ? JSON.parse(summary.summary_json || '[]').length : 0) || 1;
  const currentPage = (progress[reading.id] ?? 0) + 1; // 0-indexed → 1-indexed

  return {
    currentBook: reading.title || 'Unknown',
    author:      reading.author || '',
    currentPage,
    totalPages,
    percentage:  Math.min(100, Math.round((currentPage / totalPages) * 100))
  };
}

// ═══ SEND TO NATIVE ═══

async function sendWidgetData(data) {
  const jsonStr = JSON.stringify(data);

  // iOS path: WKWebView message handler installed by WidgetBridgePlugin.swift
  try {
    const iosHandler = window.webkit?.messageHandlers?.widgetBridge;
    if (iosHandler) {
      console.log('[WidgetBridge] iOS: sending', jsonStr.length, 'bytes via webkit handler');
      iosHandler.postMessage(jsonStr);
      return;
    }
  } catch (e) {
    console.error('[WidgetBridge] iOS path error:', e.message);
  }

  // Android path: Capacitor plugin (WidgetBridgePlugin.java) writes to
  // SharedPreferences and broadcasts an APPWIDGET_UPDATE intent.
  // Look for the plugin under both the direct window global and the
  // Capacitor.Plugins namespace (defensive — Capacitor v8 sometimes manages
  // its own Plugins namespace and direct assignment can be silently lost).
  const androidPlugin = window.WidgetBridge
    || window.Capacitor?.Plugins?.WidgetBridge;

  if (!androidPlugin) {
    console.warn('[WidgetBridge] No plugin found on window.WidgetBridge or Capacitor.Plugins.WidgetBridge — ' +
                 'is the native plugin registered? (Check MainActivity.onCreate)');
    return;
  }
  if (typeof androidPlugin.setData !== 'function') {
    console.warn('[WidgetBridge] Plugin found but setData is not a function. ' +
                 'Keys on plugin:', Object.keys(androidPlugin));
    return;
  }

  try {
    console.log('[WidgetBridge] Android: sending', jsonStr.length, 'bytes via Capacitor plugin');
    const res = await androidPlugin.setData({ json: jsonStr });
    console.log('[WidgetBridge] Android: plugin returned', res);
  } catch (e) {
    console.error('[WidgetBridge] Android path error:', e?.message || e);
  }
}

// ═══ PUBLIC API ═══

window.updateWidgetData = async function() {
  try {
    const data = collectWidgetData();
    if (data) {
      console.log('[WidgetBridge] Collected data:',
        'habits:', data.habits?.completed + '/' + data.habits?.total,
        'habitItems:', JSON.stringify(data.habits?.items?.map(i => i.name + ':' + i.done)),
        'tasks:', data.tasks?.length,
        'life%:', data.lifeProgress?.percentage,
        'budget:', data.budget?.weeklySpent + '/' + data.budget?.weeklyBudget,
        'reading:', data.reading?.currentBook || 'none');
      await sendWidgetData(data);
    } else {
      console.warn('[WidgetBridge] No data collected (state.data missing)');
    }
  } catch (e) {
    console.error('[WidgetBridge] ❌ Error collecting data:', e);
  }
};
