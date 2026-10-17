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
