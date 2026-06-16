# Supabase Migration — Setup Steps

This is what **you** need to do. I'm writing all the code in parallel; once you finish these steps and paste your project's URL + anon key into `web/supabase-config.js`, the app will switch over.

Estimated time: **20 minutes** (mostly waiting for the project to provision).

---

## Step 1 — Create your Supabase account & project (5 min)

1. Go to <https://supabase.com> and click **Start your project**.
2. Sign in with **GitHub** (recommended — fastest).
3. Click **New Project**.
4. Fill in:
   - **Name**: `personalos` (or anything you like)
   - **Database Password**: generate a strong one and **save it in your password manager** — you'll need it for emergency SQL access
   - **Region**: pick the one closest to you. For India, choose **Mumbai (ap-south-1)** — this is critical for low latency.
   - **Pricing Plan**: Free tier (default)
5. Click **Create new project**. Provisioning takes ~2 minutes.

## Step 2 — Run the schema migration (3 min)

While the project provisions:

1. Once ready, click **SQL Editor** in the left sidebar.
2. Click **+ New query**.
3. Open `supabase/schema.sql` from this repo, copy the entire contents, paste into the SQL editor.
4. Click **Run** (bottom right). Wait for "Success" message — it'll create 35 tables, RLS policies, indexes, and triggers.

If you see "Success. No rows returned." → done. If you see errors, copy them and paste in chat — I'll fix.

## Step 3 — Enable Email + Google sign-in (3 min)

1. Left sidebar → **Authentication** → **Providers**.
2. **Email** is enabled by default — leave it.
3. (Optional, recommended) **Google**:
   - Toggle **Enable**.
   - It'll ask for Client ID + Secret. Follow Supabase's link to Google Cloud Console:
     1. Create an OAuth 2.0 Client ID (Web application).
     2. Authorized redirect URI: copy the one Supabase shows you (looks like `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
     3. Paste Client ID and Secret back into Supabase.
4. Save.

If you skip Google, you'll still have email/password — that's enough.

## Step 4 — Grab your URL and anon key (1 min)

1. Left sidebar → **Project Settings** (gear icon) → **API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon / public key** (long JWT starting with `eyJ...`)

These are safe to put in client code — RLS protects your data.

## Step 5 — Paste into the app config (30 sec)

Open `web/supabase-config.js` and replace the placeholders:

```js
window.SUPABASE_CONFIG = {
    url: 'https://YOUR-PROJECT.supabase.co',
    anonKey: 'eyJ...your-anon-key...',
    enabled: true   // ← flip this to true to switch over
};
```

## Step 6 — Build + reload (1 min)

```bash
cd /Users/rohitdubey/Downloads/OS-master
rm -rf www && npm run build
```

Hard-refresh. You'll see a login screen. Sign up with email/password (or Google) → land on an empty dashboard. Add a task to confirm writes work.

---

## Step 7 (optional) — Migrate your existing Google Sheet data

If you want your historical data to come over:

1. In your Google Sheet, **File → Download → CSV** for each sheet tab you care about (tasks, habits, expenses, diary, vision_board, etc.).
2. In Supabase: **Table Editor** → pick the table → top-right `Insert` → **Import data from CSV**.
3. Upload the CSV.
4. **Important**: when prompted, set `user_id` to your own user's UUID. To find your UUID:
   - Authentication → Users → click your row → copy the `id` field.
   - You can either edit each CSV to add a `user_id` column with your UUID before upload, or use the Table Editor's "Add row" defaults.
5. Repeat per sheet tab.

I'll write a small import helper if this is annoying — just say so.

---

## What stays the same / what changes

- **Android + iOS builds**: untouched. The change is purely in the web layer.
- **Code.gs / Google Apps Script**: stays where it is. Once Supabase is working, we can retire it; until then, flipping `enabled: false` in `supabase-config.js` rolls back instantly.
- **localStorage caching**: still works. Reads are cached the same way; you'll just notice writes are 5–10× faster.
- **All 30+ tables**: same names, same columns. Plus `user_id` (auto-set by the app) and `created_at` / `updated_at` audit fields.

---

## What you get out of this

| Before (Google Sheets) | After (Supabase) |
|---|---|
| 500ms–2000ms per write | 50–200ms per write |
| Single user (you) | Unlimited users, each sees only their own data |
| 5MB/sheet limits, 1000 rows soft cap | 500MB free tier (your data is tiny) |
| No auth — anyone with the script URL can write | Email/Google login + Row-Level Security |
| Reads block the UI | Reads are fast enough to feel instant |
| Quotas: 20K writes/day | Quotas: practically unlimited for one user |

---

## Ping me when

- Step 5 is done (URL + key pasted, `enabled: true`) → tell me, I'll do a smoke test
- You hit any error in Step 2 (SQL run) → paste the error
- You want help with Step 7 (data migration)
