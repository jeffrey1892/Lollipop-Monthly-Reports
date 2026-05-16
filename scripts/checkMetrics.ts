import { customers, getReport } from '../src/lib/reportMetrics'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []
function expect(name: string, pass: boolean, detail?: string) { checks.push({ name, pass, detail }) }

for (const customer of customers) {
  const months = customer.months
  if (!months.length) {
    expect(`${customer.id} has at least one month`, false)
    continue
  }
  const latest = months[months.length - 1]
  const report = getReport(customer.id, latest.month)
  expect(`${customer.id}: report has matching customer name`, report.customerName === customer.name, `got "${report.customerName}"`)
  expect(`${customer.id}: avgMood within 1-5 range`, report.avgMood >= 1 && report.avgMood <= 5, `avgMood=${report.avgMood}`)
  expect(`${customer.id}: positivePct within 0-100`, report.positivePct >= 0 && report.positivePct <= 100, `positivePct=${report.positivePct}`)
  expect(`${customer.id}: healthScore within 0-100`, report.healthScore >= 0 && report.healthScore <= 100, `healthScore=${report.healthScore}`)
  expect(`${customer.id}: mood distribution sums to ~100% (or empty)`, (() => {
    const sum = report.moodDistribution.reduce((a, b) => a + b.pct, 0)
    const total = report.moodDistribution.reduce((a, b) => a + b.count, 0)
    return total === 0 ? sum === 0 : Math.abs(sum - 100) < 1.5
  })(), `sum=${report.moodDistribution.reduce((a, b) => a + b.pct, 0)}`)
  expect(`${customer.id}: monthlyTrend matches months length`, report.monthlyTrend.length === customer.months.length)
  expect(`${customer.id}: teamIntelligence count == allTeams count`, report.teamIntelligence.length === report.allTeams.length)
  if (months.length >= 2) {
    expect(`${customer.id}: avgMoodChange is numeric when prior month exists`, report.avgMoodChange !== null && Number.isFinite(report.avgMoodChange))
    expect(`${customer.id}: priorComparison.hasPriorData is true when prior month exists`,
      report.commentIntelligence.priorComparison.hasPriorData === true)
  }
  expect(`${customer.id}: recommendations are non-empty`, report.recommendations.length > 0)
  expect(`${customer.id}: top KPIs include Engagement responseRate or null`,
    report.engagement.responseRate === null || (report.engagement.responseRate >= 0 && report.engagement.responseRate <= 100))
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  const tag = c.pass ? '✓' : '✗'
  console.log(`${tag} ${c.name}${c.detail ? ` (${c.detail})` : ''}`)
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) process.exit(1)
