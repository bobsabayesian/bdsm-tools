# BDSM Tools

This is the codebase for the BDSM Tools Application containing various tools for BDSM
practitioners: a React Single Page Application and a Cloudflare Worker API.

## Architecture

Everything runs on Cloudflare as a single Worker:

- **The site** - the React app (built into `dist/`) is served as static assets.
- **The API** - `worker/` handles everything under `/api/` (feature flags, slave training,
  scene negotiation, admin) using [Hono](https://hono.dev).
- **The database** - one Cloudflare D1 (SQLite) database. Collections of documents (tasks,
  feature flags, catalogs, negotiations...) live as JSON in a single `docs` table; see
  `migrations/0001_init.sql`.

The site and API share an origin, so there is no CORS or cookie-domain configuration.

## Local development

```bash
$ npm install --legacy-peer-deps
$ npm run db:migrate:local   # create the local database (once, and after new migrations)
$ npm run dev:api            # the Worker/API on http://localhost:8787
$ npm start                  # the React app on http://localhost:3002, proxying /api to the Worker
```

Put `ADMIN_TOKEN=...` in the top-level `.env` (git-ignored) - `wrangler dev` reads it. The admin
tool is then at <http://localhost:3002/admin>.

## Deploying

One-time setup:

```bash
$ npx wrangler login
$ npx wrangler d1 create bdsm-tools    # paste the database_id into wrangler.jsonc
$ npm run db:migrate
$ npm run deploy                       # first deploy creates the Worker
$ npx wrangler secret put ADMIN_TOKEN
```

Then, each time:

```bash
$ npm run db:migrate   # apply new database migrations
$ npm run deploy       # build the site and deploy the Worker
```

The GitHub workflow `cloudflare-deployment.yml` does both on a release. It needs the repository
secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Migrating data from Mongo / Firestore

A one-off export of the previous data stores (needs the `MONGO_*` values in `.env`, and
`gcloud auth application-default login` for Firestore):

```bash
$ cd scripts/migrate && npm install && npm run export   # writes data.sql (git-ignored)
$ cd ../.. && npx wrangler d1 execute bdsm-tools --local  --file scripts/migrate/data.sql
$ npx wrangler d1 execute bdsm-tools --remote --file scripts/migrate/data.sql
```

Visitor sessions (points and streaks) are not migrated; browser cookies don't carry over to a
new address.

## Admin tool

Admins manage task types, genders, kinks, body parts, equipment and slave training tasks at
`/admin` (not linked from the navigation). The API requires the `ADMIN_TOKEN` secret, entered in
the UI and kept in session storage.

Catalogs are defined in `worker/catalogs.js` - adding an entry there adds it to the API and UI.

## Accounts and dynamics

People sign up with a username and password (no email). The recovery code shown once at sign-up
is the only way to reset a forgotten password. A person can be in any number of **dynamics**
(a pair, or just themselves) and nobody is told about the others: partners see only the alias
chosen for that dynamic, never a username or user id. People join by invitation code rather than
by searching for each other.

Either person can pause or end a dynamic at any time, with nobody's approval. They are invited to
say why but never required to. While a dynamic runs each person sees the other's last-active time;
when it ends that time is frozen.

Account and dynamic routes live in `worker/routes/account.js` and `worker/routes/dynamics.js`; the
screens are in `src/account/`. To check the whole flow against a running Worker (on a fresh local
database, as sign-ups are rate limited per IP):

```bash
$ BASE=http://localhost:8787 node scripts/smoke-accounts.mjs
```

### The path through the app

**My profile** and **My dynamics** in the header both open the account page (`/account`), which has your
profile first - a summary of each part with an **Edit** button, and **Edit my profile** - and your dynamics
below it. Each dynamic's page has a very large **Pause** button at the top. Pressing it says "This is not a
substitute for a discussion." and asks Yes or Cancel (a reason and note are invited, never required); the
person who paused gets a large **Resume** in its place, and the other person is told. Ending a dynamic is
smaller, below it.

### About me

A person's profile lives at **About me** (`/account/about`, linked as "My profile" in the header), with
one tab each: **Me**, **My Body**, **What's in bounds?** and **My Kinks**. New people are walked through
My Body, What's in bounds? and kinks once after signing up (`/account/setup`, every step skippable); after
that About me is where everything is edited. Each tab saves on its own and shows a dot when it has
unsaved changes. The people in a person's dynamics see exactly the same tabs, read-only, on the
dynamic's page (`PartnerProfile`).

- **Me** is optional and nothing depends on it: gender (from the admin "Genders" list, if any), pronouns
  (free text) and "things my partner should know".
- **My Body** is about what someone wants _included_ in tasks, not their anatomy or identity - nobody
  is asked about sex or gender, the quick-start presets only ever add to what is ticked, and skipping
  is fine. Body parts, groups and presets are editable in the admin tool (`worker/catalogs.js`). When
  writing task text, please use neutral wording ("your", "they") rather than gendered pronouns.
- **My Body and What's in bounds? overlap on purpose** - it's better to over-specify than to leave something
  unsaid - and both pages say so. Tasks check each list on its own; a choice in one doesn't count for the other.
- **What's in bounds?** is its own tab, separate from My Body, and replaces the old My Equipment. One
  screen holds four lists a person can put in bounds for tasks: **Body & Anatomy** (a finer list than My
  Body), **Clothing, Underwear & Presentation**, **Items** (the equipment list) and **Spaces** (none yet, so
  that section stays hidden until some are added). Quick starts (Everything except genitals, External only,
  Penis and balls, Pussy, Everyday clothing & underwear, Common household items, Private indoor spaces) only
  ever add, and one can reach into several lists; a quick start that would add nothing is not shown. The lists,
  groups and quick starts are all editable in admin (`In bounds: ...`). Tasks can require things from any of
  them, and are only offered when everything required is in bounds for the person who would do them.
- **My Kinks** appears once at least one kink is active in admin (below).

### Kinks and limits

Once at least one kink is active in the admin tool, the **My Kinks** tab (and a setup step) lets people rate
each kink, separately for **giving** and **receiving**, on a five-point scale: hard limit, soft
limit, indifferent, like, love (blank means "not decided"). A kink can be limited to one side with
its "Ask about" setting.

- **Hard limits** are enforced by the app: a task is never offered to someone with a hard limit on
  a kink it involves. Tasks list their kinks from the doer's point of view (`kinksReceiving` /
  `kinksGiving`) and `hardLimitConflicts` in `worker/limits.js` does the check.
- **Soft limits** are a conversation, and the person _assigning_ attests to it. When a task touches
  one, they are shown a flag naming that kink - _"Assignments should never be a surprise to your
  partner."_ - and must attest _"I attest that we've talked about this soft limit."_ (Yes), or Cancel,
  in which case nothing is assigned. It is enforced on the server (`assessAssignment` in
  `worker/limits.js`, which also refuses hard limits whatever is attested), not just by the button;
  each soft limit needs its own attestation; and the attestation is recorded on the assignment where
  both people can see it. `LimitsNotice` (`src/account/limits.jsx`) explains all this to both people:
  on the setup screen now, and with the `task` variant wherever a task is assigned or received.

### Openness within a dynamic

Inside a dynamic **nothing is hidden**: each person sees the other's full profile - body parts and
kinks, hard and soft limits included (`GET /api/dynamics/:id/profile`, shown on the dynamic's page by
`PartnerProfile`) - and the setup screens and invitations say so. Three rules go with it:

- It is the person's own profile, identical in every dynamic; it reveals nothing about their other
  dynamics, and partners still never see a username.
- It stops when a dynamic ends (like "last active"), and ending or deleting an account removes it.
- Answers given before this was explained (`users.profile_shared_at` is empty) stay hidden until the
  person confirms or saves again, so nothing is exposed retroactively.

### Tasks

The **Tasks** page (left menu, `/tasks`) has a selector at the top right for which dynamic you are looking
at. What you can do depends on who has control in that dynamic: the dominant in a pair, or you in solo mode.

- **Assigning** (control only): pick from the task library - each task shows whether it is possible for
  this person and why not (a body part or equipment they haven't included, a hard limit, a proof type
  not yet supported) - or write your own with the same fields and checks. Optional due date or time, and
  the dom can choose to review it. A task that touches a **soft limit** asks the assigner to attest
  (Yes/Cancel) first; **hard limits** are refused. Everything is checked on the server
  (`worker/routes/work.js`, `worker/tasks.js`, `worker/limits.js`). A pair's assignee must have been
  through profile setup (skipping counts) so they have seen that their partner sees everything.
- **Doing** a task depends on how it is proven: just doing it, a number, writing, lines, a timer (checked
  against when the server saw it start), a choice, or a quiz (answers are never sent to the person doing
  it). Photo/video/audio and location proofs need file storage and location consent and are not
  available yet. If the dom asked to review, the task waits for approval or is sent back with a note.
  Not completing a task is just a record ("not done") - nothing is penalised automatically.
- Either person can comment on a task. Tasks are visible only to the two people, and disappear from view
  once a dynamic ends; while paused they can be read but not changed.

### Rules

**Rules** (`/rules`, its own page with the same dynamic selector) belong to the dynamic as a whole and have
nothing to do with any particular task. Whoever has control sets them; the other person can **comment** but
there is nothing to approve. In a pair, making, changing or bringing back a rule asks "Have you discussed
this with your partner?" (Yes/Cancel) and records the answer where both can see it.

- **A rule stands for a while.** When setting a rule the dom says how many days until it can be changed. The
  person living under the rules has a **rule change minimum** in their profile (About me > Me; default 7
  days, 0-365), and the **longer of the two applies** - asking for 4 days against a minimum of 7 gives 7.
  Until the time is up the rule cannot be changed **or retired**; a change starts a fresh lock. The lock is
  worked out when the rule is set and keeps that value even if the minimum changes later (`worker/rules.js`).
  Solo mode has no minimum; you choose your own lock.
- Retiring a rule needs no question; bringing one back asks again and starts a new lock.

Checks: `ADMIN_TOKEN=... BASE=http://localhost:8787 node scripts/smoke-tasks.mjs` against a fresh local
database (as for `scripts/smoke-accounts.mjs`).

### A local playground

With `npm run dev:api` running, `npm run seed:users` creates `dom-test`, `sub-test` and `switch-test`
(password `test-password-123`) with profiles filled in, puts the first two in a dynamic together
("Sir" and "kitten"), and - using the `ADMIN_TOKEN` in `.env` - adds a few kinks and ten demo tasks
(including a hard limit and a soft limit for `sub-test`, so both can be seen). Safe to repeat; it refuses to
run against anything but localhost. Use separate private windows to be two people at once.
