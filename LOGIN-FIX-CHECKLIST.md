# Login fixes — what changed & the 5-minute Supabase dashboard setup

The code now does the right thing on both web and the native app, but Supabase
will refuse to redirect anywhere it doesn't trust. Do these once in the
dashboard (https://supabase.com/dashboard → project `rurrkbefatxxygwcbpyr`).

## 1. Whitelist the redirect URLs (fixes "verification link doesn't open the app")

Authentication → URL Configuration:

- **Site URL**: set this to the URL where you open the web version
  (e.g. `https://<your-username>.github.io/OS-master/` or wherever the PWA is
  hosted). If you only ever use the native app, set it to
  `personalos://auth-callback`.
- **Redirect URLs** — add ALL of these:
  - `personalos://auth-callback`        ← the app deep link (email + Google)
  - `https://localhost`                 ← Android webview origin
  - `capacitor://localhost`             ← iOS webview origin
  - your web URL with a wildcard, e.g. `https://<your-username>.github.io/**`
  - `http://localhost:*` (only if you test in a local dev server)

Without this, Supabase silently falls back to the Site URL (default
`http://localhost:3000`) — which is exactly the "link takes me nowhere" bug.

## 2. Google provider (fixes "Google login not working")

Authentication → Sign In / Providers → Google:

1. Toggle **Enable** on.
2. In Google Cloud Console (https://console.cloud.google.com/apis/credentials):
   - Create an **OAuth 2.0 Client ID**, type **Web application**.
   - Authorized redirect URI (exactly this):
     `https://rurrkbefatxxygwcbpyr.supabase.co/auth/v1/callback`
   - Configure the OAuth consent screen if prompted (External, add your email
     as a test user or publish).
3. Copy the **Client ID** and **Client Secret** into the Supabase Google
   provider form and Save.

If Google was never configured, the button failed instantly — that alone
explains "not working" on the web. On the native app there was a second bug:
Google blocks OAuth inside webviews, so the code now opens the system browser
and returns via the `personalos://auth-callback` deep link.

## 3. What the code changes did (nothing for you to do)

- `web/supabase-client.js` — switched auth to the PKCE flow (the safe flow for
  mobile deep links; also fine on web).
- `web/supabase-auth.js` —
  - sign-up now sends `emailRedirectTo` (app deep link on native, your page on
    web) so the verification email lands back in the app;
  - Google sign-in on native opens the **system browser** and finishes the
    session when the browser bounces back to `personalos://auth-callback`
    (handles both `?code=` and `#access_token=` shapes);
  - web Google sign-in redirects back to the exact page you were on.
- `web/main.js` — the deep-link router ignores `personalos://auth-callback` so
  it isn't mistaken for a view navigation.

## 4. Rebuild & test

```bash
cd /Users/rohitdubey/Downloads/OS-master
npm run build          # web/PWA
npx cap sync           # push into android/ + ios/
```

Test matrix:
- Web: Create account → email link should land on your web URL, signed in.
- Web: Continue with Google → back to the app, signed in.
- Android app: Create account → open the email **on the phone** → link opens
  the app → signed in.
- Android app: Continue with Google → Chrome opens → pick account → app
  reopens → signed in.

Note: an email verification link only completes sign-in on the device where
you signed up (PKCE security). Clicked elsewhere, it still verifies the
account — just sign in with your password afterwards.
