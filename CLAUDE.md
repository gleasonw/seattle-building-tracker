For data fetching, only use react server components, fetching in parent server components and passing data in to client components.

After a large suite of changes, run pnpm tsc to verify

To check UI changes, use the preview browser (the T3 Code preview tools) against the running dev server. Don't use Playwright or other headless browsers; if the preview browser is unavailable, say so instead of falling back.

Use shadcn/ui and Tailwind for all UI, including shadcn Charts for charts. Don't add other component libraries or CSS approaches.

## Specs

- `docs/SPEC.md` describes what users should be able to find out from the app. It is the source of truth for the rewrite. Keep it free of implementation details.
- `docs/DEV_REWRITE_SPEC.md` covers how the rewrite is built: data pipeline, architecture, forecast and phased plan. It's a working plan: change it freely when a better approach turns up, as long as the result still satisfies `SPEC.md`, and update it in the same PR.

## Rewrite layout (branch `rewrite`)

- `packages/data`: shared Drizzle schema, domain rules (status, housing type, normalization), and the nightly sync. Run `pnpm --filter @sbt/data <sync|verify:portal|report:housing-type|test|db:migrate|seed>`.
- `apps/web`: the new Next.js app. Run `pnpm --filter @sbt/web dev`.
- Local dev DB: PostGIS in Docker (`docker run -d --name sbt-postgis -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sbt -p 5433:5432 postgis/postgis:17-3.5`), with `DATABASE_URL=postgres://postgres:postgres@localhost:5433/sbt` in `packages/data/.env` and `apps/web/.env.local`.
- The old app at the repo root keeps running in production until cutover.

## Hosting & data access

The app is hosted on Railway (project `unique-purpose`, environment `production`). Its services are `seattle-building-permits` (web), `import job` (sync) and `Postgres`. The Railway CLI is installed and logged in.

- Link this directory: `railway link -p unique-purpose -e production -s seattle-building-permits`
- Query Postgres: `psql "$(railway variables -s Postgres --json | jq -r .DATABASE_PUBLIC_URL)"`
- This is the **production** database. Run read-only queries only, unless the user explicitly asks for a write.

## Source of truth

All data comes from the Seattle Open Data Portal's Building Permits dataset (`76t5-zqzr`). The database is a synced copy, and the portal wins if they disagree.

- Dataset page: https://data.seattle.gov/Permitting/Building-Permits/76t5-zqzr
- API (SoQL, no auth needed for light use): `curl "https://data.seattle.gov/resource/76t5-zqzr.json?\$select=count(*)"`
- Use it to verify column meanings, check sync completeness, or explore fields the database doesn't store.
