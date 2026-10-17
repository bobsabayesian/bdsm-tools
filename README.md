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

For local testing, `npm run seed:users` (with `npm run dev:api` running) creates the accounts
`dom-test`, `sub-test` and `switch-test` (password `test-password-123`), with the first two
already in a dynamic together. It refuses to run against anything but localhost. Use separate
private/incognito windows to be logged in as two people at once.

### Setup choices

After signing up, people are asked which body parts they would like **included** in tasks. It is
deliberately about what someone wants in play, not their anatomy or identity - nobody is asked
about sex or gender, the quick-start presets only ever add to what is ticked, and skipping is fine.
Choices are private to the person (`user_selections`) and are not shown to anyone in their dynamics.
Body parts, their groups and the presets are all editable in the admin tool (`worker/catalogs.js`).
When writing task text, please use neutral wording ("your", "they") rather than gendered pronouns.

### Kinks and limits

Once at least one kink is active in the admin tool, setup gains a second step where people rate
each kink, separately for **giving** and **receiving**, on a five-point scale: hard limit, soft
limit, indifferent, like, love (blank means "not decided"). A kink can be limited to one side with
its "Ask about" setting. Choices are private, like body parts.

- **Hard limits** are enforced by the app: a task is never offered to someone with a hard limit on
  a kink it involves. Tasks list their kinks from the doer's point of view (`kinksReceiving` /
  `kinksGiving`) and `hardLimitConflicts` in `worker/limits.js` does the check. It is ready for the
  assignment screens and must never tell an assigner _which_ limit was hit.
- **Soft limits** are deliberately _not_ a UI choice: the app never blocks on one, flags it as an
  override, or offers "assign anyway". It is a conversation between the two people. `LimitsNotice`
  (`src/account/limits.jsx`) says so to both people - on the setup screen now, and with the
  `task` variant wherever a task is assigned or received.
