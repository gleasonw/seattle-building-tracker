# Seattle Building Tracker — Product Spec

> This spec covers **what a user should be able to find out** from the application.
> It leaves out screens, components, routes and storage on purpose. Any design that
> lets users answer these questions, with the stated accuracy and transparency, meets the spec.

---

## 1. Purpose

The application helps users understand **where Seattle is succeeding at building more
housing, and where it is getting stuck.**

That breaks down into three questions:

1. **Where is housing getting built?** Which areas and housing types produce the most new
   homes, and which are growing or shrinking over time.
2. **Where are the bottlenecks?** At which stage do projects slow down or die, for which
   kinds of projects, and is that getting better or worse.
3. **What's coming?** How much housing is in the pipeline, and how much of it is likely
   to actually be built.

Every number is traceable to public City of Seattle permit records. A skeptical user
must be able to check any figure down to the individual permits behind it.

## 2. Primary user

The primary user is **someone trying to understand what's working and what isn't in
Seattle housing production.** That might be an advocate, journalist, policy staffer or
an informed resident. Their usual workflow:

1. **Spot** a pattern, e.g. "townhouse completions doubled" or "large projects are taking
   a year longer to get issued".
2. **Isolate** it by narrowing to the area, housing type or time period where it shows up.
3. **Compare** that segment against the rest of the city, or against its own past.
4. **Explain** it by opening the actual permits behind the pattern.
5. **Cite** it with a link or export that reproduces exactly what they saw.

The app supports this workflow at two levels:

- **Curated views** (§5) are a small set of opinionated setups that each answer one question well.
  They're for spotting.
- **The explorer** (§6) offers any measure × any dimension × any filters. It's for isolating,
  comparing and explaining.

Casual lookups ("what's going up on my block?") are supported (§8) but not optimized for.

## 3. Shared definitions

The whole application uses these terms the same way. Users can see what each one means
wherever a number is shown.

- **Permit**: a single City of Seattle permit record. **Every building permit that adds
  housing units counts toward units added, whatever the City's permit class.** That includes
  "Commercial" mixed-use buildings, which account for about a third of completed units.
  Demolition permits count only toward units removed.
- **Project**: all the permits for one development: its building permits, plus any demolition
  permits on the same development site, as identified by the City. A permit with no
  development site is its own project.
  - Unit totals are credited per permit, when each building reaches its milestone. A townhouse
    site that finishes over 18 months adds units as each building completes.
  - Outcomes are judged per project: counts, durations, share built, stalled lists and the forecast.
    That way 45 townhouse permits on one site count as one development, not 45 independent data points.
- **Units added / units removed / net units**: units created, units demolished, and their
  difference. Net units are the preferred headline *if* the data supports it (open question 4).
  Otherwise the headline is units added, labeled as gross.
- **Lifecycle milestones**: *applied* → *issued* → *completed*. Each permit has a date for
  every milestone it has reached.
- **Status category**: every permit is in exactly one of these:
  - **Pipeline**: not yet finished and not dead (in review, issued, under construction).
  - **Done**: construction finished (completed, closed, approved to occupy, inspections completed).
  - **Lapsed**: the permit was issued but then expired, so the outcome is unknown. Seattle
    construction permits expire 18 months after issuance unless renewed. An expired permit might mean:
    - the project was abandoned or stalled with no real progress,
    - the building was finished but the final inspection was never recorded, or
    - the work continued under a different permit.

    The data can't tell these apart, so lapsed permits are shown separately. They are never counted
    as built, they are left out of share built (M4), and they appear as their own stage in the
    funnel. Lapsing after issuance is itself a bottleneck signal.
  - **Dead**: will not be built under this permit (canceled, denied, withdrawn, or expired
    before ever being issued).
- **"Completed"** means the permit's completed date. Users should be told that this is
  roughly final inspection or occupancy, and that it can lag move-in by weeks to months.
- **Housing type**: a single classification for every permit, which combines building form
  and, for multifamily, size:

  > Detached house · ADU/DADU · Townhouse/rowhouse · Small multifamily · Mid-size
  > multifamily · Large multifamily · Other/unknown

  - The multifamily size cutoffs are set from the data, ideally where construction type
    actually changes (low-rise / mid-rise / high-rise) rather than at round numbers.
  - *Other/unknown* is always shown, never dropped.
  - If a type is inferred by the app rather than taken from the City's own fields, that is
    disclosed (§9).
  - There is no separate "project size" dimension.
- **Area**: a **Community Reporting Area** (CRA), the City's own set of roughly 50 areas for
  statistical reporting. CRAs cover the whole city with no overlaps, have neighborhood-like
  names, are stable over time, and are built from census tracts. Every permit with a location
  belongs to exactly one CRA. Area names should match the City's official CRA names.

---

## 4. Measures, dimensions and filters

Everything the app shows is some combination of these.

### Measures

| ID | Measure | Notes |
|---|---|---|
| M1 | **Units completed** (net or gross per §3) | Main output measure |
| M2 | **Units applied for** | Leading indicator |
| M3 | **Units in pipeline**, split by stage (applied, not issued / issued, not completed) | Snapshot as of today |
| M4 | **Share built** | Of units applied for in a cohort: % completed / still pending / lapsed / dead. Recent cohorts are marked provisional |
| M5 | **Median days per stage** | Applied→issued and issued→completed, with the 25th–75th percentile spread |
| M6 | **Review breakdown** | Days the City spent reviewing vs. days the applicant spent on corrections, and the number of review cycles |
| M7 | **Permit count** | Always available next to unit measures |

Unit totals can be shown per month, per year, or as a **trailing 12-month total**. The trailing
total is the default for "is this year ahead or behind?" so seasonal patterns don't mislead.

### Dimensions (group by)

| ID | Dimension |
|---|---|
| D1 | Time (month / year / application-year cohort) |
| D2 | Housing type |
| D3 | Area |
| D4 | Status category |

### Filters

Every view can be narrowed by any combination of these. Every filter in effect is visible
and can be removed individually.

- Date range
- Which milestone the date refers to (applied / issued / completed)
- Status category
- Housing type
- Area. When choosing areas, users can see where each one is on a map, not just its name.
- Radius around an address or map point
- Minimum units added
- Permit sub-type (new construction, addition/alteration, …)

## 5. Curated views

These are the app's opinion about what's worth looking at. Each view:

- has a fixed setup of measures and dimensions,
- carries a one-line caption saying what to look for,
- respects any filters the user applies, and
- can be opened in the explorer (§6) with its setup already applied.

Five views at most. Past that, curation turns back into a menu.

**V1. Output**
- Question: how much are we building, and what kind?
- Shows: units completed (M1) per year and as a trailing 12-month total, stacked by housing type.
  Also shows the year-to-date figure against the same date range last year, with exactly
  aligned windows. Policy changes that matter appear as dated annotations. The list of dates
  lives in one place, each date links to a primary source, and no causation is claimed.
  **Every annotation must be checked against a primary source (City ordinance, council or
  department page) before it ships.** Starting list, checked against sources on 2026-10-04:

  | Date | Event | Source |
  |---|---|---|
  | 2019-04-19 | Mandatory Housing Affordability takes effect citywide (Ord. 125791). It had been applied to six areas in 2017 | [City Council](https://seattle.gov/council/committees/citywidemha) |
  | 2019-08-08 | ADU reforms take effect: two ADUs per lot, no owner-occupancy or parking requirement (CB 119544) | [OPCD](https://www.seattle.gov/opcd/ongoing-initiatives/encouraging-backyard-cottages) |
  | 2025-05-27 | Interim middle-housing ordinance passed for state HB 1110 (CB 120969). *Effective date still to be confirmed* | [OPCD director's report](https://www.seattle.gov/documents/departments/opcd/seattleplan/oneseattleplaninterimstatezoningcompliancelegislationdirectorsreport.pdf) |
  | 2026-01-21 | Permanent middle-housing zoning takes effect (CB 120993) | [City Council](https://www.seattle.gov/council/topics/2025-comprehensive-plan) |

  Process changes count too, because they affect the bottleneck measures. One example is the City
  cancelling applications older than 24 months, which started in 2023
  ([SDCI](https://buildingconnections.seattle.gov/2023/10/02/sdci-is-cancelling-applications-older-than-24-months/)).
  Its exact start date is still to be confirmed.
- Also shows: the largest completed permits in the selected period and their share of
  the total.

**V2. Where**
- Question: where is it working, and where is it growing or shrinking?
- Shows: units completed (M1) by area for the last 12 months against the prior 12 months, as a map and
  as a ranked table. The table can be sorted by total or by change. A drill-down shows
  each area's housing-type mix.

**V3. Bottlenecks**
- Question: which kinds of projects stall or die, and at which stage?
- Shows, for each housing type: share built (M4), median days per stage (M5) and the review
  breakdown (M6), each trended by application year. A funnel per type shows units that were
  applied → issued → completed, with the dead units at each stage and the lapsed units after
  issuance, so the user can see whether the problem is projects dying or projects being slow.

**V4. Pipeline & forecast**
- Question: what's coming, and how sure are we?
- Shows: units in pipeline (M3) by stage and housing type, plus the completion forecast
  (§7) joined to the actual completions chart.

**V5. Stalled**
- Question: which real projects are stuck?
- Shows: pipeline projects that have spent much longer in their current stage than is
  typical for their housing type (e.g. issued 3+ years ago and not completed, or close to
  expiring). The list is ranked by units at risk and shows time in stage, expiration date
  and a link to the City record.

## 6. Explorer

**X1. Any measure by any dimension**
- The user picks a measure, a dimension and filters, and gets a chart and a table.
- Accept: with no dimension chosen, the result matches the corresponding total in the curated views.

**X2. Compare**
- The user can compare the current filtered segment against **the rest of the city** or
  against **the same segment in an earlier period**.
- Period comparisons cover the measures that happen over time: units completed (M1), units applied
  (M2) and median days per stage (M5). The default is the last 12 months against the prior 12 months.
  The pipeline snapshot (M3) is shown only as of today, since past pipelines can only be
  approximately reconstructed.
- Accept: both sides are shown together, with the difference and each side's reliability (§9).

**X3. Open the permits behind any number**
- Any number, chart point or table cell opens the exact list of permits behind it. The list
  can be sorted by date, units and permit number.
- Accept: the permits in the list add up exactly to the number that was clicked.

**X4. Map**
- Shows the current filtered permits on a map. Marker size reflects units, not just
  permit count.

## 7. Completion forecast

- **Determine:** roughly how many units are likely to complete in each of the next 4–8
  quarters, and which housing types they'll come from.
- **Method requirements** (what, not how):
  - Built bottom-up from permits currently in the pipeline. Each permit's chance of
    completing, and when, comes from how past permits of the same housing type at the same stage
    turned out (M4, M5). It is not a trend line extended forward.
  - Accounts for both timing and attrition (the share that die).
  - Covers only the existing pipeline, with no allowance for projects not yet applied for. The
    chart says plainly that the forecast thins out after about 2 years for that reason.
- **Accept:**
  - Shown as a range (a likely band and a wider plausible band), never as a single number.
  - Can be broken down by housing type. There is no breakdown by area, since most areas would be too thin.
  - **Backtest is required:** the user can see what the method *would have* forecast from
    past dates (e.g. each Jan 1 since 2015) against what actually happened, plus a plain
    summary such as "actual completions fell inside the likely band in 7 of 9 years".
    A forecast without a visible track record must not ship.
  - **Drill-down:** the user can open the list of pipeline permits behind each forecast
    quarter, with each permit's estimated completion window.
  - The forecast states the date it was generated.

## 8. Lookup

**L1. Near a place**
- The user can restrict any view to a radius around an address or map point. Every number
  on the page respects the radius.

**L2. What's happening at this address?**
- Searching an address lists the permits there: status, housing type, units added and
  removed, the key dates (applied / issued / completed / expires), the description and a link
  to the City's official record.

**L3. Project history**
- Any project can be opened to show all of its permits on one timeline (demolition,
  building permits, milestones), with units added, units removed and the replacement ratio
  (units added per unit demolished).

## 9. Trust and transparency

**T1. Every number is traceable**
- Any number opens the list of permits behind it (X3). A "view on Seattle Open Data"
  link reproduces the same query at the source wherever that's possible.

**T2. Reliability rule**
- Every aggregate shows **how many projects are behind it**.
- If **one project makes up more than half the units** of a total, the total is flagged and the
  flag names that project.
- **Derived numbers** (percent changes, medians, shares, ranks, forecast breakdowns) are not
  computed when fewer than **N projects** are behind them (N is calibrated from data, see open
  question 3). In their place the app shows "not enough data — based on k projects". Raw counts are always shown.
- Rankings (V2) leave out segments below N and say how many were left out.

**T3. Provisional periods**
- The current partial month and year, recent application cohorts (M4), and any period
  known to be revised by late-recorded completions are marked as provisional. Comparisons
  that involve them say so.

**T4. Disclosed inference**
- When housing type is inferred by the app rather than taken from the City's own fields,
  breakdowns show the share that was inferred and the share that is unknown.

**T5. Freshness**
- The date of the last successful data sync is visible. A warning appears if the last
  sync failed or is more than a few days old.

**T6. Methodology: "What we count"**
- One page that a skeptical reader can check the app against. It covers:
  - **What's counted.** The inclusion rules in plain language ("every building permit that adds
    housing units, whatever its permit class"), how units added and removed are dated, and how
    permits are grouped into projects.
  - **What's left out, with numbers.** Each exclusion comes with its live size, e.g. "N
    pre-application proposals (M units) aren't counted because they haven't formally applied".
  - **Status categories.** How every City status maps to pipeline / done / lapsed / dead.
  - **Housing type.** How types are assigned and how accurate the inference is.
  - **The reliability rule**, the provisional-period rules, the forecast method and its backtest
    results, and known data quirks (placeholder dates, missing coordinates, late completions).
- Every number's info tooltip links to the relevant section, so "what does this count?" is
  always one click away.
- The page is regenerated from the same definitions the app uses, so it can't drift from the
  actual counting.

**T7. Shareable, reproducible views**
- Any curated view or explorer setup can be bookmarked or shared, and shows the same
  thing when reopened (relative to the live data).

**T8. Export**
- The permit list behind any view can be downloaded as CSV. Charts can be downloaded
  as images.

## 10. Non-goals

**Out of scope:**
- Rental prices, affordability levels and income restrictions.
- Non-residential construction: floor area, and commercial projects that add no housing.
  Any permit that adds housing units is in scope, whatever its permit class (§3).
- Filing or tracking your own permit. Users are sent to the City's systems.
- Predicting an individual project's outcome, or "how long will my project take?" estimates.
- Tracking progress against official city housing targets. There's no reliable,
  machine-readable source for them.
- Notifications, watchlists and digests. These need user accounts, which makes them a different product.

**Deferred** until the core is proven, or until data or real need justifies them:
- Additional boundary sets beyond CRAs.
- An "inside a designated growth center?" flag for comparing growth inside and outside the
  Comprehensive Plan's centers. It's a single yes/no attribute, not a second set of boundaries.
- Per-capita and per-acre normalization.
- Transit-proximity analysis.
- Zoning analysis.
- Fast/slow outlier detection against peer projects.
- Storing forecast snapshots to track forecast against actual, and monthly forecast-change explanations.
  The backtest covers track record.

## 11. Priority and order

| Priority | Scope | Why |
|---|---|---|
| **P0** (honest baseline) | M1, M2, M7, V1 (without the type stacking), X3, X4, L1, T1, T2, T5, T7 | Trustworthy totals you can trace to their permits, with clear signals when data is thin |
| **P1** (housing type) | D2 housing type, V1 stacking, T4 | Every later view depends on it |
| **P1** (bottlenecks) | M4, M5, M6, V3, V5, T3, issued-date milestone | Historical durations and attrition. Also the forecast's inputs |
| **P1** (forecast) | §7, M3, V4, T6 | Headline feature. Ships only with its backtest |
| **P2** (where) | D3 area (CRA), V2, X1, X2 | Needs CRA boundaries loaded and assigned to permits |
| **P2** (finish) | L2, L3, T8 | |

Suggested order: **housing type → bottleneck measures → forecast**, with area work
running in parallel once boundaries are chosen.

## 12. Open questions

1. **Double counting:** within a development site, do any building permits restate units that
   another permit already counts (e.g. a master permit plus dependent permits)? Audit once and
   add a dedup rule if the effect is material.
2. **Pre-application stage:** about 1,500 proposals (about 27k units) are in the City's system
   before formal application, mostly waiting on the applicant. The City publishes no dates for
   them. Should the app show them, and how (see the discussion of possible uses)?
3. **Reliability threshold N:** calibrate from real data, e.g. find the project count
   below which year-over-year changes in an area often reverse the following year.
4. **Net units:** units removed are recorded mostly on demolition permits, which link to
   their replacement buildings through the development site 78% of the time. Confirm that
   dating removals by the demolition's completion gives sensible yearly net figures before
   making net the headline.
5. **Housing type:** the City's dwelling-type field has almost stopped being filled in
   (9% of 2025 applications, 0% of 2026), so recent types must be inferred. Accept the
   inference only where it validates well against older years. Also where to set the multifamily
   size cutoffs.
6. **Display start year:** the full history is imported. Should displays still start in 2010
   by default?
