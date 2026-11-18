# Expedite Request Dashboard

A shared dashboard for logging and analyzing expedite requests from Ops to Prefab. The team signs in with their company email, logs requests in a form, and every chart updates for everyone.

- **Website:** GitHub Pages (free), serving `index.html`, `styles.css`, `app.js` and `config.js`
- **Database and sign-in:** Supabase (free tier), set up by `supabase/schema.sql`
- **Who can use it:** only people signed in with an `@powerdesigninc.us` email address

> Check with IT before going live. Request data is stored in Supabase, an outside cloud service.

## Files

| File | What it does |
|---|---|
| `index.html` | The page layout: sign-in, form, filters, charts and request log |
| `styles.css` | Colors, fonts and layout, with light and dark mode |
| `app.js` | Loading and saving requests, the charts, filters and CSV export |
| `config.js` | **The only file you edit:** your Supabase URL and key |
| `supabase/schema.sql` | Creates the database tables and the access rules |

---

## Setup (about 20 minutes, no coding)

### 1. Create the database in Supabase

1. Go to [supabase.com](https://supabase.com) and sign up (a GitHub login works).
2. Click **New project**. Name it `expedite-dashboard`, set a database password (save it somewhere safe), pick the region closest to you, and click **Create**. Wait a minute or two for it to finish.
3. In the left menu, open **SQL Editor** and click **New query**.
4. Open `supabase/schema.sql` from this repo, copy everything, paste it in, and click **Run**. You should see "Success. No rows returned."

### 2. Set up sign-in

In Supabase, go to **Authentication → Sign In / Providers → Email**. Choose one option:

- **Option A: quickest, for a pilot.** Turn **off** "Confirm email". People can create an account and sign in right away. The database still only accepts `@powerdesigninc.us` addresses, but it can't prove that someone owns the address they typed.
- **Option B: with email confirmation.** Leave "Confirm email" **on**, and set up your company's email server under **Authentication → Emails → SMTP Settings** (ask IT). Supabase's built-in email sender only allows a few emails per hour, so it isn't reliable for a team.
- **Option C: Sign in with Microsoft (best long-term).** Ask IT to register an app in Microsoft Entra ID (Azure AD) and enable the **Azure** provider in Supabase with its client ID and secret. Then set `MICROSOFT_SIGN_IN: true` in `config.js`. Everyone signs in with their normal work account.

### 3. Copy your keys into `config.js`

1. In Supabase, go to **Project Settings → API** (or **Data API / API Keys**).
2. Copy the **Project URL** and the **anon public** key.
3. Paste them into `config.js`:

   ```js
   SUPABASE_URL: "https://abcdefghijk.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```

The anon key is meant to be public. The access rules in `schema.sql` decide who can read and write. **Never** put the `service_role` key in this repo.

### 4. Put the site on GitHub

1. Sign in at [github.com](https://github.com) and click **New repository**. Name it `expedite-dashboard`. Choose **Private** if your plan allows Pages on private repos; otherwise **Public** is fine, since the code has no secrets and the data stays behind sign-in.
2. On the new repo page, click **uploading an existing file**. Drag in `index.html`, `styles.css`, `app.js`, `config.js`, `README.md` and the `supabase` folder, then click **Commit changes**.
3. Go to **Settings → Pages**. Under "Build and deployment", set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, and click **Save**.
4. After a minute, the page shows your site address, for example `https://your-name.github.io/expedite-dashboard/`.

### 5. Tell Supabase your site address

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL:** your GitHub Pages address
- **Redirect URLs:** add the same address

This makes confirmation emails and Microsoft sign-in return to your site.

### 6. Try it

Open the site, click **Create account** with your company email, sign in, and log a test request. Open the site in a second browser window: the request shows up there too. Delete the test request when you're done.

---

## Using the dashboard

- **+ New request** opens the form. Request IDs number themselves (EXP-001, EXP-002 and so on). You can add a new project (ID, name, PM) from inside the form.
- **Edit and Delete** buttons are on each row of the request log. Delete asks you to confirm.
- **Filters** (project, PM, reason, approval, date range) apply to every chart and the log. Click a bar in *Requests by reason* or *Requests by project* to filter by it.
- **Export CSV** downloads the requests in the current view. The file opens in Excel.

## Changing things

| To change… | Edit |
|---|---|
| The dropdown choices (reasons, date sources, how communicated) | The `LISTS` block near the top of `app.js` |
| The "short notice" cutoff (7 days) | `SHORT=7` near the top of `app.js` |
| Colors | The `:root` block at the top of `styles.css` |
| The allowed email domain | `ALLOWED_DOMAIN` in `config.js` **and** the three places in `schema.sql` (then run it again) |

After you edit a file on GitHub (open it, click the pencil, then **Commit changes**), the site updates within a minute or two.

## Troubleshooting

- **"Finish setup" message:** `config.js` still has the placeholder values. Paste in your URL and anon key.
- **"Email or password is incorrect":** check for typos. If email confirmation is on, click the link in the confirmation email first.
- **Signed in, but no requests load:** run `schema.sql` again, and check that you signed in with an `@powerdesigninc.us` address.
- **Other people's changes don't show up until reload:** in Supabase, go to **Database → Publications → supabase_realtime** and make sure `requests` and `projects` are turned on.
- **Supabase project paused:** free projects pause after a week with no use. Open the Supabase dashboard and click **Restore project**.
