# Dashboard Widgets — Analysis & Curation Plan

The dashboard is a configurable tile grid backed by a catalog of **~50 tiles** in 6 groups. The problem isn't the engine — it's that the catalog is bloated with **navigation shortcuts that duplicate the sidebar** and **thin "launcher" tiles** that show a label and route away. The fix: cut to a focused, high-signal set and make those genuinely useful.

Legend: ✅ keep & refine · ✂️ remove · ➖ keep in catalog but drop from the default layout

---

## KPIs (small stat tiles) — 8
| Tile | Verdict | Why |
|---|---|---|
| Tasks Done ✅ | keep | core daily signal |
| Habits Today ✅ | keep | core daily signal |
| Streak ✅ | keep | motivating, glanceable |
| Month Spend ✅ | keep | core finance signal |
| Net Worth ➖ | catalog-only | useful but not daily; opt-in |
| This Week (weeklySpend) ✂️ | remove | duplicates Month Spend |
| Habit Score ✂️ | remove | duplicates Habits Today |
| Year Progress (KPI) ✂️ | remove | overlaps the Year Progress widget |

## Widgets (rich content tiles) — 8
| Tile | Verdict | Why |
|---|---|---|
| Greeting ✅ | keep + refine | nice anchor; make it a real "today at a glance" header |
| Daily Briefing (AI) ✅ | keep + refine | high value **if** it shows a real briefing, not just "Tap to open" |
| Tasks List ✅ | keep + refine | already improved; polish |
| Habits Grid ✅ | keep + refine | core; polish |
| Year Progress ➖ | catalog-only | fine, but niche for the default |
| Cashflow ✂️ | remove | just re-shows Month Spend |
| Vision Banner ✂️ | remove | thin launcher → sidebar already has Vision |
| Daily Tools ✂️ | remove | thin launcher for tools that have their own tiles |

## Lists — 6
| Tile | Verdict | Why |
|---|---|---|
| Recent Tasks ✅ | keep + refine | (overlaps Tasks List — keep one; see note) |
| Recent Transactions ✅ | keep + refine | useful daily |
| Upcoming Events ✅ | keep + refine | actionable |
| Upcoming Birthdays ➖ | catalog-only | situational |
| Recent Diary ✂️ | remove | low daily value |
| Recent Notes ✂️ | remove | low daily value |

## Quick Add — 9
Keep the four you use daily; the rest add clutter (they're one tap from their page).
- ✅ Add Task · Add Expense · Add Journal · Add Habit
- ✂️ Add Event · Add Note · Add Goal · Add Person · Add Book

## Quick Actions / Routes — 11  (route-tasks, habits, finance, diary, calendar, vision, notes, people, books, mural, life)
**✂️ Remove all from the catalog/default.** These are pure navigation that the left sidebar already provides — they're the biggest source of bloat.

## Daily Tools — 5  (focus, gym, chimes, tutor, meditate)
- ✅ Focus (Pomodoro) — keep one quick launcher
- ✂️ Gym · Chimes · Tutor · Meditate — remove (reachable from nav)

## Actions — 3
- ✅ Start Focus (merge with the Focus tool — keep one)
- ✂️ Start Meditate · Start Manifest — remove

---

## Recommended default dashboard (desktop)
A tight, useful first screen:

1. **Greeting / Today** (full width) — greeting + today's date + a one-line summary (open tasks · habits done · due soon)
2. **KPI row** — Tasks Done · Habits Today · Streak · Month Spend
3. **Daily Briefing** (AI) — a real short briefing
4. **Tasks List** + **Habits Grid** (the two workhorses)
5. **Upcoming Events** + **Recent Transactions**
6. **Quick Add** — Task · Expense · Journal · Habit  + **Focus** launcher

Net: ~**14 curated tiles** instead of ~50, with everything else still available in the catalog/customizer if wanted (nothing is permanently deleted from the code unless you want it gone).

## Refinement plan for kept tiles (SaaS level)
- Unify on the Stripe/Mercury card: hairline border, soft shadow, consistent radius, tabular numerals on all numbers, quiet labels.
- KPI tiles: big number + tiny uppercase label + trend hint where data exists; click routes to the page.
- Greeting → a real "Today" header (date + open-tasks/habits/due-soon line), not just "Good evening".
- Daily Briefing → show the actual briefing text (or a clean "generate" state), not "Tap to open".
- Lists/Tasks/Habits widgets → consistent row style, hover, empty states, click-through.
- Remove the thin "launcher" tiles entirely so every tile shows real information.

---

### Decision I need
Confirm the removal set above (or adjust), then I'll: (1) trim the catalog + default layout, (2) refine the kept tiles to SaaS level. By default I'll **keep removed tiles in the catalog** (just out of the default layout) unless you want them fully deleted.
