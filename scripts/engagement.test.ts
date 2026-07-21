/**
 * Automated tests for the monthly-engagement methodology
 * (weekly-average, one count per employee per week).
 * Run: npm run test:engagement
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  computeMonthlyEngagement,
  computeWeeklyRates,
  monthRange,
  weeksOverlappingRange,
  MONTHLY_ENGAGEMENT_NOTE,
} from '../src/lib/engagementCalc'

const rec = (first: string, last: string, date: string) => ({ firstName: first, lastName: last, date })
const keys = (...names: Array<[string, string]>) =>
  new Set(names.map(([f, l]) => `${f.toLowerCase()}|${l.toLowerCase()}`))

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

// Roster of 4: Ann, Bob, Cat, Dan. June 2026 (Mon Jun 1 .. Tue Jun 30 → 5 overlapping weeks).
const ROSTER = keys(['Ann', 'A'], ['Bob', 'B'], ['Cat', 'C'], ['Dan', 'D'])

test('1. multiple check-ins in one week count once', () => {
  const { weeks } = computeMonthlyEngagement({
    records: [
      rec('Ann', 'A', 'Jun 2, 2026 9:00 AM'),
      rec('Ann', 'A', 'Jun 3, 2026 9:00 AM'),
      rec('Ann', 'A', 'Jun 5, 2026 9:00 AM'),
    ],
    monthKey: '2026-06',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  assert.equal(weeks[0].uniqueRespondents, 1)
  assert.equal(weeks[0].engagementRate, 25) // 1 of 4
})

test('2. check-ins across weeks count once per week', () => {
  const { weeks } = computeMonthlyEngagement({
    records: [
      rec('Ann', 'A', 'Jun 2, 2026 9:00 AM'),
      rec('Ann', 'A', 'Jun 9, 2026 9:00 AM'),
      rec('Ann', 'A', 'Jun 10, 2026 9:00 AM'),
    ],
    monthKey: '2026-06',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  assert.equal(weeks[0].uniqueRespondents, 1)
  assert.equal(weeks[1].uniqueRespondents, 1)
  assert.equal(weeks[2].uniqueRespondents, 0)
})

test('3. one check-in affects only its own week', () => {
  const { weeks } = computeMonthlyEngagement({
    records: [rec('Bob', 'B', 'Jun 16, 2026 9:00 AM')],
    monthKey: '2026-06',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  const rates = weeks.map((w) => w.engagementRate)
  assert.deepEqual(rates.filter((r) => r > 0).length, 1)
  assert.equal(weeks[2].engagementRate, 25)
})

test('4. monthly = arithmetic average of weekly rates', () => {
  // Ann every week (4 full weeks), all four in week 1 → weeks: 100,25,25,25,0(partial)
  const records = [
    rec('Ann', 'A', 'Jun 2, 2026 9:00 AM'),
    rec('Bob', 'B', 'Jun 2, 2026 9:00 AM'),
    rec('Cat', 'C', 'Jun 3, 2026 9:00 AM'),
    rec('Dan', 'D', 'Jun 4, 2026 9:00 AM'),
    rec('Ann', 'A', 'Jun 9, 2026 9:00 AM'),
    rec('Ann', 'A', 'Jun 16, 2026 9:00 AM'),
    rec('Ann', 'A', 'Jun 23, 2026 9:00 AM'),
  ]
  const { weeks, monthlyRate } = computeMonthlyEngagement({
    records,
    monthKey: '2026-06',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  const expected = Math.round((weeks.reduce((s, w) => s + w.engagementRate, 0) / weeks.length) * 10) / 10
  assert.equal(monthlyRate, expected)
  assert.deepEqual(weeks.map((w) => w.engagementRate), [100, 25, 25, 25, 0])
  assert.equal(monthlyRate, 35) // (100+25+25+25+0)/5
})

test('5. partial weeks at month start/end are included with in-month check-ins only', () => {
  // May 2026: May 1 is a Friday → week of Mon Apr 27 overlaps.
  const { weeks } = computeMonthlyEngagement({
    records: [
      rec('Ann', 'A', 'May 1, 2026 9:00 AM'), // falls in partial leading week
      rec('Bob', 'B', 'Apr 30, 2026 9:00 AM'), // outside May — must be ignored
    ],
    monthKey: '2026-05',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  assert.equal(weeks[0].weekStart, '2026-04-27')
  assert.equal(weeks[0].uniqueRespondents, 1) // Ann only; Bob's Apr 30 excluded
})

test('6. months spanning five calendar weeks handled', () => {
  const { weeks } = computeMonthlyEngagement({
    records: [],
    monthKey: '2026-06',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  assert.equal(weeks.length, 5) // Jun 1, 8, 15, 22, 29
  assert.equal(weeks[4].weekStart, '2026-06-29')
})

test('7. employees with no check-ins stay in the denominator', () => {
  const { weeks } = computeMonthlyEngagement({
    records: [rec('Ann', 'A', 'Jun 2, 2026 9:00 AM')],
    monthKey: '2026-06',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  assert.equal(weeks[0].effectiveRoster, 4)
  assert.equal(weeks[0].engagementRate, 25)
})

test('8. off-roster responders count in numerator AND denominator', () => {
  const { weeks } = computeMonthlyEngagement({
    records: [rec('Zed', 'Z', 'Jun 2, 2026 9:00 AM')], // not on roster
    monthKey: '2026-06',
    rosterKeys: ROSTER,
    rosterCount: 4,
  })
  assert.equal(weeks[0].uniqueRespondents, 1)
  assert.equal(weeks[0].offRosterRespondents, 1)
  assert.equal(weeks[0].effectiveRoster, 5) // 4 roster + 1 off-roster
  assert.equal(weeks[0].engagementRate, 20)
})

test('9. data layer uses the revised calculation everywhere (incl. prior-month comparisons)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(path.join(here, '../src/lib/reportMetrics.ts'), 'utf8')
  assert.ok(src.includes("from './engagementCalc'"), 'reportMetrics imports the shared calc')
  assert.ok(!src.includes('pct(uniqueParticipants, monthlyEffectiveRoster)'), 'old monthly formula removed')
  // Prior-month comparison uses computeMonthlyEngagement on prevRecords
  assert.ok(/previousEngagementRate = previous\s*\?\s*computeMonthlyEngagement/.test(src), 'prior month uses revised calc')
})

test('10. explanatory note is displayed wherever monthly engagement appears', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const body = readFileSync(path.join(here, '../src/app/_components/ReportBody.tsx'), 'utf8')
  assert.ok(body.includes('MONTHLY_ENGAGEMENT_NOTE'), 'ReportBody renders the note (KPI help + weekly detail)')
  assert.equal((body.match(/MONTHLY_ENGAGEMENT_NOTE/g) ?? []).length >= 2, true, 'note used in at least two display spots')
  assert.ok(MONTHLY_ENGAGEMENT_NOTE.startsWith('Monthly engagement is the average of the weekly engagement rates'))
})

test('week enumeration is Monday-start and covers the whole range', () => {
  const { start, end } = monthRange('2026-06')
  const weeks = weeksOverlappingRange(start, end)
  assert.equal(weeks[0].getDay(), 1)
  assert.equal(weeks.length, 5)
})

test('no-roster fallback denominator', () => {
  const weeks = computeWeeklyRates({
    records: [rec('Ann', 'A', 'Jun 2, 2026 9:00 AM')],
    rangeStart: monthRange('2026-06').start,
    rangeEnd: monthRange('2026-06').end,
    rosterKeys: new Set(),
    rosterCount: 0,
    fallbackDenominator: 10,
  })
  assert.equal(weeks[0].engagementRate, 10)
})

console.log(`\n${passed} tests passed`)
