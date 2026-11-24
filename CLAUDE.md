For data fetching, only use react server components, fetching in parent server components and passing data in to client components.

After a large suite of changes, run pnpm tsc to verify

To check UI changes, use the preview browser (the T3 Code preview tools) against the running dev server (`.claude/launch.json` has a `web` config). Don't use Playwright or other headless browsers; if the preview browser is unavailable, say so instead of falling back.

Use shadcn/ui and Tailwind for all UI, including shadcn Charts for charts. Don't add other component libraries or CSS approaches.

## Specs

`docs/SPEC.md` describes what users should be able to find out from the app. It is the source of truth for the rewrite. Keep it free of implementation details.

How `apps/web` implements the spec:
- Pages: `/` This year (P1, `?year=` for a past year), `/search` place search (P2), `/place/<id>` and `/near/<address>?lat&lng&r` place reports (P3), `/project/<permit>` (P4), `/about` (P5), `/projects?…` the project list behind any number (T1, with `/projects/csv`), `/movement` all citywide movement. `/methodology` serves the About page (Railway's healthcheck); `/permits` redirects home.
- `lib/server/scope.ts` is the single translation from filters to SQL: `source()` yields the permits behind any number (completions, issued, applied, pipeline, proposals, a past year's outcomes) and `stageSql()` decides stages, including "permit expired". Totals (`metrics.ts`), project lists (`projects.ts`) and reports (`report.ts`) all sum over it, so lists add up to the numbers (`test/drilldown.test.ts`).
- `lib/server/movement.ts` builds movement from milestone dates, current expiration dates and `permit_events` (recorded since October 2026). It never reads recorded changes to expiration dates, which the portal has flapped.
- `lib/rules.ts` holds the fixed rules and defaults (stalled, expiring soon, open questions 2–6); `lib/reliability.ts` the reliability rule (T2).
- Places: `packages/data/data/neighborhoods.geojson` (City Clerk's Neighborhood Map Atlas), `centers.geojson` (Comprehensive Plan centers) and `place-aliases.json` (informal names). `packages/data/src/reference/load.ts` loads them into `places` and assigns `permits.neighborhood_id`/`center_id` from `db:migrate` whenever the files change, so a deploy applies them; the sync assigns new and changed permits. Bump `DERIVE_VERSION` in `sync/merge.ts` when the derivation changes.
- Search: place names match client-side (`lib/search.ts`); addresses go through the City's geocoder on `/search` (`lib/server/geocode.ts`, no key).
- Email updates (P6): `lib/server/notifications.ts` (Resend over HTTP, ported from the roosevelt-permits repo). Signup form on place reports' Movement section → `/api/subscribe` → emailed link to `/subscribe/confirm` → `/api/subscribe/confirm`; signed links to `/unsubscribe`. Digests are the place's `getMovement()` minus what's in `subscription_seen`; the sync calls `POST /api/digests` (`WEB_DIGEST_URL`, `Bearer DIGEST_SECRET`) after a successful merge. The web service needs `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (on the verified `lidnd.com` domain) and `SUBSCRIPTION_SECRET`; without them the form is hidden. Locally, send test mail to `delivered@resend.dev`.
- In development, `?asof=YYYY-MM-DD` on report pages pretends today is another day (e.g. to check January's year in review).

## Layout

- `packages/data`: shared Drizzle schema, domain rules (status, housing type, normalization), and the nightly sync. Run `pnpm --filter @sbt/data <sync|verify:portal|report:housing-type|test|db:migrate|seed>`.
- `apps/web`: the Next.js app. Run `pnpm --filter @sbt/web dev`; tests (against the local DB) with `pnpm --filter @sbt/web test`.
- Local dev DB: PostGIS in Docker (`docker run -d --name sbt-postgis -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sbt -p 5433:5432 postgis/postgis:17-3.5`), with `DATABASE_URL=postgres://postgres:postgres@localhost:5433/sbt` in `packages/data/.env` and `apps/web/.env.local`.
- The pre-rewrite app (root `app/`, `server/`, etc.) is no longer deployed and can be removed.

## Hosting & data access

The app is hosted on Railway (project `unique-purpose`, environment `production`), deployed from `main`. The Railway CLI is installed and logged in.

- `seattle-building-permits`: the web app (`apps/web`). Runs migrations (which also load reference data), then starts; healthcheck `/methodology` (which serves the About page; `/about` would do too).
- `import-v2`: the nightly sync (`0 3 * * *` UTC), on `main`.
- `PostGIS`: the database both use.
- `web-v2`: a staging copy of the web app on the `rewrite` branch.
- Retired, kept for rollback for now: `Postgres` (old database) and `import job` (old importer; no schedule, no repo connected).

- Link this directory: `railway link -p unique-purpose -e production -s seattle-building-permits`
- Query the database: build the URL from `railway variables -s PostGIS --json` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `RAILWAY_TCP_PROXY_DOMAIN`, `RAILWAY_TCP_PROXY_PORT`, `POSTGRES_DB`).
- This is the **production** database. Run read-only queries only, unless the user explicitly asks for a write.

## Source of truth

All data comes from the Seattle Open Data Portal's Building Permits dataset (`76t5-zqzr`). The database is a synced copy, and the portal wins if they disagree.

- Dataset page: https://data.seattle.gov/Permitting/Building-Permits/76t5-zqzr
- API (SoQL, no auth needed for light use): `curl "https://data.seattle.gov/resource/76t5-zqzr.json?\$select=count(*)"`
- Use it to verify column meanings, check sync completeness, or explore fields the database doesn't store.
