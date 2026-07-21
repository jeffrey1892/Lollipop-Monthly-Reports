/**
 * engagementCalc — the single source of truth for weekly and monthly
 * engagement math, shared by the report data layer (and therefore the web
 * view, print route, and PDF exports, which all consume the same payload).
 *
 * Methodology (per reporting spec, Jul 2026):
 * - Weekly engagement = unique employees with >=1 check-in that week ÷
 *   eligible employees for that week. An employee counts at most once per
 *   week regardless of how many check-ins they completed.
 * - Monthly engagement = the arithmetic average of the weekly engagement
 *   rates for every calendar week that overlaps the month (equal weight,
 *   including partial weeks at the start/end of the month — partial weeks
 *   use only the check-ins that fall inside the month).
 * - Off-roster responders (valid check-ins from people not on the uploaded
 *   roster) count as respondents AND are added to that week's denominator,
 *   so they are never excluded and can never push a rate above 100%.
 *
 * Weeks start on Monday, matching the rest of the reporting system.
 */

export type CalcRecord = { firstName: string; lastName: string; date: string }

export type WeekRate = {
  /** ISO date (YYYY-MM-DD) of the week's Monday. */
  weekStart: string
  /** e.g. "Jun 1" — Monday's month + day. */
  weekLabel: string
  uniqueRespondents: number
  offRosterRespondents: number
  effectiveRoster: number
  engagementRate: number
}

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function personKey(firstName: string, lastName: string): string {
  return `${(firstName || '').trim().toLowerCase()}|${(lastName || '').trim().toLowerCase()}`
}

export function parseRecordDate(s: string): Date | null {
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Monday (00:00 local) of the week containing d. */
export function mondayOf(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return m
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/**
 * Mondays of every calendar week overlapping the inclusive date range.
 */
export function weeksOverlappingRange(start: Date, end: Date): Date[] {
  const out: Date[] = []
  const cur = mondayOf(start)
  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

/** First/last day of a YYYY-MM month key. */
export function monthRange(monthKey: string): { start: Date; end: Date } {
  const y = parseInt(monthKey.slice(0, 4), 10)
  const m = parseInt(monthKey.slice(5, 7), 10)
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) }
}

export function computeWeeklyRates(opts: {
  /** Records already scoped to the reporting window (e.g. one month). */
  records: CalcRecord[]
  /** Inclusive range whose overlapping calendar weeks are enumerated. */
  rangeStart: Date
  rangeEnd: Date
  /** Lowercased "first|last" keys of the uploaded roster. Empty = no roster. */
  rosterKeys: Set<string>
  rosterCount: number
  /** Denominator fallback when no roster exists (e.g. legacy customers). */
  fallbackDenominator?: number | null
}): WeekRate[] {
  const { records, rangeStart, rangeEnd, rosterKeys, rosterCount, fallbackDenominator } = opts
  const hasRoster = rosterKeys.size > 0

  const byWeek = new Map<string, Set<string>>()
  for (const r of records) {
    const d = parseRecordDate(r.date)
    if (!d) continue
    if (d.getTime() < rangeStart.getTime() || d.getTime() > rangeEnd.getTime()) continue
    const wk = isoDate(mondayOf(d))
    const set = byWeek.get(wk) ?? new Set<string>()
    set.add(personKey(r.firstName, r.lastName))
    byWeek.set(wk, set)
  }

  return weeksOverlappingRange(rangeStart, rangeEnd).map((monday) => {
    const wk = isoDate(monday)
    const persons = byWeek.get(wk) ?? new Set<string>()
    const uniques = persons.size
    const off = hasRoster ? [...persons].filter((k) => !rosterKeys.has(k)).length : 0
    const denom = hasRoster
      ? rosterCount + off
      : (fallbackDenominator ?? rosterCount) || uniques
    const rate = denom > 0 ? Math.round((uniques / denom) * 1000) / 10 : 0
    return {
      weekStart: wk,
      weekLabel: `${MONTH_ABBREV[monday.getMonth()]} ${monday.getDate()}`,
      uniqueRespondents: uniques,
      offRosterRespondents: off,
      effectiveRoster: denom,
      engagementRate: rate,
    }
  })
}

/**
 * Monthly engagement = equal-weight arithmetic average of the weekly rates
 * for every calendar week overlapping the month. Returns the weekly series
 * alongside the average so tables and headline figures always agree.
 */
export function computeMonthlyEngagement(opts: {
  records: CalcRecord[]
  monthKey: string
  rosterKeys: Set<string>
  rosterCount: number
  fallbackDenominator?: number | null
}): { weeks: WeekRate[]; monthlyRate: number } {
  const { start, end } = monthRange(opts.monthKey)
  const weeks = computeWeeklyRates({
    records: opts.records,
    rangeStart: start,
    rangeEnd: end,
    rosterKeys: opts.rosterKeys,
    rosterCount: opts.rosterCount,
    fallbackDenominator: opts.fallbackDenominator,
  })
  const monthlyRate = weeks.length
    ? Math.round((weeks.reduce((s, w) => s + w.engagementRate, 0) / weeks.length) * 10) / 10
    : 0
  return { weeks, monthlyRate }
}

/** The mandated explanatory note wherever monthly engagement is displayed. */
export const MONTHLY_ENGAGEMENT_NOTE =
  'Monthly engagement is the average of the weekly engagement rates during the selected month. ' +
  'Each weekly rate represents the percentage of eligible employees who completed at least one ' +
  'check-in during that week. Employees are counted only once per week, regardless of the number ' +
  'of check-ins completed.'

/** Short tooltip variant. */
export const MONTHLY_ENGAGEMENT_NOTE_SHORT =
  'Monthly engagement is the average of the month’s weekly engagement rates. Each employee is counted once per week.'
