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
- No matching/eligibility filter — plain browse with filters
- Age enforced: female 18+, male 21+ (Indian legal marriage age)
- Profile managed by Self / Father / Mother / Brother / Sister / Relative

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

---

## 3. Supabase

**Project: `Rotary_Events`** — shared with SportBook, DealLagi, Trust Analysis.

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

- Signed up with `vkvcoder.support@gmail.com`
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
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:vkvcoder.support@gmail.com,mailto:rua@dmarc.brevo.com` | — |
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
- **Batch 2 — Profile:** `register.html` (6-step wizard), `myprofile.html`,
  photo upload with browser-side compression to ~150 KB, bio-data attachment,
  draft save and resume, review screen, logout
- Icons: interlocking rings in cream and gold on maroon
- Invocation strip `🙏 || Jai Jinendra || 🙏` on every page — chosen over a
  Shwetambar Murtipujak invocation because the app serves all four sects

### Not built yet

- **Batch 3 — Browse:** search, filters, profile view, **per-viewer photo
  watermark** (belongs here, not in the upload page), view logging
- **Batch 4 — Interests + Admin:** send / accept / decline, contact reveal,
  bio-data release on acceptance, block, report, admin panel, Telegram alerts

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

- [ ] Full end-to-end test of the 6-step form, draft resume and submit
- [ ] Set the real `WHATSAPP_VERIFY_NUMBER` in `config.js`
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

- Support email: `vkvcoder.support@gmail.com`
- Public-facing branding: **AnyApps.in**
