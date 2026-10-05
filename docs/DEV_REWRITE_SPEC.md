# Seattle Building Tracker — Rewrite Implementation Spec

> Companion to [`SPEC.md`](./SPEC.md), which says **what** users can find out. This
> document says **how** it gets built. If they conflict, `SPEC.md` wins on user-facing
> behavior and this document wins on technical decisions.
>
> IDs like M4, V3 and T2 refer to items in `SPEC.md`.
>
> **This document is a working plan, not a contract.** It records the best current thinking,
> and much of it was written before any code existed. If an approach here turns out to be wrong,
> awkward or more complex than it needs to be, change it. That applies to the stack, schema,
> pipeline steps, forecast method, phases and anything else. **The only hard constraint is that
> the result still satisfies `SPEC.md`.** When you change it, update this document in the same PR,
> with a sentence on why, so it stays an accurate picture of the system. Changes that would
> alter what users can find out belong in `SPEC.md` and need the product owner's agreement.
> The ground rules in §1 (shadcn/Tailwind, RSC data fetching) come from `CLAUDE.md` and also
> stay fixed.

---

## 1. Ground rules

- **UI: shadcn/ui + Tailwind CSS v4, everywhere.**
  - Every interactive element and layout primitive comes from shadcn/ui (`components/ui`,
    the current default preset `radix-nova`, base color `neutral`, CSS variables), or is composed from shadcn parts.
  - Styling is Tailwind utility classes and the shadcn theme tokens in `app/globals.css`.
  - No other component libraries, no CSS modules, no inline style objects. The one exception
    is the map library's own required CSS.
  - Charts use **shadcn Charts** (Recharts underneath), which replaces Highcharts.
- **Data fetching: React Server Components only.** Parent server components fetch the data
  and pass it as props to client components. Client components never fetch app data. This
  replaces the current TanStack Query usage. Narrow exceptions (e.g. address autocomplete)
  use **server actions**, not client-side fetch to our own API.
- **URL is the state.** Every filter and view setup lives in search params, so every view can be
  shared (T7). The same typed parsers are used on the server and the client.
- **Production data is read-only from dev machines** unless explicitly intended (see `CLAUDE.md`).
- After a large set of changes, run `pnpm tsc`.

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript strict | Keep the React Compiler |
| UI | shadcn/ui + Tailwind v4 | `components.json` already exists. Consolidate `app/components/ui` into `components/ui` |
| Charts | shadcn Chart (Recharts) | Stacked bars, lines, area bands for forecast ranges, reference lines for policy annotations |
| Map | react-leaflet, wrapped in shadcn `Card`, controls built from shadcn parts | shadcn has no map component. Maps are client-only and get their data from a server parent |
| URL state | `nuqs` | One parser definition shared by server (`createSearchParamsCache`) and client (`useQueryStates`) |
| DB | Postgres 17 + **PostGIS** on Railway + Drizzle ORM + postgres-js | A new PostGIS-enabled service (§8). The current `postgres-ssl` image doesn't ship PostGIS |
| Jobs | TypeScript scripts run by a Railway cron service | Same repo, same Drizzle schema |
| Tests | Vitest | Pure logic (classifier, status mapping, CRA assignment, forecast) plus a portal reconciliation script |

**Removed:** Highcharts, `@tanstack/react-query`, `QueryProvider`, the incremental
`periodicSync`, and the empty `neighborhoods` table.

## 3. Review of the current sync

The current Postgres instance and the "nightly full re-pull" approach can be reused. The
importer code cannot. Findings from comparing against the Seattle Open Data portal on 2026-10-04:

**What works**
- The Railway `import job` cron (`0 0 * * *`, UTC) runs `pnpm import:bulk`, a full re-fetch
  and upsert every night. Status changes are picked up.
- Every portal permit matching the importer's filter (115,745) was present in the database.
  The last run succeeded.

**Problems, in order of severity**

1. **The `applieddate >= 2010` filter badly undercounts completions.** Permits applied for
   before 2010 but completed afterwards are never imported. Units completed, portal vs. database:

   | Year | Portal | DB | Missing |
   |---|---|---|---|
   | 2010 | 3,981 | 67 | 98% |
   | 2011 | 2,210 | 326 | 85% |
   | 2012 | 3,214 | 1,795 | 44% |
   | 2013 | 6,133 | 4,786 | 22% |
   | 2017 | 12,112 | 9,876 | 18% |

   Every year from 2018 on is under 1% off. The 2017 gap is real towers, e.g. 588 Bell St
   (350 units, applied 2007, completed 2017).
2. **No deletions.** Permits that leave the source, or leave the filter, stay in the database
   forever. There are currently 21 stale demolition permits whose applied date the City reset to
   `1900-01-01`.
3. **No history.** The nightly upsert overwrites status, and canceled or withdrawn permits have
   no date for when they died. Without a log of status changes, the forecast backtest (§6) can't
   know which permits were still alive at a past date. That history can't be recovered later,
   so **logging needs to start as soon as possible.**
4. **Unstable pagination.** Offset paging is ordered by `applieddate`, which isn't unique, so rows
   can be skipped or duplicated between pages. It isn't happening today, but nothing prevents it.
5. **Partial failures recorded as success.** A failed chunk or batch increments a counter, but
   the run still records `lastSyncStatus = "success"`.
6. **Dead code and dead filters.**
   - `periodicSync` isn't scheduled, and its logic misses new applications and status changes.
   - `'Land Use'` isn't a value of `permittypemapped` in this dataset.
   - The `neighborhoods` table is empty.
7. **Missing column.** `development_site` isn't stored. It's filled in for 71% of building permits
   that add units, and it groups permits belonging to the same development (§4.5).
8. **Placeholder dates.** `1900-01-01` appears as a stand-in for "unknown" (e.g. applied date) and
   must be read as null.
   - The portal's `:created_at` / `:updated_at` are the same on every row, because the City
     reloads the whole dataset. They carry no information. `remote_created_at` and
     `remote_updated_at` are dropped.
9. **Slow writes.** Upserts go one row at a time inside 100-row transactions. That's about 7 minutes
   for 116k rows today, and longer once the full dataset is imported.

## 4. Data pipeline

### 4.1 Source

- **Seattle Open Data, Building Permits `76t5-zqzr`**, via the SODA API with the
  `SEATTLE_PERMITS_APP_TOKEN` app token.
- **Scope:** all rows where `permittypemapped IN ('Building', 'Demolition')`, with **no date
  filter**. That's about 172k rows.
- **Excluded:** Roof, Grading, and ECA/Shoreline exemption permits.
- **Paging:** keyset paging on the portal's row ID: `$order=:id`, `$where=:id > '<last>'`,
  `$limit=10000`. Requests run one after another, which is fast enough and fully deterministic.

### 4.2 Nightly job

Each run goes through these steps:

1. **Start a run.** Insert a `sync_runs` row with `status='running'`.
2. **Fetch** every page into a fresh **staging table** (`permits_staging`, unlogged), using
   batched multi-row `INSERT`s.
3. **Reconcile.** Compare the staged row count with the portal's `count(*)` for the same
   filter. On a mismatch, mark the run `failed` and stop. Production tables are not touched.
4. **Normalize and derive.** Treat placeholder dates as null, parse numbers, then compute
   status category, housing type and CRA (§4.4–4.6).
5. **Merge in one transaction:**
   - Upsert into `permits`. Rows that changed get `updated_at = now()`.
   - Append a `permit_events` row for every permit whose status or milestone dates changed.
     First-seen permits get an `observed` event.
   - Permits in `permits` but not in staging get `removed_at = now()`. They are soft-deleted
     and excluded from every query.
6. **Refresh** derived tables and cached results (§5.4, §6.3).
7. **Finish the run** with `status='success'` and counts, or `status='failed'` and the error.
   Any failure at any step makes the whole run fail. There is no partial success.

Freshness (T5) reads the most recent `success` run. A warning appears if that run is more
than 48h old, or if the latest run failed.

### 4.3 Schema (sketch)

```
permits
  permit_num PK
  -- all source columns as today, plus:
  development_site
  -- derived:
  status_category  enum(pipeline, done, lapsed, dead)
  stage            enum(pre_intake, applied, issued, done, lapsed, dead)
  housing_type     enum(detached, adu, townhouse, mf_small, mf_mid, mf_large, other)
  housing_type_source enum(city, inferred)
  cra_id           FK areas
  project_key      -- development_site ?? permit_num
  geom             geometry(Point, 4326)   -- GiST index
  removed_at, updated_at, first_seen_at

projects           -- rebuilt each sync from permits grouped by project_key
  project_key PK, development_site, permit_count, cra_id, housing_type (of main permit),
  units_added, units_removed, net_units, applied_date (earliest), issued_date, completed_date,
  stage, status_category, main_permit_num

permit_events      -- append-only
  id, permit_num, observed_at, kind(observed|status|milestone),
  status_from, status_to, field, value_from, value_to

sync_runs
  id, started_at, finished_at, status, source_count, staged_count,
  inserted, updated, removed, events_written, error

areas              -- CRAs
  id (CRA_NO), name (GEN_ALIAS), detail_names, group_id (CRA_GRP),
  neighborhood_district, acres, geom geometry(MultiPolygon, 4326)   -- land polygons only, GiST index

policy_events      -- annotations for V1, seeded from data/policy-events.json
  date, label, url, verified_on   -- rows without verified_on are never shown (SPEC V1)

forecast_runs / forecast_quarters / backtest_results   -- §6
```

Indexes cover `(stage)`, `(housing_type)`, `(cra_id)`, each milestone date, `project_key`,
and partial indexes `WHERE removed_at IS NULL`.

### 4.4 Status mapping

There's one mapping from `statuscurrent` to `status_category` and `stage`, defined in code with
tests. Values seen today:

- **done:** Completed, Closed, Approved to Occupy, Inspections Completed
- **lapsed:** Expired *with* an issued date. Today that's all 1,836 expired building permits
  with units, 10,428 units in total. Only about 6% of those units have a later permit at the same address.
- **dead:** Canceled, Withdrawn, Denied, and Expired *without* an issued date
- **pipeline** is everything else, split by stage:
  - `pre_intake`: no applied date
  - `applied`: applied, not yet issued
  - `issued`: issued (including Phase Issued), not completed

An **unknown status value fails the run's validation step loudly** and is never silently
treated as pipeline. That way the City adding a status can't skew the numbers.

**Pre-intake records:** 1,517 building permits with units have no applied date. They're mostly
"Additional Info Requested", "Scheduled" and "Ready for Intake", and total about 26.9k proposed units.

- **They carry no dates in the source at all.** No applied date; issued and expires dates on
  fewer than 2%; a meaningless `:created_at`. Only 25 have a `development_site`.
- So their age can only come from:
  1. `first_seen_at` / `permit_events`, which is exact but only from when we start logging.
  2. An estimate from the permit number. Permit numbers are issued roughly in sequence, so a
     fit of permit number against applied date for normal permits gives an approximate creation
     date. This must be labeled as an estimate.
- They are stored with `stage = pre_intake` and **excluded from every measure in v1**. The
  methodology page says so. How to show them is an open product question (§10).

### 4.5 Projects

Project grouping is in scope for v1.

- **`project_key = development_site ?? permit_num`.**
  - 71% of building permits that add units have a `development_site`.
  - 78% of demolition permits that remove units have one, which links demolitions to their
    replacement buildings.
  - Permits without a site become their own one-permit project.
- **The `projects` table** is rebuilt from `permits` on every sync (§4.3):
  - Project units are the sum over the project's building permits. Removed units also include
    the project's demolition permits.
  - The project's milestones are its earliest applied date, the date its last building permit
    was issued, and the date its last building permit was completed. A project counts as complete
    only when all its building permits are.
  - Its housing type is the type of its main permit (the one with the most units). Its CRA comes
    from the main permit's location.
- **Which measures count what:**
  - Unit measures (M1–M3) still sum per **permit** by milestone date. A townhouse site completing
    over 18 months credits units when each building finishes, which is the truth.
  - Counts, reliability ("based on k projects"), stalled lists, duration measures (M5), cohort
    measures (M4) and the forecast use **projects**. That avoids 45 townhouse permits on one site
    being treated as 45 independent outcomes.
  - Phase 1 confirms which project-level durations are meaningful, e.g. first applied to last
    completed.
- **Replacement ratio** (units added per unit demolished on the same project) is now cheap and is
  available at project level and as an aggregate.
- **Double-counting audit (phase 1):** within each `development_site`, look for the same units
  appearing on more than one building permit (e.g. a master permit plus dependent permits that
  restate its units). Use `dependent_building` and `parent_permit_num` as signals. If the effect
  is material, add a dedup rule to the project unit totals.
  *Found (2026-10-05):* besides shoring permits (`site_prep_only`), one withdrawn development
  without a development site (Stone Ave N, 2022) listed its full 238 units on each of 24
  building permits, inflating 2022 dead units about tenfold. The merge step now flags
  `restated_units` where 3+ unlinked permits on the same street, applied for in the same year,
  each list the same 50+ units, and keeps the units on one of them. Smaller repeats, such as a
  row of 20-unit buildings, are plausibly real and left alone.

### 4.6 CRA assignment

- **Source:** the City's ArcGIS service `CITYPLAN_CRA/FeatureServer/43`. It has 85 polygons,
  53 of them land. Keep the land polygons (`WATER = 0`).
- **Snapshot:** saved to `data/cra.geojson`, committed to the repo, and loaded into `areas.geom` by a
  seed script. This keeps runs reproducible and avoids a runtime dependency on ArcGIS.
- **Assignment:** one SQL statement in the derive step, using
  `ST_Contains(areas.geom, permits.geom)`.
  - Only 48 of 22,554 building permits with units lack coordinates. They get `cra_id = null` and are
    counted under "unlocated".
  - Points outside every polygon (e.g. on a water line) snap to the nearest CRA within 50 m
    (`ST_DWithin` on `geography`, ordered by distance), and are otherwise unlocated.
- **Radius filter (L1):** `ST_DWithin(permits.geom::geography, point, meters)`, backed by the GiST index.
  It replaces the current hand-written haversine, which scans every row.
- **Choropleth:** served as `ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, …))`, cached.
- **Rollup:** `group_id` (13 CRA groups) is stored as a coarser rollup of the *same* boundaries.
  It's useful as a fallback when a single CRA fails the reliability rule. Whether to expose it is a
  product call (§10).

### 4.7 Housing type classifier

**Field quality (2026-10 profile):**
- `dwellingunittype` is filled in for about 85–95% of older permits but collapses for recent
  ones: 72% of 2024 applications, 9% of 2025, 0% of 2026.
- `housingcategory` is 100% filled in but coarse: Large Multifamily, Middle Housing, N/A, and so on.
- `permitclass` puts about 48k units under "Commercial", which is mostly mixed-use buildings.

So the classifier is an ordered list of rules: a pure function with unit tests and a
versioned rule set.

1. Use `dwellingunittype` when it's present. It maps to Detached / ADU / Townhouse (including Rowhouse)
   / Apartment-like. Source = `city`.
2. Otherwise infer from `housingcategory` + `permitclass` + `housingunitsadded` + keywords in the
   description (ADU, DADU, townhouse, rowhouse, apartment, SEDU…). Source = `inferred`.
3. Apartment-like permits are split by `housingunitsadded` into mf_small / mf_mid / mf_large. The
   cutoffs are chosen in phase 1 from the distribution, aiming for low-, mid- and high-rise breaks.
4. Everything else becomes `other`.

**Validation:** train and check the rules on 2018–2023, where `dwellingunittype` is present. Hide that
field, run the inference, and report accuracy for each type. The report lives in the methodology
page (T4, T6). If inference accuracy for some type is poor, that type merges into a broader one
rather than shipping inaccurate numbers.

### 4.8 Net units

Removed units are recorded mostly on **demolition** permits (8,823 units) rather than building
permits (2,010). Definition:

- **Units added:** building permits only. Demolition permits sometimes report "units added"
  incorrectly, so theirs are ignored.
- **Units removed:**
  - building permits that remove units (e.g. combining apartments), dated by their own milestone;
  - demolition permits that were issued and are done or still in the pipeline, dated by their
    **issued** date. Cancelled demolitions, and demolitions that were issued and then expired,
    aren't counted.
- **Net = added − removed.** This is the headline for completions. Applied and issued counts
  stay gross (units added), since removals don't have a meaningful "applied" date.

*Changed (phase 1 check, 2026-10-05):* dating demolitions by completion was planned, but their
completed dates are unreliable. The median issue→completion gap is 290 days, 41% exceed a year,
and in Feb–Mar 2017 the City bulk-closed hundreds of demolitions issued in 2007–2011, which put
1,600 removals into 2017. Dating by issue gives a smooth 300–800 removals a year. With that rule,
removals are 4–13% of additions every year from 2010 on, so net passes the sanity check.
Building and demolition permits restating the same removal on one project is negligible
(15 projects, under 10 units).

**Filters on removals.** Type, size and sub-type describe new housing, so a removal-only row
(demolition or conversion) matches them when a housing permit on the same project does. Area,
radius and status apply to the row itself. All of this lives in `scope()` (§5.2), so drill-downs
still add up.

## 5. Application architecture

### 5.1 Routes

| Route | Content |
|---|---|
| `/` | V1 Output |
| `/where` | V2 Where (CRA map + ranked table) |
| `/bottlenecks` | V3 Bottlenecks |
| `/pipeline` | V4 Pipeline & forecast |
| `/stalled` | V5 Stalled |
| `/explore` | X1/X2 explorer |
| `/permits` | X3 drill-down list + L2 address lookup (same page, different params) |
| `/methodology` | T6 (MDX, plus live numbers from the classifier report and backtest) |

The pages share one layout: a header with view navigation (shadcn `NavigationMenu`, or `Tabs` on
mobile), a filter bar, and a freshness footer.

### 5.2 Filters

- **One `filters` definition** (nuqs parsers) covers date range, date milestone, status category,
  housing type, CRA, radius (lat/lng/miles), minimum units, and permit sub-type.
- **One function, `scope(filters)`, builds the SQL `WHERE`** together with the date each row is
  credited at and the signed units it contributes (net, added or removed, §4.8). Every aggregate,
  map and drill-down list uses it. That's what guarantees the drill-down list adds up exactly to
  the number that was clicked (X3).
- **Grain.** `by=project` makes dates and status refer to each permit's project (its earliest
  application, last issue, last completion). Project-level measures (durations, review breakdown)
  drill down this way, so the list holds every permit of the projects behind the number. `stage`
  and `project` filters exist for the funnel and stalled-project drill-downs.
- **Filter UI:** shadcn `Popover` + `Command` for multi-selects, `Calendar` for date ranges,
  `ToggleGroup` for the milestone, and `Badge` chips with remove buttons for active filters. On
  mobile, `Sheet` holds the filter set.
- **"Where" picker:** one popover covers both area (D3) and radius (L1), with tabs. *Areas* shows
  the CRA boundaries on a map (hover for the name, click to toggle) next to a searchable list.
  *Near a point* is a map to click plus a radius `Slider`. *Changed (2026-10-05):* this replaced
  a name-only area dropdown and a separate radius button, because area names alone didn't tell
  users where the areas are. Boundaries are served simplified (~30 m, ~40 KB) by the page's
  server component.

### 5.3 Metrics layer (`lib/metrics/`)

The single home of the measure × dimension × filter model from SPEC §4.

```ts
type Measure = "unitsCompleted" | "unitsApplied" | "unitsPipeline" | "shareBuilt"
             | "stageDuration" | "reviewBreakdown" | "permitCount";
type Dimension = "month" | "year" | "cohortYear" | "housingType" | "cra" | "statusCategory";

getMetric({ measure, dimension?, filters }): Promise<MetricResult>

type Cell = {
  key: string;            // dimension value
  value: number | null;   // null when withheld by the reliability rule
  permitCount: number;
  projectCount: number;
  topPermit?: { permitNum: string; share: number };  // when one permit is > 50% of units
  reliability: "ok" | "concentrated" | "insufficient";
  provisional: boolean;   // T3
  drilldown: Filters;     // filters that reproduce this cell in /permits
};
```

- **Reliability rule (T2)** is applied in exactly one place, in this layer. N is a single
  constant, calibrated in phase 2. Concentration compares the largest project with the gross
  units (added plus removed) behind a total, so net totals near zero aren't flagged spuriously.
- **Medians and percentiles** use Postgres `percentile_cont`.
- **Cohort measures** (share built) group by application year and mark the most recent cohorts
  as provisional. The cutoff comes from the M5 duration distributions, e.g. any cohort younger than
  the 75th-percentile time to completion.
- **Caching.** None yet. Pages render in about 0.1–0.5s against about 170k rows with plain indexed
  SQL, so caching was deferred. If it's needed, use Next's cache tagged `permits` and invalidate it
  after each successful sync (the job already calls `WEB_REVALIDATE_URL` when that's set).
  Materialized views are added only if profiling shows a need.

### 5.4 UI composition

- **Pages are server components.** They parse filters, call `getMetric`, and render client
  components (charts, map, interactive tables) with the data as props. Each card is wrapped in
  `<Suspense>` with a shadcn `Skeleton` fallback.
- **Shared building blocks**, all built from shadcn parts:
  - `MetricCard` (`Card` + value + `ReliabilityBadge`)
  - `ReliabilityBadge` (`Badge` + `Tooltip` with the plain-language reason)
  - `DrilldownLink` (wraps any number, links to `/permits?…`)
  - `ProvisionalMarker`
  - `FreshnessNotice` (`Alert`)
  - `DataTable` (the shadcn data-table pattern on `Table`, sorted via URL params, server-paginated)
- **Charts** all use the shadcn `ChartContainer`, `ChartTooltip` and `ChartLegend`, with one shared
  color mapping per housing type and status category in `lib/chart-config.ts`.
  - Provisional periods use a hatched or lighter fill.
  - Policy annotations are `ReferenceLine`s.
  - Forecast bands are stacked `Area`s.
  - Clicking a bar or point navigates to its drill-down.
- **Map:** CRA choropleth (GeoJSON layer) for `/where`, plus permit circle markers sized by units for
  radius and drill-down views. Leaflet controls are replaced with shadcn buttons where practical.
- **Address search** is a shadcn `Command` combobox backed by a geocoding server action.

### 5.5 Exports and source links

- **CSV export (T8):** a route handler streams the `/permits` query for the current filters as CSV.
- **"View on Seattle Open Data" (T1):** generated from the same filters wherever they can be expressed
  in SoQL. Housing type and CRA are derived values, so they can't be, and the link says which filters
  it leaves out.

## 6. Forecast (SPEC §7)

### 6.1 Model

An empirical, bottom-up, per-permit model computed by the job, not on page load.

1. **History.** For each housing type and stage (`applied`, `issued`), estimate
   from history the distribution of time-to-next-milestone and the share that die or lapse
   (lapsed counts as "not completed", dated by `expires_date`), *conditional on
   time already spent in the stage*. These are survival-curve estimates (Kaplan–Meier style) with
   still-open permits treated as censored. They're grouped by housing type, and fall back to all
   types when a group is thin.
2. **Simulation.** For each permit in the pipeline at forecast date *t*, run a Monte Carlo simulation
   (e.g. 5,000 draws) of its path, i.e. complete in quarter *q* or die. Sum units per quarter for each
   draw.
3. **Bands.** The likely band is the 25th–75th percentile of the draws, and the plausible band is the
   5th–95th. Results are stored by quarter and by quarter × housing type, along with the
   expected completion window for each permit, for drill-down.

The model lives in `lib/forecast/` as pure functions (data in, results out), unit-tested with
synthetic histories.

### 6.2 Backtest

- For each Jan 1 from 2015 onward, rebuild the pipeline *as of that date* from milestone dates.
  Fit the history using only data available at that date, then forecast and compare with actual
  completions.
- **Known problem: death dates.** For Expired permits, `expires_date` is the proxy. For
  Canceled, Withdrawn and Denied permits, the death date is unknown. The approach is to assume such
  a permit died at its last known milestone plus the median time-to-death, and to state that
  assumption on the methodology page.
- From the start of the rewrite onward, `permit_events` gives exact transitions, and backtests get
  more accurate as that history builds up.
- The published summary is the hit rate for each band (e.g. "actual inside the likely band in 7 of
  9 years"). **This is a ship gate:** the forecast UI stays hidden until the backtest has run and is
  shown.

### 6.3 Runs

The forecast and backtest recompute after each successful sync, or weekly if that's too slow.
Results are stored in `forecast_runs`, `forecast_quarters` and `backtest_results`. Each run records
the date it was generated (SPEC §7).

## 7. Verification

- **Reconciliation inside the job** (§4.2 step 3) fails the run on any count mismatch.
- **`pnpm verify:portal`:** a script that compares yearly units added and completed, and permit counts
  by status, against SoQL aggregates run on the portal. Differences above 0.1% fail it. Run it after
  importer changes and in CI on a schedule.
- **Unit tests:** status mapping, the housing-type classifier (including the accuracy report), CRA
  assignment edge cases, the reliability rule, filter ↔ SQL round-trips, and the forecast on
  synthetic data.
- **Invariant tests:** for sampled filter combinations, a drill-down list's units sum must equal the
  aggregate (X3). Run against a fixture database.

## 8. Rollout

- **Build alongside the old app, then switch over.** The rewrite gets a **new PostGIS-enabled
  Postgres service** in the `unique-purpose` project, e.g. Railway's PostGIS template, or the
  `postgis/postgis:17-3.x` image with a volume. Check what the template offers when creating it.
  The current `Postgres` service and its data aren't touched. Swapping the image on the existing
  volume is avoided because the data directory layouts differ between images.
- **Nothing needs migrating.** The new job does a full import from the portal, so the new
  database fills itself.
- **A second Railway cron service** (`import v2`) runs the new job against the new database. The
  old `import job` keeps running until cutover.
- **Cutover:** point the `seattle-building-permits` service at the rewritten app and the new
  database. Retire the old cron and the old Postgres service a few weeks later.
  - **Exception:** `permit_events` rows captured in phase 0 by the old job are copied into the new
    database before cutover, since that history can't be fetched again.

## 9. Implementation plan

Each phase ends with something verifiable.

**Status (2026-10-05):** phases 1–4 are done locally, apart from deployment. That covers filters,
the metrics layer, the reliability rule, `/permits` with its map, the radius picker (map point;
address search comes with L2), net units, the Output view, the "What we count" page and invariant
tests (`pnpm --filter @sbt/web test`, run against the local database). Still to do for cutover:
create the PostGIS service and `import v2` cron on Railway, which needs the user's go-ahead. The code
is in `packages/data` (schema, domain rules, sync) and `apps/web`.

**Phase 0: Start capturing history now** (*superseded*)
- *Changed:* the v2 sync was built first, and it already writes `permit_events` and covers
  pre-intake records, so the old job doesn't need patching. Deploying the v2 sync job is now the
  urgent first step, since history only accumulates once it runs nightly.

**Phase 1: Data pipeline v2**
- Create the PostGIS Postgres service on Railway (confirm with the user before creating it).
- Build the schema, the full-dataset keyset fetch, the staging → merge flow, `sync_runs`,
  reconciliation, soft deletes, placeholder-date handling and `development_site`.
- Build the status mapping with an unknown-status failure.
- Seed the CRA snapshot and assign CRAs with PostGIS.
- Build the `projects` table and run the double-counting audit. *Done.* The audit found that
  shoring/excavation permits restate their building's units without being linked to it. They're
  flagged `site_prep_only` and excluded from housing counts (about 4k units), and the "What we
  count" page lists them.
- Housing-type classifier v1 plus its accuracy report. Choose the multifamily cutoffs. *Done*
  (classifier v3): 97% of units / 92% of permits correct on 2018–2023, 99% / 93% on 2010–2017.
  The weakest type is detached houses in recent years. Cutoffs are provisional at 20 and 150 units.
- Net-units check (§4.8). *Done:* net is the headline, with demolitions dated by issue.
- Write `pnpm verify:portal`. *Done.* Yearly units completed and applied, and permits by status, all
  match the portal exactly.
- **Exit:** yearly totals match the portal within 0.1%. The classifier report is reviewed. The open
  data questions (§10) are answered.

**Phase 2: Foundations of the app**
- shadcn setup: consolidate `components/ui`, add the needed components, theme tokens, and the
  chart config.
- nuqs filters, `filtersToWhere`, the metrics layer, the reliability rule (and calibrating N),
  and provisional logic.
- Shared blocks: MetricCard, ReliabilityBadge, DrilldownLink, DataTable, FreshnessNotice.
- `/permits` drill-down list with sorting and pagination.
- **Exit:** invariant tests pass. Drill-downs add up exactly to their aggregates.

**Phase 3: Output + cutover**
- V1 Output, with year-to-date and trailing-12-month totals, housing-type stacking and policy
  annotations.
- Map with markers sized by units, and radius lookup (L1).
- The "What we count" methodology page (T6): inclusion rules, exclusions with live counts and the
  status mapping, generated from the same definitions the code uses. It ships at cutover because
  trust depends on it. Forecast and classifier sections are added in later phases.
- **Cutover:** the rewrite replaces the current app at this point, since it's already more correct
  (no undercounting).

**Phase 4: Bottlenecks** — *done locally (2026-10-05)*
- Measures M4–M6, V3 Bottlenecks (funnel, durations, review breakdown by housing type), and V5
  Stalled.
  - Share built (M4) is per permit, by the permit's own application year and status, so every
    cell drills down exactly. Dead permits superseded by a live one on the same project turned
    out to be negligible (3 units), so no project-level adjustment is needed.
  - Durations (M5), review breakdown (M6) and stalled projects are per project.
  - A cohort is provisional until the 90th percentile of applied→completed time for its type has
    passed (the 75th left visibly unsettled years unshaded).
  - Review breakdown starts with 2018 applications: before that the City didn't record the
    City/applicant split (corrections read 0).
  - Stalled = in the current stage longer than the 90th percentile for its type (last 10 years of
    applications), or an issued permit expiring within 90 days.

**Phase 5: Where + Explorer**
- V2 Where (CRA choropleth + ranked table, compared with the prior 12 months).
- `/explore` (X1, plus X2 comparing against the rest of the city or an earlier period).

**Phase 6: Forecast**
- Survival estimates, Monte Carlo simulation, backtest, storage, and V4 with drill-down.
- The full methodology page, with live classifier and backtest results.
- The forecast ships only with its backtest visible.

**Phase 7: Finish**
- CSV export, "View on Seattle Open Data" links, address lookup (L2), mobile pass, accessibility
  pass, and removing old code and tables.

## 10. Open decisions

1. **Pre-intake records:** keep them excluded (v1 default), or show them? See SPEC open question 2.
   Any use beyond a current snapshot depends on `permit_events` history accumulating.
2. **CRA groups:** expose the 13 CRA groups as a coarser level in the UI, or use them only as a
   fallback for the reliability rule?
3. ~~**Net vs. gross headline**~~: net, decided by the phase 1 check (§4.8).
4. **Forecast refresh:** nightly or weekly, depending on job runtime.
5. **Display start year:** data now goes back further. Should displays still start in 2010 by
   default? Records before ~2005 are probably sparse; profile in phase 1.
