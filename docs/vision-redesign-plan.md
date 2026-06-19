# Vision — Desktop Redesign Plan

> Goal: turn the Vision page from a pretty image grid into a **world-class goals + manifestation command center** — inspiring to look at, but built for progress and daily use. Web desktop only; mobile/iOS/Android untouched.

---

## 1. Principles

1. **Inspiration *and* execution.** It's a vision board (imagery matters) *and* a goals system (progress, deadlines, habits, rituals matter). The redesign must serve both — beautiful, but never decorative-only.
2. **One screen, one truth.** At a glance: how am I trending across all goals, what's my focus this month, what's due soon, what do I do today.
3. **Consistency with the rest of the app.** Same Stripe/Mercury system and the same two-pane master-detail pattern now used in Tasks, Habits, and Diary.
4. **Surface the depth that's already built.** Affirmations, the Manifestation Ritual, linked habits, galleries, and the 10-day plan are powerful and currently buried. Bring them forward.
5. **Calm chrome around vivid imagery.** Let the goal photos be the color; keep everything around them quiet and precise.

---

## 2. Current-state diagnosis

- **Double heading** — "Vision" (app title) + "Vision Board" (view title) stacked; wasted vertical space (same issue fixed on other pages).
- **Low density / heavy scroll** — 2-column giant cards for 22 goals means lots of scrolling and no overview.
- **No sense of momentum** — "22 active · 0 achieved" is a count, not a story. There's no aggregate progress, no "what's due soon," no "what to do today."
- **Depth is hidden** — affirmations, ritual, linked habits, milestones, gallery only appear after drilling into a goal; the board itself is inert.
- **TDP card is cryptic** — "Start TDP / Planning block not started" doesn't explain what it is or why I'd care.
- **Controls stack vertically** — title, TDP, filter chips, and view-switcher each take a full row, pushing goals below the fold.
- **Right-side space unused** — wide empty gutters; no detail/insight rail.

---

## 3. Information architecture (target layout)

A two-pane **command center**: a board on the left, a rich, persistent detail/insight pane on the right.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Vision                                    [ Grid | List | Timeline ]   [+ New goal] │  ← app header bar (single title; view-switch + add on the right)
├──────────────────────────────────────────────────────────────────────────────┤
│  OVERVIEW BAR                                                                   │
│  ◐ 34%  avg progress   •   22 active   •   0 achieved   •   ⏳ next: "Speaking… " 12d │
│  ── Focus sprint (TDP): Day 3 of 10 · 30% ▓▓▓░░░░░░░  [Open]  (or "Start a 10-day sprint")│
├───────────────────────────────────────────────┬──────────────────────────────┤
│  FILTERS:  ◎ Focus  All  Personality  Work  …  │  DETAIL / INSIGHT PANE        │
│                                                 │                              │
│  BOARD (left column, scrolls):                  │  Default (nothing selected): │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐           │   • This month's focus goals │
│   │  image  │ │  image  │ │  image  │           │   • ✦ Daily Ritual  ▶ Start  │
│   │ CATEGORY│ │ CATEGORY│ │ CATEGORY│           │   • Due soon (next 3 dates)  │
│   │  Title  │ │  Title  │ │  Title  │           │   • Progress by category     │
│   │ ▓▓▓ 40% │ │ ▓▓ 20%  │ │ ▓▓▓▓ 80%│           │                              │
│   └─────────┘ └─────────┘ └─────────┘           │  Goal selected:              │
│   responsive 2–3 col, refined cards             │   • hero image + category    │
│                                                 │   • progress ring (editable) │
│                                                 │   • target date / status     │
│                                                 │   • milestones / linked habits│
│                                                 │   • affirmations preview      │
│                                                 │   • gallery thumbnails        │
│                                                 │   • ▶ Start ritual for this   │
│                                                 │   • notes · Edit · Achieve · ⋯│
└───────────────────────────────────────────────┴──────────────────────────────┘
```

Below ~1100px the right pane drops away and it returns to the single-column layout (mobile path unchanged).

---

## 4. Component specs

### 4.1 Header (reclaim the top)
- Drop the "Vision Board" sub-title; the app bar already says **Vision**.
- Move **view-switcher (Grid / List / Timeline)** and **+ New goal** into the app header bar (the `#pageActions` slot — same pattern just shipped for Diary).
- Fold the AI/sparkle action into the New-goal flow or the detail pane, not a lone mystery icon.

### 4.2 Overview bar (new — the "story")
A single slim row that answers *"where am I?"*:
- **Average progress** across active goals (small ring or bar + number).
- **Active / Achieved** counts (clickable to filter).
- **Nearest deadline** — goal title + days left (turns amber/red as it approaches).
- Optional: **this-week ritual streak** (from `ritual_logs`).

### 4.3 Focus sprint (TDP) — make it legible
- Reframe from "Start TDP" to **"10-day focus sprint."**
- Not started → one-line invite: *"Pick a few goals and commit to a 10-day push."* + **Start sprint**.
- Active → **Day X of 10**, % complete, days left, the chosen categories, and **Open**.

### 4.4 Goal card (board)
Refined, denser, consistent aspect ratio:
- Image with a bottom gradient scrim for legibility.
- **Category chip** (top-left), **focus star** + **⋯ menu** (top-right, on hover).
- **Title** (1–2 lines, clamped).
- **Progress bar + %**, and **target date** ("in 12d" / "Mar 2026" / "overdue").
- Hover: subtle lift; click: opens in the right pane (no full-screen takeover).
- Grid is responsive `auto-fit` (2 cols on narrower desktops, 3 on wide), so 22 goals are far more scannable.

### 4.5 Master-detail pane (the big upgrade)
Reuse the existing `openVisionDetail` content, re-housed as a **right pane** instead of a takeover:
- Hero image + category + title.
- **Progress ring with inline editing** (drag/clicks to set %), status, target date.
- **Milestones / linked habits** — show `linked_habits` with their completion; a real "how do I move this forward" section.
- **Affirmations preview** for this goal + **Start ritual** for it.
- **Gallery** thumbnails (`vision_images`) + video.
- **Notes**, and actions: Edit · Mark achieved · Delete.
- **Default state** (nothing selected) = the insight pane: this month's focus, **Daily Ritual** launcher, due-soon list, progress-by-category.

### 4.6 List view (power management)
A clean table for managing 22+ goals: Title · Category · Progress · Target date · Status · Focus. Sortable columns; row click opens the detail pane.

### 4.7 Timeline / Roadmap view (planning)
Goals plotted by `target_date` across months/quarters — a real roadmap. Overdue and undated lanes handled explicitly. This turns "someday" goals into a plan.

### 4.8 Affirmations & Manifestation Ritual (signature feature)
- A persistent, beautiful **Daily Ritual** entry point in the default pane (and a small one in the header).
- Keep the immersive ritual experience; just make getting into it obvious and inviting (it's a differentiator most goal apps don't have).

---

## 5. Visual system
- Use the existing Stripe/Mercury tokens: hairline borders, soft layered shadows, Inter, tabular numerals for %/dates, the user's cyan accent.
- **Imagery treatment**: uniform card aspect ratio, consistent gradient scrim, rounded `--radius-lg`, no harsh full-black overlays. Photos provide the color; chrome stays neutral.
- **Category chips**: one quiet, consistent style (not per-category loud colors) with a small color dot.
- **Progress**: one progress language everywhere (bar on cards, ring in detail), accent fill, tabular % .
- Smooth, restrained motion: hover lift on cards, pane cross-fade on select.

---

## 6. Interactions & flow
- Click goal → detail pane (keyboard `Esc` clears; arrow keys move between goals — nice-to-have).
- Inline **progress editing** + **mark achieved** from the pane (achieved goals move to an "Achieved" state/section).
- **Focus** toggle from card hover and pane.
- Filters + view-switch never reload the whole header; only the board/pane update.
- Drag-to-reorder on the board (nice-to-have, later).

---

## 7. Scope & safety
- **Desktop only.** All new layout/density scoped behind a wrapper class + a `min-width` breakpoint; below it, the current single-column mobile layout is untouched.
- **Reuse, don't rewrite, the engine.** Affirmations, ritual, TTS, TDP, media, and CRUD already work — the redesign restructures presentation and surfaces them; it should not touch the underlying ritual/audio logic.
- Verify after each phase: JS parse, project `verify` (105 checks), and a visual pass.

---

## 8. Phased implementation

**Phase 1 — Frame & board (high impact, low risk)**
Single header + view-switcher/New in the app bar; new Overview bar; refined responsive grid cards; reframed TDP sprint banner; Stripe polish. *(This alone transforms the first impression.)*

**Phase 2 — Master-detail pane**
Right pane: default insight state (focus, ritual, due-soon, category progress) + goal detail (reusing `openVisionDetail`), with inline progress editing.

**Phase 3 — Lenses**
Rebuild List as a sortable table and Timeline as a real roadmap.

**Phase 4 — Signature polish**
Elevate the Daily Ritual / affirmations entry points, linked-habits/milestones section, drag-reorder, keyboard nav.

---

## 9. Decisions I need from you
1. **Emphasis** — lean more *inspiration* (big imagery, emotional), more *execution* (progress/deadlines/dense), or **balanced** (recommended)?
2. **Layout** — confirm the **two-pane master-detail** direction (consistent with Tasks/Habits/Diary)?
3. **Card density** — go denser (2–3 col, recommended) or keep the large 2-col imagery?
4. **What to surface first** in the detail pane — progress & deadlines, linked habits/milestones, or affirmations/ritual?
5. **Build order** — start with Phase 1 (frame & board) and iterate, or batch more before you review?
