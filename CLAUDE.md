# Jain Vivah — Project Notes

Last updated: 23 July 2026

> **Do not put passwords, SMTP keys or service-role keys in this file.**
> The `jainvivah` repo is **public**. Keys live only in the Supabase dashboard
> and in your own private notes. The Supabase **anon** key is safe in `config.js`
> because it is designed to be public and is protected by row-level security.

---

## 1. What this app is

A privacy-first matrimonial PWA for the Jain community.

Core idea: a member's **contact number is never shown**. Another member sends
an Interest; only when it is **accepted** do both sides receive each other's
mobile number and full bio-data file. This is enforced in the **database**, not
just in the app, so it cannot be bypassed from the browser.

Key decisions already settled:

- Jain community only, self-declared at signup with sect
- Free to use. A `plan` column exists for a future paywall
- Typed form, not AI reading of PDFs
- Up to 3 photos, clear (not blurred), watermarked at view time
- Photos visible only to members whose own profile is complete
- **Superseded 26 Sep 2026** — ~~No matching/eligibility filter — plain browse with filters~~.
  Browse now defaults to the member's own stored "My Preference" fields
  (age/height/weight/diet/education/profession/income/city), with a
  member-facing toggle between matching all of them or just the lighter
  Age+Diet+Profession trio. See `browse.html`'s "Match mode" section below.
- Age enforced: female 18+, male 21+ (Indian legal marriage age)
- Profile managed by Self / Father / Mother / Brother / Sister / Relative
- **Gender is now editable at any time** (25 Sep 2026) — the earlier "locked
  after signup" rule was explicitly reversed. `myprofile.html` and
  `register.html` both show it as a Male/Female tap-choice, never disabled.
- **Browsing/viewing other profiles requires a verified mobile number**
  (25 Sep 2026) — enforced client-side in `browse.html` and
  `profile-view.html` by checking `mt_contacts.mobile_verified` before
  allowing access, AND backed by RLS since 25 Sep 2026 (`mt_is_verified()`
  added into `mt_profiles_sel`/`mt_photos_sel` — see below).

---

## 2. Hosting and domain

| Item | Value |
|---|---|
| Repo | `github.com/vkv-coder/jainvivah` (public) |
| Local path | `C:\Users\ADMIN\Desktop\jainvivah` |
| Live URL | `https://jainvivah.anyapps.in` |
| Hosting | GitHub Pages, branch `main`, root folder |
| DNS | Cloudflare, zone `anyapps.in` |
| DNS record | CNAME · `jainvivah` → `vkv-coder.github.io` · **DNS only (grey cloud)** |

**Gotcha hit during setup:** the CNAME target had a typo (`github.iop`) and was
first created under the wrong zone (`sportbook.in`). Both caused
"DNS check unsuccessful" in GitHub Pages.

**Standalone `jainvivah.in` domain — nameserver switch to Cloudflare blocked
until ~24 Nov 2026.** Bought fresh on Hostinger 25 Sep 2026. Hostinger (and
apparently most registrars, confirmed by their support, not `.in`-specific)
enforces a mandatory 60-day nameserver-lock on any newly registered domain —
same rule that also applied to `anyapps.in`/`khursilo.in`/`deallagi.in`, it
just wasn't noticeable there because by the time their nameservers were
switched to Cloudflare, their own 60-day windows had already quietly expired
months earlier. Nothing to debug or retry here — the site itself is
unaffected (still fully live at `jainvivah.anyapps.in`); only the standalone
`jainvivah.in` → Cloudflare pointing is paused until the lock lifts.

---

## 3. Supabase

**Project: `Rotary_Events`** — shared with DealLagi, Trust Analysis. (Corrected
25 Sep 2026: SportBook is on a *different* Supabase project, not this one —
earlier notes here were wrong about that.)

- URL: `https://wrzpgultvahxbrgooibn.supabase.co`
- Table prefix for this app: **`mt_`**
- Storage bucket: **`mt-photos`** (private, not public)
- Login: email + password (Supabase Auth)

### Hard rules for this project

1. **Never create a trigger on `auth.users`.** A bad auth trigger once blocked
   all user creation across every app on Dhobi-digital. Do not repeat it.
2. **All SQL must be add-only.** `create table if not exists`,
   `add column if not exists`. No `DROP`, no `CASCADE`, no `ALTER` on tables
   belonging to other apps.
3. **Every object must start with `mt_`** so nothing collides with `sp_`,
   `dl_` or `ta_` tables.
4. **A 400 from a read probe does NOT mean a column is missing.** Row-level
   security returns 400 for columns that exist but are not readable. Confirm
   with:
   ```sql
   select column_name from information_schema.columns
   where table_name = 'mt_profiles' order by column_name;
   ```
   This caused several wasted cycles — Claude Code concluded columns did not
   exist when they did.

### Tables

| Table | Purpose |
|---|---|
| `mt_profiles` | All profile data except contact. One row per user. |
| `mt_contacts` | Mobile, alt mobile, email, address. **Locked.** |
| `mt_photos` | Up to 3 photo rows per user, path into `mt-photos` bucket |
| `mt_interests` | sender, receiver, status, locked_until |
| `mt_blocks` | mutual hiding |
| `mt_reports` | abuse reports |
| `mt_views` | who viewed whose profile |
| `mt_admins` | admin user ids |
| `mt_settings` | interest limit, decline lock, min ages, etc. |

### The privacy rule (the heart of the app)

`mt_contacts` has a row-level policy allowing a read **only** when:

- it is your own row, **or**
- you are an admin, **or**
- an `mt_interests` row exists between the two users with `status = 'accepted'`

So a contact number cannot be read from the browser until acceptance. This is
database-enforced.

### Columns added after the original schema

Run in SQL Editor, all already applied:

```sql
alter table mt_profiles add column if not exists created_by_name text;   -- now unused
alter table mt_profiles add column if not exists father_living   text;
alter table mt_profiles add column if not exists mother_living   text;
alter table mt_profiles add column if not exists brothers        text;
alter table mt_profiles add column if not exists sisters         text;
alter table mt_profiles add column if not exists pref_age_min    int;
alter table mt_profiles add column if not exists pref_age_max    int;
alter table mt_profiles add column if not exists pref_height_min int;
alter table mt_profiles add column if not exists pref_height_max int;
alter table mt_profiles add column if not exists pref_weight_min int;
alter table mt_profiles add column if not exists pref_weight_max int;
alter table mt_profiles add column if not exists pref_education  text[];
alter table mt_profiles add column if not exists pref_profession text[];
alter table mt_profiles add column if not exists pref_diet       text;
alter table mt_profiles add column if not exists pref_income     text;
alter table mt_profiles add column if not exists pref_city       text;
alter table mt_profiles add column if not exists pref_special    text;
alter table mt_profiles add column if not exists biodata_path    text;
alter table mt_profiles add column if not exists draft_step      int;

-- Added 25 Sep 2026 - see "Batch 2.5" below.
alter table mt_profiles add column if not exists education_detail text;   -- college/specialisation detail; also read by profile-view.html
alter table mt_profiles add column if not exists occupation_detail text;  -- business/company name, or college name if profession = Student
alter table mt_profiles add column if not exists diet_detail      text;   -- free text when diet = 'other'
alter table mt_contacts add column if not exists mobile_relation  text;   -- whose number it is: self/father/mother/brother/sister/uncle/aunt/relative
```

### CHECK constraint values — the single biggest source of bugs

These columns accept **only** these lowercase codes. Anything else, including
an empty string `""`, is rejected by the database:

| Column | Allowed values |
|---|---|
| `gender` | `male`, `female` |
| `diet`, `pref_diet` | `jain`, `veg`, `vegan`, `other` |
| `marital_status` | `unmarried`, `divorced`, `widow`, `widower` |
| `managed_by` | `self`, `father`, `mother`, `brother`, `sister`, `relative` |

`gender`, `full_name` and `dob` are **NOT NULL**.

**Fix already implemented:** `normaliseCodes(row)` in `app.js` gates every
write to `mt_profiles`. It trims, lowercases, maps legacy `son`/`daughter` →
`father`, and **deletes the key entirely** if the value is empty or not in the
allowed list. Every save path, including per-step draft saves, must go through it.

**Second fix:** each step must send **only its own fields** and must **update**
by `user_id`, never upsert a whole assembled object. Upsert was re-sending
`null` for columns the current step does not own, which is what caused the
repeated "null value in column gender" errors.

### Per-app email tagging (added 25 Sep 2026)

`auth.users` is shared with DealLagi and Trust Analysis - one row per email,
one password. Before this fix, a member who already used one of those apps
would hit an "already registered" wall signing up for Jain Vivah, and get
funnelled into a forced password reset that also changed their password on
the *other* app (same shared row) - confusing, and not something they asked
for. Fixed by tagging every auth call (`signUp`, `signInWithPassword`,
`resetPasswordForEmail`) with `tagAuthEmail()` (in `app.js`), which turns
`name@domain` into `name+jainvivah@domain` before it ever reaches Supabase.
Gmail/Outlook/Yahoo deliver "+anything" mail to the same inbox as the plain
address, so this is invisible to the member - they only ever type/see their
plain email. `untagAuthEmail()` reverses it for the two spots that fall back
to displaying `currentUser.email`/`session.user.email` directly
(`myprofile.html`, `register.html`'s contact step), so the tag is never
shown in the app itself.

Two things this does NOT cover:
- **Doesn't apply retroactively.** Accounts already registered under a plain
  email before this fix (e.g. early test accounts) stay on the shared/plain
  row unless they sign up fresh.
- **Confirmation/reset emails do show the tagged address** in the one line
  Supabase's own template renders via `{{ .Email }}` (e.g. "confirm
  john+jainvivah@gmail.com") - a minor cosmetic detail, not a functional
  problem, and not something worth fighting since it'd mean giving up
  Supabase's own placeholder.
- **DealLagi and Trust Analysis are NOT tagged** - this only protects Jain
  Vivah's side of the collision. If either of those apps ever signs up the
  same email after Jain Vivah did, that collision (and forced reset) can
  still happen on their end. Fixing that would mean adding the same tagging
  there, a separate task in their own repos.

### Auth settings

- **Confirm email:** ON
- **Redirect URLs** (Authentication → URL Configuration) — added:
  `https://jainvivah.anyapps.in/**`
- **Site URL is shared with other apps — never change it.** Every auth call
  must pass its own `emailRedirectTo` / `redirectTo`, and that URL must also
  be on the allow-list, or Supabase silently falls back to the Site URL and
  the member lands on a different app.

### Make yourself admin

```sql
insert into mt_admins (user_id, email)
select id, email from auth.users where email = 'unigoods2026@gmail.com'
on conflict (user_id) do nothing;
```

---

## 4. Email — Brevo setup (done)

### Why it was needed

Supabase's built-in mailer sends **2 emails per hour for the whole project**
and **only to addresses that are members of the Supabase organisation**. Real
users receive nothing. It is documented as non-production.

First attempt used Gmail SMTP. It worked, but Gmail showed recipients a red
**"This message might be dangerous"** banner, because mail claiming to be from
an app was arriving from a personal Gmail address. Replaced with Brevo.

### Brevo account

- Signed up with `info.anyapps@gmail.com`
- Free plan: **300 emails per day**, shared across everything using it
- Domain **`anyapps.in`** authenticated, branded subdomain **`mail.anyapps.in`**
- SMTP login is **not** an email address — it looks like `b30cb2001@smtp-brevo.com`
- The SMTP key is shown **once only**. If lost, generate a new one.
- Keys also expire after **90 days of no sending**, and on **23 July 2027**

### DNS records added in Cloudflare (zone `anyapps.in`)

| Type | Name | Content | Proxy |
|---|---|---|---|
| TXT | `@` | `brevo-code:...` | — |
| TXT | `@` | `v=spf1 include:spf.brevo.com mx ~all` | — |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info.anyapps@gmail.com,mailto:rua@dmarc.brevo.com` | — |
| CNAME | `brevo1._domainkey` | `b1.anyapps-in.dkim.brevo.com` | **DNS only** |
| CNAME | `brevo2._domainkey` | `b2.anyapps-in.dkim.brevo.com` | **DNS only** |
| CNAME | `img.mail` | `mail-anyapps-in.img.brand.brevosend.com` | **DNS only** |
| CNAME | `r.mail` | `mail-anyapps-in.r.brand.brevosend.com` | **DNS only** |

Rules learned:

- Only **one** SPF record and **one** DMARC record per domain, ever.
  Brevo wanted its own DMARC, so the existing one was **edited** to include
  both report addresses rather than adding a second record.
- All Brevo CNAMEs must be **grey cloud**. Orange proxy breaks DKIM.
- Multiple DKIM records can coexist safely — each has its own prefix.

### SMTP settings — applied to BOTH Supabase projects

Authentication → Emails → SMTP Settings → Enable Custom SMTP

| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | `b30cb2001@smtp-brevo.com` |
| Password | *(Brevo SMTP key — kept out of this file)* |
| Sender email | `noreply@anyapps.in` |
| Sender name | `AnyApps.in` |

Rate limit left at the default 30/hour. That is a safety cap against bot
signups, not a restriction worth raising.

**Do not enable Brevo's "block unauthorised IPs"** — mail is sent from
Supabase's servers, whose IP addresses change without notice. Turning it on
would silently kill all signup mail.

### Email templates

Both projects use the **same neutral AnyApps.in template**, not Jain Vivah
branding, because the templates are shared by every app on the project.
Trust Analysis has a Forgot Password link, so its admin would otherwise
receive Jain Vivah branded mail.

Templates set: **Confirm signup** and **Reset password**, each with its own
correct wording and button text. `{{ .ConfirmationURL }}` and `{{ .Email }}`
are Supabase placeholders and must be left exactly as they are.

### Dhobi-digital project — same treatment

The second Supabase project (Mera Hisaab, Reminders, Derasar Boli, Production
Tracker, Appointment, Contract Note Converter) has the **same Brevo SMTP
settings and the same two templates**.

Redirect URLs added there:

```
https://derasar-boli.anyapps.in/**
https://appointment.anyapps.in/**
https://production.anyapps.in/**
https://reminders.anyapps.in/**
https://merahissab.anyapps.in/**
```

### What did NOT change

**Google Apps Script mail is untouched.** DealLagi price alerts, booking
notifications and every other GAS-driven mail still send from
`unigoods2026@gmail.com` with Google's own limits. Apps Script mail and
Supabase auth mail are two entirely separate pipes. Only the second moved
to Brevo.

### Diagnosing "no mail arrived"

In order:

1. Supabase returns **HTTP 200 even when the email address does not exist** —
   deliberate, so the form cannot be used to discover who is registered.
   A 200 is not proof anything was sent.
2. A signup for an **already-registered** address shows the same
   "confirmation sent" message and sends nothing.
3. Check **Brevo → Transactional → Logs**. If the message is listed there,
   Supabase handed it over successfully and it is a delivery matter.
   If nothing is listed, the SMTP credentials are wrong — usually the
   username, which must be `b30cb2001@smtp-brevo.com`, not an email address.
4. First sends from a newly authenticated domain are slow while Gmail builds
   reputation. This settles on its own.

---

## 5. Build progress

### Done

- **Batch 1 — Foundation:** `config.js`, `app.js`, `index.html` (login +
  signup), `privacy.html`, `terms.html`, `reset.html`, `styles.css`,
  `manifest.json`, `sw.js`, icons
- **Batch 2 — Profile:** `register.html` (5-step wizard), `myprofile.html`,
  photo upload with browser-side compression to ~150 KB, bio-data attachment
  (also editable from `myprofile.html`), draft save and resume, review
  screen, logout
- Icons: interlocking rings in cream and gold on maroon
- Invocation strip `🙏 || Jai Jinendra || 🙏` on every page — chosen over a
  Shwetambar Murtipujak invocation because the app serves all four sects
- **Form deliberately trimmed to mandatory fields only (24 Jul 2026):** the
  Family step (father/mother, brothers/sisters, mosal) and every other
  non-mandatory field were removed outright — Jain bio-data PDFs already
  carry that detail (relatives, their phone numbers, etc.), so instead of
  retyping it the app just accepts an optional bio-data PDF upload. The
  wizard is 5 steps now: Basic, Community & Location, Education & Work,
  My Preference (age range only), Contact & Photos. Contact number/email
  are still only revealed on interest acceptance (Batch 4).

- **Batch 2.5 — Fixes + form rework (25 Sep 2026), all from a live testing
  pass:**
  - Fixed a real bug: `myprofile.html`'s "Save profile" read `gender` from
    the form but never put it in the upsert payload, so the very first save
    for anyone who reached My Profile without finishing `register.html`
    (row does not exist yet → upsert takes the INSERT path) hit `null value
    in column "gender"`. `register.html` never had this bug — it already
    does a deliberate select-then-insert-or-update. Fixed by adding
    `gender` to the payload in `myprofile.html`.
  - Gender unlocked (see decisions above); moved to the top of Basic
    details on both pages.
  - Date of birth is now three dropdowns (Day / Month / Year) instead of
    `<input type="date">`, so it always reads DD/MM/YYYY regardless of
    device locale (native date inputs follow OS locale, which is not
    always DD/MM/YYYY). A read-only Age field next to it recalculates on
    every change via the existing `calcAge()`.
  - Education is now a checkbox list (two or more degrees allowed),
    stored as one comma-separated string — no schema change, since
    `education` has no CHECK constraint. Sect / Diet / Profession each
    gained an "Other, please specify" text field; for Sect and Profession
    (unconstrained columns) the typed text replaces the literal word
    "Other" before saving, for Diet (CHECK-constrained to `other`) the
    typed text goes into the new `diet_detail` column instead.
  - Added `occupation_detail` field under Profession, label switches to
    "College name" when Profession = Student, otherwise "Business /
    Company name" — both optional. (`education_detail`/`occupation_detail`
    were already read by `profile-view.html` with no way to fill them in —
    this closes that gap.)
  - Added a "this number belongs to" relation dropdown (Self / Father /
    Mother / Brother / Sister / Uncle / Aunt / Other relative) next to
    Mobile, stored in the new `mt_contacts.mobile_relation` column.
  - "My Profile" and "Browse" are now a visible pill link under the logo on
    each other's page, not just a footer link next to Privacy/Terms.
  - Added a `<button class="mt-header-back">` (top-left of header,
    mirrors Logout) on every inner page except `index.html` (nothing to go
    back to) and `profile-view.html` (already had its own "← Back to
    Browse" link).
  - Deleting a photo, a bio-data file, or the whole account now asks for
    a native `confirm()` on top of whatever gate already existed (account
    deletion still also requires typing DELETE).
  - Browse filters persist in `localStorage` (`mt_browse_filters`) and
    restore (with the filter panel auto-expanded) next time the member
    opens Browse.
  - Support email is now rendered by JS from `SUPPORT_EMAIL` into
    `<span data-support-email>` placeholders instead of sitting as plain
    "name@domain" text/mailto hrefs in the page source — some mobile
    carrier/browser data-compression modes (e.g. certain Opera Mini/UC
    Browser configurations) rewrite plain email text into a
    "[email protected]" placeholder before non-JS renders ever see it;
    this sidesteps that for every browser that runs the page's JS.
    `privacy.html`/`terms.html` carry their own tiny inline copy of this
    (they intentionally load no other script, so a static legal page never
    breaks if the Supabase CDN script fails).
  - Footer brand line changed from bare "AnyApps.in" to "Powered by
    AnyApps.in" on every page.
  - Signup CTA now reads "Sign Up Free" (tab) / "Sign Up for Free"
    (submit button) instead of "Sign up" / "Create account".
  - **Found and fixed a bug that had silently broken `profile-view.html`
    since it was first written** (pre-dates this whole session): the
    function declared `const location = [profile.city, ...]` for the
    Location table row, later in the *same function* that already read the
    browser's `location.search` near the top (for the `?id=` query param).
    A `let`/`const` creates a temporal-dead-zone for its name across the
    *entire* enclosing function regardless of declaration order, so that
    earlier `location.search` read threw `ReferenceError: Cannot access
    'location' before initialization` synchronously, every single time,
    with nothing ever reaching the DOM - the page just sat on "Loading
    profile..." forever with no visible error unless someone opened
    DevTools. Renamed the local variable to `locationText`. Also added a
    15s `Promise.race` timeout around the whole load so this class of bug
    (or any future hang) shows a "try again" message instead of an
    infinite silent spinner.

### Not built yet

- **Batch 3 — Browse:** search, filters, profile view, **per-viewer photo
  watermark** (belongs here, not in the upload page), view logging
- **Batch 4 — Interests:** ~~send / accept / decline, contact reveal,
  bio-data release on acceptance~~ **built 26 Sep 2026**, see below. Block
  and report are still not built; admin panel (mobile verification) was
  already built 25 Sep 2026 (`admin.html`) — Telegram alerts not built.

### Batch 4 (Interests) built 26 Sep 2026

The database side of this (`mt_interests` table, its RLS, `mt_check_interest`
BEFORE INSERT trigger enforcing the weekly limit/decline-lock/block check,
`mt_interest_after_update` trigger, `mt_settings` rows for
`interest_limit_per_week`/`decline_lock_months`) already existed from early
in the project — only the UI was ever missing. Two real gaps found and fixed
in that existing backend before building any UI on top of it:

- **Bio-data was readable by any complete-profile member, not just an
  accepted interest.** Bio-data files share the `mt-photos` bucket with
  profile photos at a fully predictable path (`<user_id>/biodata.<ext>`),
  and any profile's raw `user_id` is exposed in its own URL
  (`profile-view.html?id=<uuid>`) — so anyone could construct the path
  themselves and pull another member's full bio-data (family/relative
  contact details, per the app's own UI copy) via a signed URL, with no
  interest ever sent or accepted. Fixed by splitting `mt_storage_sel`:
  paths matching `%/biodata.%` now require an `accepted` `mt_interests` row
  between the two users; all other paths (photos) keep the existing
  complete-profile gate, now also matching `mt_photos`' own verified/
  not-blocked checks rather than just completeness.
- **Either party could set status to `accepted` on their own.** The
  UPDATE RLS policy only checked `sender_id = auth.uid() OR receiver_id =
  auth.uid()` with no restriction on which party may set which status, and
  `mt_interest_after_update()` only set `locked_until`/`responded_at` side
  effects — it never checked who was making the change. A sender could
  self-accept their own sent request and unlock the receiver's contact
  details without genuine consent. Fixed by adding a permission check
  inside `mt_interest_after_update()`: only the receiver may go
  pending→accepted or pending→declined; only the sender may go
  pending→withdrawn; every other transition raises an exception.

**UI built**: `profile-view.html` now has a live interest section (replacing
the old "coming soon, email support" placeholder) that renders one of five
states — no interest yet (Send Interest, with an optional message), sent/
pending (Withdraw), received/pending (Accept/Decline), accepted (contact
details + bio-data download link, both now correctly gated), declined/
withdrawn (plain status line). New `interests.html` page is a central inbox
(Received / Sent / Connected sections) so a member doesn't have to
remember which profiles they interacted with — linked from Browse's and My
Profile's header nav, and profile-view.html's footer.

**Known limitation, not fixed**: `mt_interests` has `UNIQUE(sender_id,
receiver_id)` — only one row can ever exist per ordered pair. But
`mt_check_interest()`'s decline-lock check (`locked_until`) only runs on
INSERT, and the status-transition whitelist in `mt_interest_after_update()`
has no path back to `pending` from `declined`/`withdrawn` — meaning once a
pair reaches `declined` or `withdrawn`, sending "interest" to that same
person again is currently impossible (a second INSERT hits the unique
constraint; there is no UPDATE path back to pending either). This looks
like a genuine pre-existing design gap from whenever the schema was first
built, not something introduced today. Not fixed here since it wasn't part
of what was asked for and needs a real design decision (e.g. an UPDATE-back-
to-pending path with its own lock-check, replacing the INSERT-only check)
rather than a quick patch — flagged here so it doesn't get "discovered"
again as a mystery bug the next time someone actually needs to re-send
after a decline-lock expires.

---

## 6. Design system

| Item | Value |
|---|---|
| Primary | `#7B1E3B` deep maroon |
| Background | `#FDF8F3` warm cream |
| Accent | `#C8A34A` muted gold |
| Text | `#2B2B2B` charcoal |
| Headings | serif · Body | clean sans |
| Buttons | min height 48px · Inputs | 16px font so iPhone does not zoom |

Mobile first. Dignified and warm, not a generic startup gradient look.

---

## 7. Open items

- [ ] Full end-to-end test of the 5-step form, draft resume and submit
- [ ] Set the real `WHATSAPP_VERIFY_NUMBER` in `config.js` — still the
      placeholder `919XXXXXXXXX` as of 25 Sep 2026. This is why WhatsApp
      verification looked broken during testing ("not on WhatsApp", opens
      WhatsApp Business): the deep link points at a fake number, so
      WhatsApp itself rejects it and the phone falls back to whichever
      WhatsApp variant is its default handler - nothing to do with how
      verification is checked (it is a manual admin process, not automatic).
- [x] **Done 25 Sep 2026** — "unverified members cannot browse/view profiles"
      is now backed by real RLS, not just the client-side check in
      `browse.html`/`profile-view.html`. Added `mt_is_verified(uid)` (mirrors
      `mt_is_admin`/`mt_is_complete`: reads `mt_contacts.mobile_verified`),
      and added `and mt_is_verified(auth.uid())` into both `mt_profiles_sel`
      and `mt_photos_sel` via `alter policy ... using (...)` (in place, no
      drop/recreate). Both existing policies already required
      `mt_is_complete(auth.uid())` for the viewer but never checked
      verification at all — meaning before this, anyone bypassing the app's
      UI and calling the database directly (browser dev tools, a script)
      could read any active member's full profile and photos without ever
      being verified. Confirmed applied live by the user.

- [x] **Fixed 26 Sep 2026** — `register.html` and `myprofile.html` were
      completely broken for every member: both re-declared `const
      PROFESSIONS_WITHOUT_INCOME` inline even though `profile-shared.js`
      (loaded on both pages) already declares it at top level. Two top-level
      `const` with the same name in the same scope is a `SyntaxError`, which
      aborts parsing of the *entire* inline `<script>` block before any of it
      runs — not a runtime bug, a parse-time one. Symptom: blank profile
      forms with no prefill and no "Logged in as" line, on every load,
      regardless of cache state — found via a live member (Neha /
      `kaavyaintl@gmail.com`) whose already-saved profile appeared empty.
      Fixed by deleting the duplicate from both files, keeping the shared one.

- [x] **Fixed 26 Sep 2026** — `mt_contacts_upd` RLS policy had no admin
      bypass (`using (user_id = auth.uid())` only), unlike `mt_contacts_del`
      which already had `or mt_is_admin(auth.uid())`. This meant admin.html's
      Verify button silently updated **zero rows** — no error, since RLS just
      filters which rows match rather than throwing — so a verified member
      never actually left the pending list even after repeated
      verify/re-login attempts. Fixed with `alter policy mt_contacts_upd ...
      using ((user_id = auth.uid()) or mt_is_admin(auth.uid())) with check
      (same)`. Worth re-checking other tables for this same
      DELETE-has-admin-bypass-but-UPDATE-doesn't asymmetry.

- [x] **Built 26 Sep 2026** — Full "My Preference" collection + Browse
      matching. The `mt_profiles` schema already had `pref_height_min/max`,
      `pref_weight_min/max`, `pref_education[]`, `pref_profession[]`,
      `pref_diet`, `pref_income`, `pref_city`, `pref_special` columns (added
      early on, see "Columns added after the original schema" above) but no
      UI ever collected them — only `pref_age_min/max` was ever built out.
      Added the rest to both `register.html` (Step 4) and `myprofile.html`
      ("My Preference" section), all optional except age. Education/
      profession preference are genuine multi-select checkbox lists (real
      Postgres arrays, unlike the member's own `education`/`profession`
      columns which stay single/comma-string) — added `getCheckboxListArray`/
      `setCheckboxListArray` to `profile-shared.js` for this.
      Browse (`browse.html`) now has a member-facing **Match mode** toggle:
      "All my preferences" vs "Age, Diet & Profession" (persisted in
      `localStorage` under `mt_browse_match_mode`, default "all"). Design
      rule, to avoid ever double-filtering the same field two different ways:
      any preference field that already has a matching manual filter box
      (age, diet, and profession/education when exactly one value is
      preferred) is auto-filled into that box once at load — same mechanism
      age already used — and from then on the visible box is the only source
      of truth for it, so a member's own manual edit always sticks. Fields
      with no manual filter box at all (height, weight, income) are applied
      as invisible query constraints, gated on `matchMode === "all"` so
      "core" mode stays genuinely lighter. `pref_special` (free-text notes)
      is never used as a matching constraint — there is no equivalent field
      on the other member's profile to compare it against, it is purely
      informational for the member's own reference.
      Also fixed a latent bug this surfaced: `app.js`'s `normaliseCodes()`
      *deleted* an invalid/empty code field instead of nulling it, which is
      harmless for the four required code fields (gender/diet/marital_status/
      managed_by — form validation already blocks them from ever reaching
      here empty) but would have permanently blocked a member from clearing
      `pref_diet` back to "Any" once set (upsert leaves an omitted column
      untouched, not nulled). Added a `nullable: true` flag to
      `CODE_FIELD_RULES` so `pref_diet` nulls correctly; behavior for the
      other four fields is unchanged.

**`sw.js` caching strategy changed to network-first on 25 Sep 2026.** It was
cache-first with a manually-bumped `CACHE_NAME` ("MT_V3"), which meant every
edit to a shell file (`index.html`, `myprofile.html`, `register.html`,
`app.js`, `config.js`, `profile-shared.js`, `styles.css`, ...) silently kept
being served stale until someone remembered to also bump that string in a
completely different file — an entire session of fixes on 25 Sep 2026 looked
"not working" purely because of this. Now every request tries the network
first and only falls back to the cache when offline, so no version bump is
needed for a deploy to show up — just a normal reload. If a new shell file
is added, still add it to `SHELL_FILES` so it has an offline fallback, but
forgetting to bump `CACHE_NAME` can no longer hide a fix.

- [ ] Create the Telegram bot for this app (`JainVivahBot`) via @BotFather
- [ ] Photo watermark — Batch 3
- [ ] Weekly automatic database export to Google Drive (free tier has **no
      backups** — if data is lost it is gone)
- [ ] Rotate the Brevo SMTP key before real launch
- [ ] Storage watch: free tier gives **1 GB shared across all four apps** on
      this project. At ~150 KB per photo and 3 photos each, that is roughly
      1,500 members. Add a usage counter to the admin panel.
- [ ] Optional later: wrap the PWA as an Android app to enable screenshot
      blocking. **Not possible in a browser** — the app must never claim
      screenshots are blocked, only that photos are watermarked and traceable.

---

## 8. Standing preferences

### For the planning conversation (not for Claude Code)

Requirements are discussed and approved in a separate planning conversation
before Claude Code ever sees them. These two describe *that* process:

- Interpret the requirement, narrate the understanding, and wait for an
  explicit 🟢 before writing code
- Prefer complete file replacements over partial edits (this is about how
  code is shown in that planning chat, not about this repo)

**By the time an instruction reaches Claude Code, the green light has
already been given.** Claude Code must not ask for approval again — it
should build what the prompt says. Claude Code has the actual repo, so it
should edit files directly and iterate in place; that is correct and
preferred, not "partial edits" to be avoided.

### For Claude Code (build execution) — these apply directly

- Never create a trigger on `auth.users`
- All SQL is add-only. No `DROP`, no `CASCADE`, no `ALTER` on tables
  belonging to other apps
- Every database object starts with `mt_`
- A 400 from a read probe does not prove a column is missing — row-level
  security can also return 400. Check `information_schema.columns` before
  concluding anything is absent (see §3 for the exact query)
- Never put keys, passwords or SMTP credentials in any file in this repo.
  It is public
- Ask before assuming a column name. Do not guess — confirm it first
- Always fetch the live file before changing it — never edit from memory

### Contacts and branding

- Support email: `info.anyapps@gmail.com`
- Public-facing branding: **AnyApps.in**
