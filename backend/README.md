# `backend/` — Google Apps Script

The whole server-side of PersonalOS is a single Google Apps Script attached to a Google Sheet. It exposes a tiny REST-like API that `web/main.js`'s `API_BASE` calls.

## Files

```
backend/
├── Code.gs                  ← the actual Apps Script (~1300 lines)
├── get_settings_sheet.js    ← local helper / scratch
└── generate_sounds.py       ← one-off script to generate notification sound files
```

## API contract (called from `web/main.js`)

All requests go to a single Apps Script Web App URL (the `API_BASE` constant in `web/main.js`). The shape is:

| Verb | Payload | Returns |
|------|---------|---------|
| `?action=getAll&t=...` (GET) | — | `{success, data: {tasks: [...], habits: [...], ...}}` (bulk fetch — preferred) |
| `?sheet=X&action=get&t=...` (GET) | — | `{success, data: [...]}` (single sheet fallback) |
| POST `{action:"create", sheet, payload}` | full row | `{success, data: {id}}` |
| POST `{action:"update", sheet, id, payload}` | partial row | `{success}` — **silently drops keys whose column header doesn't exist in the sheet** |
| POST `{action:"delete", sheet, id}` | — | `{success}` |

POST bodies use `Content-Type: text/plain;charset=utf-8` to avoid CORS preflight. Apps Script reads the body via `e.postData.contents`.

## Schema (sheets + columns)

Defined at the top of `Code.gs` in the `SCHEMAS` map. Each sheet has a fixed column order. Adding a new field requires:

1. Add the column name to the schema array in `Code.gs`
2. **Add a column header in the actual Google Sheet's first row, matching the name exactly**
3. Redeploy the Apps Script (Deploy → Manage deployments → Edit → New version)

**Critical gotcha:** the `updateData` function only writes to columns that already exist as headers in the sheet:

```javascript
headers.forEach((header, index) => {
    if (payload.hasOwnProperty(header)) {
        sheet.getRange(...).setValue(...);
    }
});
```

If you add a field to the schema but forget the sheet column, **saves return `{success: true}` but the field is silently dropped**. This was the cause of the "tab visibility doesn't save" bug.

## Caching

`Code.gs` uses `CacheService` for bulk fetches (5-min default TTL). Mutating endpoints call `clearCache()` before returning. If you ever see stale data, the cache is the first place to look.

## Redeploy after schema changes

1. Open the bound Google Sheet → Extensions → Apps Script
2. Paste the contents of `Code.gs` over the editor
3. **Deploy → Manage deployments → click the pencil → New version → Deploy**
4. The Web App URL stays the same (`API_BASE` doesn't change)

If you change the deployment to a NEW URL by mistake, update `API_BASE` in `web/main.js`.

## Security note

The `API_BASE` URL is **effectively public**. Anyone who can extract it from your APK can call your backend. The Apps Script runs as YOUR Google account, so anything it does (read your sheet, send mail, etc.) is done with your privileges. Be conservative about what the API exposes.

## Common gotchas

- **`updateData` silently drops a field:** sheet is missing that column header. See "Schema" above.
- **`getAll` returns stale data:** `CacheService` cached it. The `t=${Date.now()}` query param in the URL doesn't bypass Apps Script cache; only `clearCache()` from a mutation does. Force a refresh by editing the sheet directly or making any POST.
- **CORS preflight failures:** the POST Content-Type must be `text/plain`, never `application/json`. Apps Script Web Apps don't handle CORS preflight.
- **Multiple settings rows:** `web/main.js` always uses `state.data.settings[0]`. If your sheet has duplicates, only the first row's values apply — and on reload the row order might shift. Keep exactly one row in the `settings` tab.
