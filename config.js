// ─────────────────────────────────────────────────────────────
//  Expedite Request Dashboard: settings
//  Fill these in from Supabase → Project Settings → API.
//  The "anon public" key is safe to put here: the database rules
//  in supabase/schema.sql decide who can read and write.
// ─────────────────────────────────────────────────────────────
window.EXPEDITE_CONFIG = {
  SUPABASE_URL: "https://abitsztwgdwcmiqkjswd.supabase.co.",
  SUPABASE_ANON_KEY: "sb_publishable_ukUyWccCejchxDWu9G6C0Q_kSeKcmmH",

  // Only people with this email domain can sign in.
  // Must match the domain in supabase/schema.sql.
  ALLOWED_DOMAIN: "powerdesigninc.us",

  // Set to true only after IT sets up "Sign in with Microsoft"
  // (Supabase → Authentication → Providers → Azure). See README.
  MICROSOFT_SIGN_IN: false
};
