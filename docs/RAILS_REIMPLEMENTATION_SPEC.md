# Lollipop Monthly Reports — Handoff Specification for Rails Reimplementation

Version: 2026-09-06 · Source system: Next.js 16 (App Router, React Server Components), deployed on Vercel.
This document stands alone: it describes every page, chart, control, calculation, data shape, and visual
token needed to rebuild the product without access to the original code. Sections marked **⚠ UNFINISHED /
AMBIGUOUS** call out half-built corners honestly — read §13 before estimating.

---

## 1. Product overview

Lollipop sells employee check-in software (employees rate mood 1–5, pick emotions, optionally comment,
optionally request follow-up). This app turns monthly exports of that data into a **workforce-intelligence
report** per customer:

- A **web dashboard** (one long page per customer+month) with interactive team/employee drill-down.
- A **print/PDF pipeline** producing an executive PDF (full ≈ 19 landscape pages, or a one-page "snapshot
  brief") via browser-native printing.
- **Per-team manager reports** at their own URLs, privacy-scoped for distribution to team managers.

There is **no database and no authentication**. All customer data lives in one large JSON file bundled with
the app; every page is server-rendered per request from that file. A Rails rebuild will presumably move this
into real models — §8 gives the schema.

**Roles/audiences** (soft, URL-driven, not authenticated):
- `executive` (default): individual retention risks summarized per team; no employee names in risk cards.
- `hr-restricted`: adds named individual retention-risk cards. Reached only by URL parameter.

---

## 2. Site map & navigation

| Route | Purpose |
|---|---|
| `/` | Executive dashboard (the main report). Query params: `customer`, `month`, `range`, `audience`, `team`, `employee`. |
| `/print` | Print-optimized rendering of the same report for PDF export. Params: `customer`, `month`, `range`, `audience`, `scope` (`full`\|`brief`), `autoprint`, `debugPrint`. |
| `/manager/[teamSlug]` | Manager report for one team of the selected customer. Params: `customer`, `month`. |

Navigation paths:
- Top bar (on `/`): customer dropdown ↔ month dropdown (both navigate immediately on change), plus
  "Download brief PDF" and "Download full PDF" links which open `/print?...&autoprint=1&scope=brief|full`
  in a new tab.
- Engagement summary and Mood Trends section headers each carry Team/Employee dropdowns (see §6.3) that
  rewrite `team`/`employee` params via client-side navigation (**scroll position preserved; no full reload**).
- Employee names in the team drill-down table link to the same page with `employee=<key>`; a "← Back to
  {team}" link clears it. All drill state is URL-encoded and therefore shareable/bookmarkable.
- Manager pages link back to `/` ("← Back to executive report"). Nothing on `/` currently links *to*
  manager pages — managers are given their URLs out-of-band. **⚠ AMBIGUOUS:** there is no index of manager
  report links in the UI.
- Unknown `customer` falls back silently to the first customer; unknown `month` falls back to the
  customer's latest month; unknown team slug on a manager page renders a "Team not found" screen.
- `/manager/<slug>` without a `customer` param uses the first customer — a trap if customer A and B share
  team names. Always propagate `customer`.

---

## 3. Period & date-range logic (read this first)

All check-in records carry a timestamp string, e.g. `"Jul 2, 2026 11:01 PM"` (locale `en-US`,
`MMM d, yyyy h:mm AM/PM`; double spaces occur and must be tolerated). Records are pre-grouped into
calendar-month buckets (`2026-07`) at ingestion time.

### 3.1 Weeks
- Weeks start **Monday**. A record belongs to the week of the Monday on-or-before its date.
- A month's weekly series = **every calendar week overlapping the month** (first week = week containing
  the 1st; last = week containing the last day). Boundary weeks belong to *both* adjacent months' series,
  but each month's version of that week counts **only that month's records** ("in-month check-ins only").
- Week label format: `"Jun 29"`, `"Jul 6"` (month abbrev + day of Monday). Week key: ISO date of Monday.

### 3.2 Monthly engagement (the headline metric — mandated methodology)
> Monthly engagement = the **arithmetic average of the weekly engagement rates** for all calendar weeks
> overlapping the selected month. Each weekly rate = unique employees who completed ≥1 check-in that week ÷
> eligible employees. An employee is counted **at most once per week**. Partial boundary weeks are included
> at equal weight, using only in-month check-ins.

It is **not** unique-monthly-respondents ÷ roster. The following explanatory note must appear wherever
monthly engagement is displayed (long form; a short form exists for tight spaces):

*Long:* "Monthly engagement is the average of the weekly engagement rates during the selected month. Each
weekly rate represents the percentage of eligible employees who completed at least one check-in during that
week. Employees are counted only once per week, regardless of the number of check-ins completed."
*Short:* "Monthly engagement is the average of the month's weekly engagement rates. Each employee is
counted once per week."

### 3.3 Eligible employees (denominator) & off-roster rule
- `eligible = roster_count_for_that_month + off_roster_respondents_that_month`.
- **Off-roster** = someone who responded in the month but whose `first|last` (lower-cased, trimmed) key is
  not on the roster. They are counted as engaged **and** added to the denominator — never excluded. They
  are flagged "off-roster" wherever listed.
- Person identity key everywhere: `lower(trim(first)) + "|" + lower(trim(last))`. Team is deliberately
  **not** part of the key (same person may appear under multiple teams).
- Customers with no roster fall back to `optedInPopulation` or (unique respondents + unsubscribed count).

### 3.4 Roster versioning (historical denominators are frozen)
Rosters are stored as dated versions: `rosterVersions: [{effectiveFrom: "YYYY-MM", roster: [...]}]`.
A month uses the latest version with `effectiveFrom <= month`; months before the earliest version use the
earliest. Uploading a new roster therefore **never rewrites historical engagement**. A `"0000-00"` version
acts as the all-history baseline. The top-level `roster` field duplicates the newest version (current truth
for scripts). Multi-month weekly series (trailing chart, quarter table) resolve the roster **per week**,
using the month of the week's Monday.

### 3.5 Ranges
- **Month view (default):** weekly detail table shows the selected month's weeks; the weekly engagement
  *chart* always shows the **trailing 3 months** ending at the selected month (independent of the table).
- **Quarter view** (`range=quarter`): weekly detail table spans every week of the calendar quarter
  containing the selected month (only months with data), labeled `"Q3 2026"`. Chart unchanged (trailing 3).
- **Mood trend chart:** all loaded months for the customer (up to ~24), not windowed.
- Prior-month deltas: current month vs the immediately preceding month **in the data** (a data gap means
  the delta compares across the gap — **⚠ AMBIGUOUS:** deltas are not suppressed across gaps on the
  dashboard; the standalone portfolio report suppressed them, the app does not).
- "Trailing 3-month mood," "rolling positive": mean of the last ≤3 monthly values.

### 3.6 Mood metrics
Computed from **responses only** (roster size irrelevant): `avgMood` = mean of mood values (2 dp);
`positivePct` = share of responses with mood ≥ 4 (1 dp); negative = mood ≤ 2; mood distribution buckets
1–5. Emotions: counted across all responses; top 8 kept with counts and % of total emotion mentions.

---

## 4. Complete data schema

Single JSON document (annotate → Rails models as you see fit):

```jsonc
{
  "customers": [
    {
      "id": "worksmart",                  // slug, unique
      "name": "WorkSmart",
      "industry": "Staffing",             // free text, display only
      "demo": false,                      // true = synthetic demo customer (excluded from portfolio analytics)
      "optedInPopulation": 30,            // OPTIONAL legacy denominator fallback when no roster
      "roster": [                         // CURRENT roster (mirror of newest version)
        { "id": "6160",                   // vendor employee id, display only
          "firstName": "Nairoby", "lastName": "Hernandez",
          "email": "n@x.com",             // optional
          "source": "zipdev-dev2" }       // optional tag: which sub-account contributed this entry
      ],
      "rosterVersions": [                 // see §3.4; optional (legacy customers may lack it)
        { "effectiveFrom": "0000-00", "roster": [ /* RosterEntry[] */ ] },
        { "effectiveFrom": "2026-08", "roster": [ /* ... */ ] }
      ],
      "unsubscribed": [                   // employees who opted out of check-ins
        { "firstName": "A", "lastName": "B", "date": "Mar 3, 2026", "type": "sms" }
      ],
      "months": [                         // ascending by month
        {
          "month": "2026-07",             // YYYY-MM key
          "label": "Jul 2026",            // display label
          "responses": [                  // ascending by timestamp
            {
              "id": "worksmart-2026-07-1",       // "<customer>-<month>-<n>"
              "firstName": "Dee", "lastName": "Hughes",
              "team": "GREENVILLE",              // free-text team name from the export
              "date": "Jul 2, 2026 11:01 PM",    // see §3 for format
              "mood": 5,                          // 1..5 (may be null/0 = no mood given)
              "emotions": ["Happy", "Grateful"],  // 0..n strings from a fixed vendor vocabulary
              "followUpRequested": false,
              "followUpStatus": "",               // vendor free text; effectively unused (see §13)
              "comments": ""                      // free text, may be empty
            }
          ]
        }
      ]
    }
  ]
}
```

Special conventions:
- One customer (`acme-corporation`) is a `demo: true` anonymized clone used for sales demos.
- The `zipdev` customer consolidates **two** vendor accounts: a main account plus a "dev2" account whose
  responses are force-retagged to team `"Internal Team"` at ingestion and whose roster entries carry
  `source: "zipdev-dev2"`. The report layer needs no special handling — only ingestion does.

---

## 5. Derived-metrics engine (server-side, per request)

Input: customer + month (+ range). Output: one big report object consumed by all views. Key derivations a
Rails port must reproduce (beyond §3):

- **Engagement summary**: rate, weekly series, trailing series, weeklyChange (last vs prior week, pp),
  off-roster list, `checkInCompletion` = every person (roster or off-roster responder) whose distinct
  active weeks `< totalDeliveries` (total deliveries = number of weeks in the window), sorted least-active
  first, each `{name, completed, total, onRoster}`; `optedOut` from `unsubscribed`.
- **Team metrics** (per team present in the month): responses, avgMood (2 dp), positivePct, change vs prior
  month, unique respondents + change, 6-month mood history (monthly and Monday-weekly series), sample
  warning when responses < 5, confidence banding by response count: High ≥30, Medium ≥10, Low ≥5, else
  Provisional.
- **Team engagement proxy**: no per-team roster exists, so a team's engagement rate = unique responders
  this month ÷ unique people ever seen responding for that team in the **trailing 6 months**. Label this
  as an estimate wherever shown.
- **Teams needing attention** (risk tiers Critical/High/Moderate/Watch): rule engine combining mood level,
  mood decline, engagement decline, and consecutive weekly-participation declines; teams with low samples
  are capped at Watch; teams simultaneously in "top performing" are excluded to avoid contradictions.
  Output feeds the KPI card, the risk table, and Leadership Priorities.
- **Priority actions**: at most 4 rows, ordered High→Medium→Low, each `{priority, action, appliesTo,
  reason, owner, timing}`; a follow-up-responsiveness row appears only when `followUpRequests > 0 AND
  completion < 100%`. 1–2 rows are expanded into "Recommended next steps" details with links.
- **Leadership assessment**: exactly 3 generated sentences summarizing direction, breadth, concentration.
- **Health score** `0–100` with rating **Strong / Healthy / Mixed / Watchlist / At Risk** plus component
  breakdown; a second severity banding exists (Healthy ≥82, Stable ≥70, Watch ≥58, Intervention Needed
  ≥45, else Elevated Risk). **⚠ AMBIGUOUS:** two overlapping health taxonomies exist; pick one in Rails.
- **Report confidence** `0–100` → High ≥78, Medium ≥62, Low ≥45, else Provisional. Formula:
  `min(40, responses×0.28) + team_coverage_share×25 + min(20, comments×1.2) + (has_followup_data ? 15 : 5)`.
- **Individual retention risks** (hr-restricted only): per employee with ≥2 low-mood check-ins, level in
  {Monitor, Follow-Up Suggested, Manager Action Needed, Urgent HR Review}, current mood, trend, driver
  phrases, recommended action. **⚠ KNOWN DEFECT:** driver text can claim stress/burnout language for
  employees whose moods are all 5s; see §13.
- **Comment intelligence**: keyword-rule classification of comments into themes (workload/stress,
  recognition, leadership/communication, operational friction, positive), counts, representative
  anonymized quotes, prior-month theme comparison, and up to 6 generated leadership recommendations.
  This is ~600 lines of hand-tuned heuristics — the Rails port can simplify, but the *displayed sections*
  in §6.9 must be fed.
- **Generated mailto links**: "Draft employee reminder email" and "Draft giveaway email" are `mailto:`
  URLs with prefilled subject/body (reminder body emphasizes ~10-second check-ins, optional but valuable).

---

## 6. Page `/` — the executive dashboard, section by section

Rendering: server-rendered single page; sections stack vertically in a 1240px-max column. Header order:

### 6.1 Top bar (sticky, 74px)
Brand block ("L" mark 42px, name + small subtitle) · customer `<select>` · month `<select>` (both
navigate on change — **no Apply/Generate button by design**) · "Download brief PDF" · "Download full PDF"
buttons (open `/print` in a new tab). Nothing else. (An "HR version" button existed and was removed; the
`/print?...&audience=hr-restricted` URL still works — see §13.)

### 6.2 Executive header
Eyebrow "WORKFORCE INTELLIGENCE REPORT"; customer name in large serif (Georgia, clamp 42–82px); meta line
"Jul 2026 · Prepared by Lollipop · Confidence Medium"; a support email pill. Right: **Organizational
health tile** (blue-tinted card): label, rating word (e.g. "Mixed"), "72 / 100", link "See Explanatory
Note 1" (anchor to notes appendix).

### 6.3 Executive snapshot (KPI row, 4 cards)
Grid of 4 equal cards, each with a 3px colored left accent strip by tone:
1. **Average mood** — value `3.86` "out of 5.00", delta chip vs prior month (±0.05 thresholds pick
   green/amber/coral tone).
2. **Positive sentiment** — `63.6%` "of all check-ins", delta in pts (±2 thresholds).
3. **Monthly engagement rate** — `15.2%`, sub "average of the month's weekly rates · 33 of 138 checked in
   at least once", delta in pp, blue tone, plus the §3.2 methodology note as card help text.
4. **Teams requiring attention** — count + comma list of team names (amber/coral by severity; green when 0).
Delta chips render `↗ +0.7 pp` / `↘ -1.2 pts` / `→ 0` / "No prior comparison" when no prior month.

### 6.4 Engagement summary
Section header + **controls row**: Team dropdown ("All teams" default) and, once a team is chosen, an
Employee dropdown ("All employees" default) — see §7. Right of them: **Month | Quarter** pill toggle
(default Month) which reloads with `range=quarter` (this toggle is a plain link navigation, unlike the
scope dropdowns).

Two-column grid (1fr : 3fr):
- **Weekly detail card** (left): title "Weekly detail — Jul 2026" (+ scope suffix when drilled); table
  `Week | Unique respondents | Engagement %` — one row per week of the window (§3.5); numeric columns
  right-aligned; rate bold. Below, the §3.2 note in small muted text (+ team-proxy caveat when scoped).
- **Weekly engagement chart card** (right): title "Weekly engagement — trailing 3 months" (+ scope
  suffix). Chart spec in §9.1. Caption: "Engagement rates are based on unique employees, with a maximum
  of one counted response per employee per week."

Below the grid, **when a team is scoped**: drill panel (§7). Then the **completion row**:
- Web: single card "Incomplete check-ins — Jul 2026" with count summary and a button
  **"View incomplete check-ins (127) & opted out (0)"** opening a modal `<dialog>` (§7.3).
- Print: two static cards side by side (3fr:1fr) — the incomplete list (3 columns, capped at 30 with an
  amber note linking to the full list appendix) and the "Opted out" card.

Then the **risks row** (1fr : 1fr):
- **Team engagement risks** table: `Team | Engagement issue | Current engagement | Change` — issues like
  "Low engagement" / "Declining engagement"; change cells are sentences, e.g. "down 13.2 pts (1 of 6
  responded, was 2 of 6)".
- **Suggested actions to increase engagement** card: 3–4 static-ish recommendation bullets styled as
  blue-accent list items, then two pill links "Draft employee reminder email" / "Draft giveaway email"
  (mailto:, prefilled).

### 6.5 Monthly Wide Mood Trends
Header (+ its own copy of the Team/Employee dropdowns — same state, either location drives it).
Grid 2fr : 1fr — left the mood trend chart card (§9.2); right a 2×2+1 tile stack: Trailing 3-month mood,
Rolling positive, Best month ("Jan 2026 (4.12)"), Worst month, and a wide "Persistence" tile with a
generated sentence (replaced by a scope note when drilled).

### 6.6 Leadership Priorities
Header, then a full-width blue-left-accent **assessment card** (3 generated sentences). Then a card with a
3fr : 2fr grid:
- Left: **priority table** `Priority | Recommended action | Applies to | Reason`; priority rendered as
  colored pill (High red / Medium amber / Low gray).
- Right: **"Recommended next steps"** — numbered (blue numerals) expanded details with body copy, `OWNER`
  and `TIMING` micro-labeled rows, and pill links ("Manager tools", "Draft manager email").
Empty state: "No material leadership action is recommended this period."

### 6.7 Emotional wellness
Grid 2-col: left card = top-6 emotion horizontal bar list (name, proportional bar, `count (pct%)`);
right card = "Interpretation" narrative naming the dominant emotion and tying to positive %, plus a
disclaimer that emotion frequency is directional, not clinical.

### 6.8 Follow-up responsiveness — **⚠ PLACEHOLDER**
Renders a KPI row of 5 cards (requests / confirmed / not confirmed / HR escalations / completion rate) and
an exceptions table — but is fed **hard-coded zeros** ("data layer not wired"). Faithful port = same
placeholder; better = omit until real data exists. The metrics engine *does* compute `followUpRequests`
and `followUpCompletionPct` from the raw records; the section simply doesn't consume them yet.

### 6.9 AI comment intelligence
Currently: comment volume/theme header stats, theme table (theme, trend direction, sentiment type, primary
teams, interpretation, suggestion), "Positive drivers" and "Areas requiring attention" two-column cards,
and a full-width "Leadership recommendations" ordered list (max 6). Earlier sub-sections (work-vs-personal
stress split, representative employee voice quotes, team-specific comment insights) were **deliberately
removed** — do not port them.

### 6.10 Appendix (hidden in the "brief" PDF scope)
1. **Team detail** — per-team cards in 2-col rows: mood, positive %, respondents (+changes), 6-month mini
   history, key concern/strength sentence, manager action sentence, confidence badge.
2. **Mood distribution / Positive momentum / Risk watchlist** — pie chart (§9.4) + alert-style cards.
   **⚠ KNOWN DEFECT:** the risk watchlist derives from a *legacy* team-risk list and can contradict the
   newer "Teams requiring attention" KPI; see §13.
3. **Data quality & confidence** — response counts, coverage, confidence rationale sentence.
4. **Individual retention risk** — audience-gated (§1). Executive: per-team roll-up counts by level.
   HR-restricted: named cards with mood, low check-in count, trend, drivers, recommended action.
5. **Explanatory notes** — anchored notes #1–4 (health score meaning, engagement methodology, confidence
   bands, privacy/ethics), targets of the "See Explanatory Note n" links.
6. **Full check-in completion list** (`id="full-checkin-list"`) — the uncapped incomplete-check-ins list
   in 3 columns (print target of the "full list at the end of this report" link).

---

## 7. Drill-down interactions (team → employee)

### 7.1 Scope model
`?team=<team-slug>` and `?employee=<first|last key, URL-encoded>` (employee only valid with team). Team
slugs: lowercase, apostrophes stripped, non-alphanumerics → `-` (e.g. "Hussong's Boca Park" →
`hussongs-boca-park`). Scope affects **only** the Engagement summary and Mood Trends sections; KPIs and
everything else stay company-wide. Changing team resets employee. Navigation must be client-side with
scroll preservation; the selects show a dimmed "pending" state while new data streams in.

### 7.2 What scoping recomputes
- Teams list for the dropdown: distinct team names in the trailing 6 months, alphabetical.
- Team eligible denominator: unique people seen responding for the team in trailing 6 months (proxy;
  caveat sentence appended to the methodology note). Employee scope: eligible = 1.
- Scoped weekly detail (selected month) and trailing-3-months series; a boundary week computed in two
  months keeps the entry with the larger unique count.
- Scoped mood trend across all months **with ≥1 scoped response** (empty months omitted — noted in the
  Scope tile), plus scoped tiles (3-mo mood, rolling positive, best/worst month).
- **Team view adds an employee roster table** under the engagement grid: everyone seen for the team in
  trailing 6 months — `Employee (link) | Check-ins (this month) | Weeks active ("3 of 5") | Avg mood |
  Mood vs prior mo. (delta) | Last check-in (date)`, sorted by check-ins desc then name.
- **Employee view replaces it with a check-in history panel**: header + "← Back to {team}" link; table
  `Date | Mood | Emotions (comma list) | Comment` for the trailing 3 months, newest first; em-dashes for
  blanks. Empty state: "No check-ins recorded in the trailing 3 months."
- Privacy note: employee comments are visible here with no auth — see §13.

### 7.3 Incomplete check-ins popup
Web-only `<dialog>` modal (max-width 720px, max-height 80vh, dark backdrop): sticky header (title,
description, "✕ Close"), full uncapped list in 3 columns (`name [off-roster flag] … "0 of 5"`), then an
"Opted out" section (name + date). Closes via ✕, backdrop click, or Esc. Print never shows the dialog.

---

## 8. Manager report page (`/manager/[teamSlug]`)

Audience: a single team's manager; deliberately shows **no other team's data** except the company average.
Portrait print via `window.print()` (its own print styling; single "Download PDF" button).

Sections in order:
1. **Header** — "Manager report" eyebrow, team name serif title, **Team status tile** mapping severity →
   {Positive momentum, Stable, Watch team, Needs attention} with matching tile color; meta with month +
   confidence.
2. **Executive summary** paragraph (generated).
3. **Snapshot row** — left: 2×2 KPI grid (Average mood, Positive sentiment, Participation (unique
   respondents + trend), Confidence); right: **Mood breakdown** card = pie chart (§9.4) of this team's
   month distribution.
4. **Compare row** — left: "Your team versus company average" card with two 3-stat lines (team value,
   company value, gap) for average mood and positive sentiment, each with a one-line muted read; right:
   "Your team's 6-month mood trend" = mini line chart (§9.3) with dashed company-average reference line.
5. **What your team is saying** — aggregated comment themes only (counts + "What this suggests"); no
   individual quotes by design.
6. **Recommended manager action** — grid: primary read, "This week try", supporting bullets; **Training
   videos** list (4 fixed YouTube links); **Suggested tools for this team** — 2–3 tools chosen by a rule
   (severity/mood/participation) from a fixed catalog of 5 {name, url, whenToUse}.
7. **About this report** — inclusion/exclusion and privacy explanation. Sample-size guard: teams under the
   privacy threshold (5 responses) get reduced detail plus a low-sample warning.
Team-not-found state: header + card "We could not find a team matching this URL." with back link.

---

## 9. Chart catalog (all inline SVG, no chart library)

### 9.1 Weekly engagement line chart
- viewBox 1100×300 (padL 58, padR 20, padT 14, padB 42); renders width:100%, aspect preserved.
- X: weeks (categorical, evenly spaced; single point centers). Labels: week labels; when >8 points label
  every other + always first/last. Small tick marks + solid baseline `#c8ccd3`.
- Y: engagement % fixed 0–100; gridlines at 0/25/50/75/100 in `#eef1f5`, labels `#7a8290` 14px bold.
- Marks: 2.6px line `#0A81FF`; area fill same at 8% opacity; dots r=5 (r=4 when dense) white-stroked;
  value labels above points (`13px, #0A81FF, 800`), every other when dense.
- Data: `[{weekLabel, engagementRate, uniqueRespondents, effectiveRoster, offRosterRespondents}]`.
- Empty state: bordered box "No weekly engagement data available yet for this period."

### 9.2 Monthly mood + participation trend ("Monthly Wide Mood Trends")
- viewBox 720×240 (padL 40, padR 40, padT 24, padB 36). **Dual encodings, one axis** — mood is the line
  with its own dynamic scale; response volume is background bars **without a labeled axis** (bars are
  context, max bar = 55% of inner height). **⚠ AMBIGUOUS:** bars have no scale markings by design.
- X: months; two-line labels (month label + response count beneath).
- Y (line): avgMood; domain = [max(1, floor(min−0.3)), min(5, ceil(max+0.3))], ≥0.5 span; 5 dashed
  gridlines with 1-dp labels.
- Marks: 2.5px `--blue` line over a vertical fade gradient area (22%→0 opacity); white-filled dots r=4.5
  with 2-dp value labels above; bars `--blueSoft` rx 4.
- Legend below: dot "Average Mood", block "Responses".
- Data: `[{label, avgMood, positivePct, responses}]` (positivePct unused by the chart itself).
- Empty state: renders nothing (component returns null) — **⚠ UNFINISHED:** no message shown.

### 9.3 Mini mood trend (manager page)
- viewBox 460×210 (padL 36, padR 18, padT 16, padB 28). X: last ~6 months (or weekly points). Y: mood,
  fixed 1–5. Blue line + dots; optional dashed horizontal company-average line with a small label.
- Data: `[{label, avgMood}]` (+ `companyAvg?: number`). Empty state: "No trend history available yet."

### 9.4 Mood distribution pie
- Pure CSS `conic-gradient` circle (220px; 190px mobile), white center hole shows total responses.
- Slices (fixed order & colors): 1 Terrible `#ef4444`, 2 Bad `#f97316`, 3 Ok `#facc15`, 4 Good `#84cc16`,
  5 Great `#22c55e`. Legend rows: emoji image (`/emojis/{Label}.png`), label, bold pct, small count.
- Data: `[{mood, label, pct, count, color, emoji}]` summing to 100%.

### 9.5 Emotion bars (Emotional wellness)
- HTML/CSS rows (not SVG): emotion name, track with fill width = `count / max(top6 counts) × 100%`
  (10px, rounded, `--blue` on `#edf0f4`), right-aligned `count (pct%)`.

---

## 10. Filters & controls matrix

| Control | Location | Options / default | Effect | Interactions |
|---|---|---|---|---|
| Customer | top bar | all customers; default first in file | full page re-render | resets nothing else explicitly, but month falls back to that customer's latest if invalid; team/employee params usually become invalid → treated as unscoped |
| Month | top bar | that customer's months; default latest | full page re-render | keeps range/audience; keeps team scope (drill data recomputes for new month) |
| Month/Quarter toggle | Engagement header | Month (default) / Quarter | switches weekly-detail window & label (§3.5) | link navigation (full reload); orthogonal to scope |
| Team | Engagement + Mood headers (same state) | "All teams" (default) + trailing-6-mo team list | scopes the two sections (§7) | choosing a team clears employee; soft navigation, scroll preserved |
| Employee | appears only when team set | "All employees" (default) + team roster | employee panel + scoped charts | cleared on team change |
| Incomplete check-ins button | completion card (web) | — | opens modal (§7.3) | none |
| Download brief/full PDF | top bar | — | new tab `/print` with `autoprint=1` | carries customer/month/range only — **never** team/employee/audience |
| autoprint / debugPrint / scope / audience | `/print` URL only | `full`, `executive` defaults | see §11 | — |

No free-text search, no sorting controls, no persisted client state (no localStorage/cookies).

---

## 11. Print / PDF system

- `/print` renders the same report tree with print styling: **US Letter landscape**, zero CSS page margin;
  margins are simulated by a wrapping `<table class="print-frame">` whose repeating `thead`/`tfoot` rows
  (0.5in tall; 0.12–0.3in in brief) create top/bottom whitespace on every page — a deliberate trick
  because Chrome's print-dialog "Margins" setting overrides CSS `@page` margins.
- `scope=full`: whole report (~19 pages, side-by-side column layout preserved to match the web).
  `scope=brief`: a **one-page snapshot** — hides comment intelligence, emotional wellness, follow-up,
  completion/opted-out cards, and all appendix blocks; recomposes Mood Trends + Leadership Priorities side
  by side; adds a bottom strip "Also this month: X follow-up requests · Y employees with incomplete
  check-ins · Z opted out · N comments analyzed · Top emotions: …" + "See the full report for …" pointer
  (this strip exists in the DOM always but is display:none outside the print brief); drops the priority
  table's Reason column and the mailto pill links; ~5pt body type with a ~0.91 uniform scale.
  **⚠ FRAGILE:** the one-page fit is tuned by hand; small content growth can spill to page 2.
- Pagination rules (full scope): section headings never strand at page bottom; cards don't split except
  long list/table cards which may break between rows with repeated table headers; tables never split
  mid-row.
- Readiness contract for automation: root carries `data-pdf-ready="true"` (and a JS global) so a headless
  browser knows when to print; `autoprint=1` triggers `window.print()` after fonts load.
- Tooling (dev-side, optional to port): a headless-Chromium script exports
  `exports/<customer>-<month>-<scope>.pdf`, plus a validator script.
- Audience: `audience=hr-restricted` adds named retention cards to the full PDF. **⚠ SECURITY:** the UI
  button for it was removed but the URL works with no auth (see §13).

---

## 12. Visual design system

### 12.1 Color tokens
| Token | Hex | Use |
|---|---|---|
| `--cream` | `#FAFAFA` | page background |
| `--card` | `#FFFFFF` | card surfaces |
| `--ink` | `#212121` | primary text |
| `--muted` | `#5C636E` | secondary text, axis labels |
| `--line` | `#E8EAEE` | hairline borders, gridlines |
| `--blue` | `#0A81FF` | brand/primary, charts, links |
| `--blueSoft` | `#E0EEFF` | blue tint fills, chart bars |
| `--green` / `--greenSoft` | `#3FA86A` / `#DCF1E5` | positive deltas/tones |
| `--amber` / `--amberSoft` | `#F59F0A` / `#FCE9C7` | caution |
| `--coral` / `--coralSoft` | `#E58180` / `#FDE6E5` | negative |
| mood 1–5 | `#ef4444 #f97316 #facc15 #84cc16 #22c55e` | pie + mood chips |
| priority pills | High `#fee2e2`/`#991b1b`, Medium `#ffedd5`/`#9a3412`, Low `#e5e7eb`/`#374151` (bg/text) | tables |
| chart grays | grid `#eef1f5`, baseline `#c8ccd3`, tick `#9aa1ac`, chart label `#7a8290` | SVG charts |
| success text | `#18683b` · warn text `#9a5b00` · danger text `#9f3f3e` · info text `#075cae` | badges |

### 12.2 Typography
- Body/UI: `Inter, system-ui, sans-serif` (Inter loaded as webfont). Weights lean heavy: labels 700–900.
- Display serif: `Georgia, serif` for the customer title (`clamp(42px,7vw,82px)`, letter-spacing −0.06em,
  line-height 0.9) and big section titles (~25px, −0.04em).
- Micro-labels ("h3-micro"): 11px, uppercase, letter-spacing 0.08–0.09em, weight 900, muted or blue.
- Card sub-titles ("h2-sub"): 17px/800. Table headers: 11px uppercase muted. Body tables: 14px.
- KPI values: 34px (28px in dense grids), letter-spacing −0.04em.

### 12.3 Layout & spacing
- Content column: `min(1240px, 100% − 32px)`, centered. Vertical page padding 30/60px.
- Sections stack with 22px gaps; grids gap 12–16px.
- Card: radius 24px (KPI 18px, small tiles 12–16px, pills 999px), border 1px `--line`, shadow
  `0 1px 2px rgba(33,33,33,.04), 0 8px 24px rgba(33,33,33,.04)`, padding 22px (dense 12–16px).
- Signature column splits — KPI row `repeat(4,1fr)`; engagement grid `1fr:3fr`; completion `3fr:1fr`;
  risks `1fr:1fr`; mood trends `2fr:1fr`; leadership `3fr:2fr`; manager action grid `1fr:1fr`.
- KPI cards carry a 3px left accent strip colored by tone; assessment/alert cards use a thicker (4–8px)
  left border.
- Single breakpoint: **≤900px** collapses every multi-column grid to one column; top bar stacks; weekly
  tables get horizontal scroll containers.
- Buttons: white, 1px `--line`, radius 14px, padding 10–12px, weight 800; primary = solid `--blue`.
  Pill links (mailto/tools): 999px radius, blue text, blue-tint hover.

---

## 13. Empty / loading / error states — and the honest list of unfinished corners

### States that exist
- Chart empties: §9.1 message; §9.3 message; §9.2 renders nothing (no message — unfinished).
- "Every employee completed all check-ins this period." / "No opted-out employees on record." /
  "No material leadership action is recommended this period." / "No check-ins recorded in the trailing
  3 months." / manager "Team not found" screen / "No prior comparison" delta chips.
- Loading: **none designed.** Server-rendered; drill navigation shows only dimmed dropdowns. A Rails port
  with Turbo should add progress affordances.
- Errors: **none designed.** No error boundaries, no 404s (bad params silently fall back, §2), no
  data-validation surface. Malformed dates are skipped silently in most paths.

### ⚠ Known defects / ambiguities / half-built corners (flag-level honesty)
1. **Follow-up responsiveness section is a hard-coded placeholder** (§6.8) despite real follow-up fields
   existing in the data.
2. **Risk-watchlist vs teams-needing-attention inconsistency**: the appendix watchlist and "what changed"
   derive from a legacy risk list and can contradict the KPI card's newer engine on the same page.
3. **Retention-risk driver text** can assert stress/burnout for employees with uniformly high moods.
4. A "review neutral responses" recommendation can appear when the neutral count is 0.
5. **No authentication anywhere**: `audience=hr-restricted` (named at-risk employees) and the employee
   drill-down (individual comments) are reachable by URL by anyone with the link. The HR *button* was
   removed; the route was not. A Rails rebuild should gate these properly.
6. **Health score double-taxonomy** (§5) — unify.
7. **Team engagement denominators are proxies** (trailing-6-month responders), not real team rosters; the
   vendor roster CSV has no team column. If team fields ever land on rosters, replace the proxy.
8. Prior-month deltas compare across data gaps without labeling (§3.5).
9. The **brief PDF's one-page fit is hand-tuned** and type runs ~5pt; treat as a constraint, not a style
   to admire. The trade offered to stakeholders was: bigger type = drop a section.
10. Mood trend chart bars are unscaled context (§9.2) — a reviewer may call this a dual-axis smell.
11. `followUpStatus` strings from the vendor are unparsed free text; completion % logic is heuristic.
12. The demo customer (`acme-corporation`) contains synthetic uplifted engagement (+70%) and anonymized
    names; exclude from any cross-customer analytics.
13. Manager pages are unlinked from the dashboard (§2) and their team slugs don't carry customer context
    by default.
14. Comment-intelligence heuristics are English-keyword based; non-English comments largely fall through.
15. The scope dropdown lists teams from a trailing 6-month window — a team idle for 7 months disappears
    from the filter even though its history remains in the data.

---

## 14. Ingestion conventions (context for the data pipeline, not the app)

Monthly vendor exports arrive as XLSX (`#, First Name, Last Name, Team, Date, Mood, Emotions, Follow Up
Requested, Follow Up Status, Comments`) and roster CSVs (`ID, First Name, Last Name, Email, Phone`).
Rules a Rails importer must keep: dedupe responses on (first, last, timestamp, mood, emotions, comments);
group by calendar month; regenerate sequential ids; **replace** a month wholesale when re-imported (except
the Zipdev dual-account merge, which replaces each sub-account's half independently, identified by the
forced `"Internal Team"` tag); roster uploads create a new dated roster version (§3.4) rather than
overwriting history; all-time exports are authoritative for the months they contain.
