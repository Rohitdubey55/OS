# Wishlist — Feature Plan

A new **Daily Life Tool**: a flexible list of *things you want* — items to buy,
experiences to have, and gift ideas. Kept deliberately simple (no savings /
Funds integration), but designed so that integration can be bolted on later.

---

## 1. Concept & scope

- **Type-flexible.** Every entry has a *type*: **Buy** (a product), **Experience**
  (a trip, event, activity), or **Gift** (for someone else). One unified list,
  filterable by type — not three separate tools.
- **Organized by category.** Beyond type, every item belongs to a **category**
  (Tech, Travel, Home, Fashion, Health, Experiences, Gifts…) — a *managed* list with
  sensible defaults **plus your own custom ones**. Categories are the primary way the
  list is grouped and filtered; *type* is a lighter, secondary tag. (Type = "what kind
  of want"; category = "what area of life it's in" — they're orthogonal.)
- **Simple, not financial.** Price is an *optional* field for context, but there
  is **no** "save toward it" / Funds progress bar (per decision). The value is
  capturing wants, prioritizing them, and ticking them off.
- **Lives in Daily Tools.** Added as a card in the Daily Tools hub and as its own
  view (`routeTo('wishlist')`), exactly like Books / Notes / Gym.
- Fulfils the existing open task *"Add a wishlist as a tool."*

What it is **not**: it is not the Vision board (long-term life goals/identity) and
not Finance. Experiences here are concrete, listable "I want to do X" items, not
multi-month visions. A later "Promote to Vision" action can bridge the two.

---

## 2. Data model

New Supabase table `wishlist` (same resilient pattern as `budget_scope` /
`contact_frequency`: schema + idempotent migration + `ALLOWED_COLUMNS` entry, so
saves degrade gracefully until the migration is run).

| Column        | Type        | Notes |
|---------------|-------------|-------|
| `id`          | TEXT (PK)   | client-generated id |
| `user_id`     | UUID        | owner |
| `title`       | TEXT        | what you want (required) |
| `type`        | TEXT        | `buy` \| `experience` \| `gift` (default `buy`) |
| `price`       | NUMERIC     | optional, for context |
| `priority`    | TEXT        | desire level: `high` \| `medium` \| `low` |
| `url`         | TEXT        | optional product / reference link |
| `image_url`   | TEXT        | optional image (URL/paste) |
| `category`    | TEXT        | **managed** category (defaults + custom); the primary grouping |
| `for_person`  | TEXT        | optional — gift recipient (can later link to People) |
| `notes`       | TEXT        | optional |
| `status`      | TEXT        | `wanted` \| `got` \| `archived` (default `wanted`) |
| `created_at`  | TIMESTAMPTZ | |
| `got_at`      | TIMESTAMPTZ | set when marked "Got it" |

Migration: `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS public.wishlist (...)` + RLS
to match the other per-user tables.

---

## 3. Features

**Core (v1)**
1. **Add / edit item** via a modal: title, type toggle (Buy/Experience/Gift),
   optional price, priority (High/Med/Low), link, image, category, "for" (gifts
   only), notes.
2. **List of items** as cards — image or colored placeholder, title, price,
   priority chip, type chip, link-out icon.
3. **Categories (first-class):**
   - A managed category list with **defaults** (Tech, Travel, Home, Fashion, Health,
     Experiences, Gifts, Other) and **custom** categories you add.
   - The list is **grouped into category sections** by default (collapsible, Tasks-style
     section cards: dot + category name + count), so the wishlist reads as organized
     areas rather than one long pile.
   - **Filter by category** (chips) and a small **category manager** (add / rename /
     remove), reusing the same pattern as the Tasks/Finance category managers.
4. **Filter chips**: by type (All · Buy · Experience · Gift) and by category, plus a
   Wanted / Got toggle.
5. **Sort**: Priority (desire) · Price (low→high / high→low) · Recently added · Name.
6. **Search** by title.
6. **Per-item actions**: open link, edit, **"Got it ✓"** (moves to *Got* with a
   subtle celebration), delete.
7. **Header stats** (lightweight, no savings): item count · total price of all
   *wanted* items ("you want ₹X of stuff") · number got this month.
8. **Empty state** with a friendly prompt + Add button.

**Nice-to-have (later, designed-for but not built now)**
- "Promote to Vision" for experiences; "Save toward this" (create a Fund) for buy
  items; link `for_person` to a People contact; share a wishlist.

---

## 4. Look & feel

Uses the existing design system (`--surface-*` / `--text-*` tokens, card radius
16, the same chip/badge language as Tasks & Daily Tools).

### Desktop (≥1100px)
- **Header row:** quiet stat cluster (`12 items · ₹48,000 wanted · 2 got`) on the
  left; **+ Add** button on the right (page-action style, like People/Vision).
- **Controls row:** type filter chips + Wanted/Got toggle on the left; search +
  sort dropdown + grid/list view toggle on the right (mirrors People).
- **Main:** items **grouped into category sections** by default — Tasks-style section
  cards (colored dot + category name + count + collapse), each holding a responsive
  **card grid** (`repeat(auto-fill, minmax(240px, 1fr))`) of image-forward cards:
  - image/thumbnail (or a category-tinted color block if none) up top,
  - title, optional price, a priority chip (red/amber/green) and a small type chip
    with an icon (cart / compass / gift),
  - hover reveals quick actions (open link · got · edit · delete).
  A **flat grid** (ungrouped) toggle is offered for when you'd rather see everything
  sorted by priority/price across all categories.
- **Optional right rail** (consistent with other views, can be skipped for v1):
  *By type* breakdown bar, *Top wants* (high-priority items), *Recently got*.

### Phone web (<1100px) — same code, responsive
- Single-column **list of compact rows**: thumbnail left, title + price + priority,
  a link/got action on the right. (Cards collapse to 1 column.)
- Filter chips scroll horizontally; search + sort sit in a compact row.
- **Add** via a top page-action "+" (and/or the existing FAB).
- Tap a row → detail/edit in a **bottom sheet** (the app's mobile modal pattern);
  on desktop the same opens as a centered modal.
- Rail hidden on phone (like Finance/Habits/People).

### Interaction feel
- **Priority** = colored chip or 1–3 "want" level; **type** = chip + icon.
- **"Got it"** ticks the card, plays a subtle check/fade, and the item drops into a
  *Got* section — small, satisfying, motivating (no streaks/quotas).
- Images optional; missing image → a clean color placeholder keyed to type/category
  (reuses the Vision color-card idea), so the grid never looks broken.

---

## 5. Wiring (how it slots into the app)

- `view-wishlist.js` defines `window.renderWishlist` (+ CRUD via `apiCall('…','wishlist',…)`).
- Register in `VIEW_MAP` (`wishlist → view-wishlist.js / renderWishlist`) and in
  `PAGE_TITLES` (`Wishlist`). Lazy-loaded — no index.html script tag needed.
- Add a **Wishlist card** to the Daily Tools hub (`DAILY_TOOLS` array) with a gift/
  star icon → `routeTo('wishlist')`.
- It auto-appears in the Settings tab-toggle list (built from the nav) and isn't
  hidden by default.

---

## 6. Build outline (phases)

1. **DB** — `wishlist` table: schema + migration + `ALLOWED_COLUMNS`.
2. **View** — `view-wishlist.js`: render grid/list, add/edit modal, filters, sort,
   search, got/delete, header stats, empty state.
3. **Hub + routing** — VIEW_MAP, PAGE_TITLES, Daily Tools card.
4. **Responsive CSS** — desktop grid + phone list/sheet (one stylesheet, breakpoints).
5. **Verify** — `node --check`, `npm run verify`, hand over the migration to run.

---

## 7. Decisions to confirm before building

- **Priority scale:** 3 levels (High/Med/Low) — *recommended* — vs 1–5 stars.
- **Images:** URL/paste only for v1 (no device upload — avoids storage work) —
  *recommended*.
- **"Got it":** keep in a *Got* section (history) — *recommended* — vs delete outright.
- **Right rail on desktop:** include the breakdown/recently-got rail, or keep it a
  clean single grid for v1.
- **Total-price stat:** show "₹X of stuff wanted" in the header, or hide it.
- **Grouping:** group by category sections (default) vs a flat grid — or offer both
  via a toggle (*recommended*).
- **Default categories:** confirm the starter set (Tech, Travel, Home, Fashion,
  Health, Experiences, Gifts, Other) — easy to change.
- **Type vs category:** keep *type* (Buy/Experience/Gift) as a small secondary tag
  alongside categories (*recommended*), or drop type and let categories carry
  everything.
