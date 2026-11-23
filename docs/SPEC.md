# Seattle Building Tracker — Product Spec

> This spec covers **what a user should be able to find out** from the application.
> It leaves out components, routes and storage on purpose. Any design that lets users
> answer these questions, with the stated accuracy and transparency, meets the spec.

---

## 1. Purpose

The application answers two questions:

1. **How is Seattle doing on housing *this year*?** How many homes have been finished so far,
   how that compares with last year, what's entering the pipeline, and what has moved.
2. **How is it going *in a particular place*?** For a neighborhood, an urban village or the
   area around an address: what's been built, which projects are in the pipeline, which of
   them are moving, and which are stuck.

Every number is traceable to public City of Seattle permit records. A skeptical user can
open any figure and see the projects behind it.

## 2. Shared definitions

The whole app uses these terms the same way. Each one is explained in place wherever it's
used (§5, T6).

- **Permit**: a single City of Seattle permit record.
  - Every building permit that adds housing units counts toward **units added**, whatever its
    permit class. That includes "Commercial" mixed-use buildings.
  - **Demolition permits count only toward units removed, never toward units added**, even when
    the City's record shows units added on them.
- **Project**: all the permits for one development: its building permits, plus any demolition
  permits on the same development site, as identified by the City. A permit with no
  development site is its own project.
  - Unit totals are credited per permit, as each building reaches its milestone. A townhouse
    site that finishes over 18 months adds units as each building completes.
  - Anywhere the app lists what's happening, it lists **projects**, not permits. Each project
    can be opened to see its permits (P4).
- **Units added / units removed / net units**: units created, units demolished, and the
  difference. **Homes completed** means net units: units added by permits completed in the
  period, minus units removed by demolitions issued in the same period. Demolitions are dated
  by issue because the City often closes them out years after the building is gone. The units
  removed are always shown next to it.
- **Milestones**: *applied* → *issued* → *completed*. Each permit has a date for every
  milestone it has reached. *Completed* is roughly final inspection or occupancy, and it can
  lag move-in by weeks to months. Users are told so.
- **Stage**: every project is at exactly one of these, taken from its **main permit** (the one
  with the most units, which also sets the project's housing type). When the project's other
  permits are further along or behind, the project says so (e.g. "partly complete: 4 of 10
  homes"):
  - **In review**: applied, not yet issued.
  - **Issued**: permit issued, construction not yet completed.
  - **Completed**: a completion date is recorded. A recorded completion counts even if the
    City's status later reads Expired or Issued, but never for a dead permit.
  - **Permit expired**: issued, then expired with no completion recorded. That's true even
    if the City's status hasn't caught up. Seattle construction permits expire 18 months after
    issuance unless renewed. An expired permit might mean:
    - the project stalled or was abandoned,
    - the building was finished but the final inspection was never recorded, or
    - the work moved to another permit.

    The data can't tell these apart, so the app says so wherever it shows the label. Expired
    projects are never counted as completed.
  - **Dead**: canceled, denied or withdrawn, or expired before being issued. These are not
    shown in pipeline lists, but they do appear in movement (as "died").
- **Pipeline**: projects that are in review or issued.
- **Movement**: a dated change in a project's progress:
  - it applied, was issued or completed,
  - its permit expired, or
  - it died.

  Movements carry the City's own date where there is one. A death with no City date is dated
  by when the app first noticed it, and that's labeled. Changes from before the app started
  recording (October 2026) show only the City's milestone dates.
- **Stalled**: a pipeline project that meets a simple fixed rule anyone can check:
  - **in review for 3 years or more**, or
  - **issued 4 years ago or more and not completed**.

  Separately, **expiring soon** flags an issued project whose permit expires within 6 months.
  The thresholds are stated wherever the label appears (open question 4).
- **Housing type**: a single classification for every project, combining building form and,
  for multifamily, size:

  > Detached house · ADU/DADU · Townhouse/rowhouse · Small multifamily · Mid-size
  > multifamily · Large multifamily · Other/unknown

  - *Other/unknown* is always shown, never dropped.
  - When the type is inferred by the app rather than taken from the City's own fields, the
    share that was inferred is shown (T4).
- **Place**: a part of the city a user can ask about. It's one of:
  - **Neighborhood**: a named neighborhood with a boundary that matches what residents mean.
    "Roosevelt" means Roosevelt, not a larger statistical area that contains part of it.
    Neighborhoods cover the whole city without overlapping, so every located permit is in exactly one.
  - **Urban village or center**: a center from the City's current Comprehensive Plan (the
    One Seattle Plan's regional, urban and neighborhood centers), e.g. the Roosevelt Urban
    Center. That's where the City has planned for growth, so
    it's often the boundary that matters for housing policy. Urban villages overlap
    neighborhoods.
  - **Near an address**: a radius around an address or map point. The default is ½ mile, and
    ¼ mile and 1 mile can be chosen instead.

  Totals are never added up across overlapping places. Users can always see a place's boundary
  on a map.
- **This year**: the current calendar year to date. Every this-year figure is compared with
  **the same dates last year**, and is marked provisional, because completions are sometimes
  recorded late. During January, when there's too little of the new year to say much, the
  front page and place reports show the previous year in review by default (still marked
  provisional), with an obvious switch to the new year so far.

## 3. Measures

The pages are built from these:

| Measure | Meaning |
|---|---|
| **Homes completed** | Net units reaching *completed* in the period (§2), with units removed beside it |
| **Homes permitted** | Units on permits *issued* in the period. A sign that construction is about to start |
| **Homes applied for** | Units on permits *applied* for in the period. New projects entering the pipeline |
| **In the pipeline** | Units and projects in review and issued, as of today, with how many are stalled |
| **Proposals** | Units in projects the City has on file but that haven't formally applied yet. Shown separately, never added to the pipeline (open question 2) |
| **Movement** | Projects that moved in a period, by kind |
| **Project count** | Shown next to every unit total |

## 4. Pages

**P1. This year (front page)**
- Question: how is Seattle doing on housing this year?
- Leads with the year, labeled with its exact date range (e.g. "Year to date · 1 Jan – 21 Nov").
  A place search ("How's it going in…") sits prominently beside the title.
- Shows:
  1. **Headline numbers**: homes completed, permitted and applied for this year, each against
     the same dates last year; and the pipeline today, split into in review and issued, with
     units stalled.
  2. **What got finished**: homes completed this year, by housing type.
  3. **Where it's happening**: neighborhoods ranked by homes completed this year. Each row
     opens that neighborhood's report.
  4. **Biggest projects this year**: the largest projects completed and issued, each with
     its share of the year's total.
  5. **Recent movement**: movements citywide in the last 30 days for projects of 10 or more
     units, newest first, with a link to all of them.
  6. **The long view**: homes completed per year since 2010, with this year shown as
     year to date. Policy changes that matter appear as dated, numbered markers. Each links to
     a primary source, and no causation is claimed. **Every marker must be checked against a
     primary source (City ordinance, council or department page) before it ships.** Starting
     list, checked on 2026-11-22:

     | Date | Event | Source |
     |---|---|---|
     | 2019-04-19 | Mandatory Housing Affordability takes effect citywide (Ord. 125791, CB 119444) | [City Clerk](https://clerk.seattle.gov/search/ordinances/125791) |
     | 2019-08-08 | ADU reforms take effect: two ADUs per lot, no owner-occupancy or parking requirement (Ord. 125854, CB 119544) | [City Clerk](https://clerk.seattle.gov/search/ordinances/125854) |
     | 2025-06-30 | Interim middle-housing zoning for state HB 1110 takes effect (Ord. 127219, CB 120969) | [OPCD](https://www.seattle.gov/planning-and-community-development/current-projects/encouraging-backyard-cottages) |
     | 2026-01-21 | Permanent middle-housing zoning takes effect (Ord. 127376, CB 120993) | [City Clerk](https://clerk.seattle.gov/search/ordinances/127376) |

     Seattle ordinances take effect 30 days after the mayor signs them unless they say
     otherwise. The Clerk's records give the signing dates.

- **Past years**: the user can step back to any earlier year and see it as a year in review,
  compared with the year before. Completed, permitted and applied-for figures, the type mix,
  the ranking and the biggest projects work the same way. Today's pipeline and recent movement
  don't apply to a past year, so they're replaced by **what happened to that year's
  applications**: how many units have since completed, are still in progress, had their
  permit expire, or died.

**P2. Place search**
- Available from every page. Users find a place by its name, without needing to know City
  area codes or build filters. As the user types, place matches appear grouped as
  **Neighborhoods** and **Urban villages and centers**, each with a one-line hint (e.g. units
  in the pipeline). Addresses and streets are looked up when the user submits the search.
- Common and informal names find the right place ("U District", "Capitol Hill", "the
  Junction"). A name that matches more than one kind of place shows all of them.
- Choosing an address offers both the projects at that address and a report on the area
  around it.

**P3. Place report**
- Question: how is housing going in this place?
- Opens with the place's name and kind, a one- or two-sentence plain-language summary of the
  year (e.g. "Few homes finished this year, but 1,086 units are in the pipeline…"), and a map
  of the boundary with pipeline projects marked by stage and sized by units.
- One click switches to a related place (the overlapping urban village or neighborhood) or
  widens to a radius.
- Shows, in this order:
  1. **This year in this place**: the P1 headline numbers for the place, each against last year.
  2. **Projects in the pipeline**: a table with address, units, housing type, stage, how long it's been at
     that stage, permit expiry, and a flag (stalled / expiring soon / permit expired). The table
     can be sorted by units, time in stage and last movement. Proposals are mentioned below it with their count and
     units, and can be shown on request.
  3. **Movement**: a dated feed of what changed, newest first. It can be switched between the last 30 days, 6
     months and 1 year.
  4. **The long view**: homes completed per year in this place, and the place's share of the
     city's completions over time.
- Places are small, so the report leans on **project lists, which are always shown**, rather
  than on derived statistics, which follow the reliability rule (T2).

**P4. Project**
- Question: what's going on with this project?
- Shows the address, units, housing type, place, and the City's description. It also links to
  the City's official record and a street-level view of the site, labeled as possibly older
  than the permit.
- **Where it stands**: stage, time at that stage (against the stalled threshold), permit expiry,
  and last movement. When the permit has expired, the page explains what that can and can't mean.
- **Timeline**: applied → issued → (expired) → completed, with dates and the time between each.
- **Permits on this site**: every permit in the project, including demolitions, with units
  added and removed and the replacement ratio (units added per unit demolished).

**P5. About the data**
- One short page, linked from the footer and from every info tooltip. It covers:
  - the source and the last sync date,
  - what's counted and what isn't (in plain language, with the size of each exclusion),
  - how stages, stalled and movement are decided,
  - where place boundaries come from,
  - and known data quirks (late completions, missing locations, inferred housing types).

## 5. Trust and transparency

**T1. Every number is traceable.** Any headline number, chart bar or count in a ranking opens
the list of projects behind it, and that list adds up exactly to the number. (A ranked row's
name opens that place's report; its number opens the projects.)

**T2. Reliability rule.**
- Every total shows how many projects are behind it.
- If one project makes up more than half of a total, the total says so and names that project
  (e.g. "One project is 131 of them").
- Percent changes and shares are hidden when fewer than **N projects** are behind them (open
  question 3). The raw numbers and the project lists are always shown instead.

**T3. Provisional periods.** This year, and any period known to be revised by late-recorded
completions, are marked provisional.

**T4. Disclosed inference.** Where housing type is inferred, the share that was inferred and
the share that is unknown are shown. Where a movement's date comes from when the app first
noticed it, that's shown too.

**T5. Freshness.** The last successful sync date is visible on every page, with a warning if the last sync failed
or is more than a few days old.

**T6. Explained in place.** Each number and label (stalled, permit expired, provisional) has an
info tooltip saying what it counts, linking to the matching part of P5.

**T7. Shareable links.** Every page, including a place report for a radius or a past year,
has a link that shows the same thing when reopened, relative to the live data. A place
report's link reads as the place's name.

## 6. Phone use

Every page works at phone width. Tables scroll inside their own box, and the place search is
reachable from the top of every page.

## 7. Non-goals

- **Analysis beyond the pages above**: there's no free-form explorer, no bottleneck analysis (review times,
  correction cycles, share of projects built), and no ranking views other than P1's.
- **Forecasting**: no predicted completions, pace lines or "likely to finish" ranges. The pipeline
  lists and homes permitted say what's coming.
- Rental prices, affordability levels and income restrictions.
- Non-residential construction.
- Filing or tracking your own permit. Users are sent to the City's systems.
- Notifications, watchlists and accounts. A shared place-report link is the substitute.
- Custom drawn boundaries, per-capita figures, zoning and transit analysis.

## 8. Priority

| Priority | Scope |
|---|---|
| **P0** | P1 This year, P4 Project, P5 About, T1–T7 |
| **P0** | Neighborhood and urban-village boundaries, P2 Place search, P3 Place report |
| **P1** | Movement feeds (P1, P3), stalled / expiring flags, past-year view |
| **P2** | CSV download of any project list |

Pages and code for the dropped sections (bottlenecks, stalled list, forecast, explorer, the full
methodology page) can be removed once P1–P5 are in place.

## 9. Open questions

1. **Boundary sources.** *Resolved:* neighborhoods come from the City Clerk's Neighborhood
   Map Atlas (its 94 smallest neighborhoods cover the city with no overlaps), and centers from
   the One Seattle Plan's 2044 centers layer. The list of informal names will keep growing.
2. **Proposals.** About 1,250 projects (about 22k units) are on file before formal application,
   and the City publishes no dates for them. Is "proposals: N projects, M units" under the
   pipeline table useful, or noise?
3. **Reliability threshold N** for hiding percent changes in small places.
4. **Stalled thresholds.** Set at 3 years in review and 4 years issued. Large buildings typically
   spend about 2.1 years in review and 2.8 years from issue to completion, so the earlier 2- and
   3-year thresholds flagged about half of normal large buildings. Revisit once there's feedback.
5. **Expired but "Issued".** Some issued permits are past their expiration date while the City
   still lists them as Issued (e.g. 6716 Roosevelt Way NE). Treating them as *permit expired*
   is the current rule. Check how often a renewal shows up later.
6. **Movement before October 2026.** Deaths before then have no reliable date. Should they show
   in movement at all, or only from October 2026 on?
7. **Noisy change records.** *Resolved:* the October 2026 flapping came from the City's
   data (one snapshot dropped expiration dates on 138k permits, and the next restored them).
   Movement doesn't rely on recorded expiration changes, and the sync refuses a snapshot that
   suddenly loses most of a field.
