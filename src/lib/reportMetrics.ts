import data from '@/data/demoData.json'
import type { CustomerData, MonthData, ReportMetrics, ResponseRecord, RetentionRisk, Severity, TeamMetric } from './types'

export const customers = data.customers as CustomerData[]

function avg(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 }
function round(value: number, digits = 1) { const m = 10 ** digits; return Math.round(value * m) / m }
function pct(part: number, total: number) { return total ? Math.round((part / total) * 1000) / 10 : 0 }
function riskFromMood(avgMood: number, positivePct: number, change: number | null): RetentionRisk {
  if (avgMood < 3 || positivePct < 45 || (change !== null && change <= -0.5)) return 'High'
  if (avgMood < 3.3 || positivePct < 55 || (change !== null && change <= -0.3)) return 'Elevated'
  if (avgMood < 3.8 || positivePct < 65 || (change !== null && change <= -0.15)) return 'Watch'
  return 'Low'
}
function severity(score: number): Severity {
  if (score >= 82) return 'Healthy'
  if (score >= 70) return 'Stable'
  if (score >= 58) return 'Watch'
  if (score >= 45) return 'Intervention Needed'
  return 'Elevated Risk'
}
function riskRank(risk: RetentionRisk) { return ({ Low: 1, Watch: 2, Elevated: 3, High: 4, Critical: 5 })[risk] }

function byTeam(records: ResponseRecord[]) {
  const map = new Map<string, ResponseRecord[]>()
  for (const r of records) map.set(r.team, [...(map.get(r.team) ?? []), r])
  return map
}

export function getReport(customerId = 'cosmo-cabinets', month?: string): ReportMetrics {
  const customer = customers.find((c) => c.id === customerId) ?? customers[0]
  const selected = month ? customer.months.find((m) => m.month === month) : customer.months[customer.months.length - 1]
  const current = selected ?? customer.months[customer.months.length - 1]
  const currentIndex = customer.months.findIndex((m) => m.month === current.month)
  const previous: MonthData | undefined = currentIndex > 0 ? customer.months[currentIndex - 1] : undefined
  const records = current.responses
  const prevRecords = previous?.responses ?? []
  const moods = records.map((r) => r.mood).filter(Boolean)
  const prevMoods = prevRecords.map((r) => r.mood).filter(Boolean)
  const avgMood = round(avg(moods), 2)
  const prevAvgMood = prevMoods.length ? round(avg(prevMoods), 2) : 0
  const positivePct = pct(moods.filter((m) => m >= 4).length, moods.length)
  const prevPositivePct = prevMoods.length ? pct(prevMoods.filter((m) => m >= 4).length, prevMoods.length) : 0
  const negativeCount = moods.filter((m) => m <= 2).length
  const followUpRequests = records.filter((r) => r.followUpRequested).length
  const completedFollowUps = records.filter((r) => r.followUpRequested && /complete|closed|done/i.test(r.followUpStatus)).length
  const followUpCompletionPct = followUpRequests ? pct(completedFollowUps, followUpRequests) : null
  const engagementScore = Math.min(100, Math.round((records.length / Math.max(...customer.months.map((m) => m.responses.length))) * 55 + Math.min(45, Object.keys(Object.fromEntries(byTeam(records))).length * 4)))
  const sentimentScore = Math.round(((avgMood / 5) * 70) + (positivePct * 0.3))
  const riskPenalty = negativeCount > records.length * 0.1 ? 8 : negativeCount > 0 ? 3 : 0
  const healthScore = Math.max(0, Math.min(100, Math.round(sentimentScore * 0.55 + engagementScore * 0.25 + (followUpCompletionPct ?? 75) * 0.1 + 80 * 0.1 - riskPenalty)))
  const monthChange = previous ? round(avgMood - prevAvgMood, 2) : null
  const positiveChange = previous ? round(positivePct - prevPositivePct, 1) : null
  const prevTeamMap = previous ? byTeam(previous.responses) : new Map<string, ResponseRecord[]>()
  const allTeams: TeamMetric[] = [...byTeam(records).entries()].map(([team, teamRecords]) => {
    const teamMoods = teamRecords.map((r) => r.mood).filter(Boolean)
    const previousTeamMoods = (prevTeamMap.get(team) ?? []).map((r) => r.mood).filter(Boolean)
    const tAvg = round(avg(teamMoods), 2)
    const tPositive = pct(teamMoods.filter((m) => m >= 4).length, teamMoods.length)
    const change = previousTeamMoods.length ? round(tAvg - avg(previousTeamMoods), 2) : null
    return { team, responses: teamRecords.length, avgMood: tAvg, positivePct: tPositive, change, engagementShare: pct(teamRecords.length, records.length), risk: riskFromMood(tAvg, tPositive, change), sampleWarning: teamRecords.length < 5 }
  }).sort((a, b) => b.responses - a.responses)
  const topTeams = [...allTeams].filter((t) => !t.sampleWarning).sort((a, b) => b.avgMood - a.avgMood || b.responses - a.responses).slice(0, 3)
  const watchTeams = [...allTeams].sort((a, b) => riskRank(b.risk) - riskRank(a.risk) || a.avgMood - b.avgMood).slice(0, 4)
  const emotionCounts = new Map<string, number>()
  for (const r of records) for (const e of r.emotions) emotionCounts.set(e, (emotionCounts.get(e) ?? 0) + 1)
  const emotionTotal = [...emotionCounts.values()].reduce((a, b) => a + b, 0)
  const topEmotions = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emotion, count]) => ({ emotion, count, pct: pct(count, emotionTotal) }))
  const moodDistribution = [1, 2, 3, 4, 5].map((m) => ({ mood: String(m), count: moods.filter((v) => v === m).length, pct: pct(moods.filter((v) => v === m).length, moods.length) }))
  const retentionRisk = riskFromMood(avgMood, positivePct, monthChange)
  const softened = monthChange !== null && monthChange < 0
  const executiveSummary = softened
    ? `${customer.name} remained broadly stable, but ${current.label} softened versus ${previous?.label} across mood and positive sentiment. Leadership attention should focus on team-level variance and participation consistency.`
    : `${customer.name} shows stable workforce health in ${current.label}, with sentiment holding above neutral and participation sufficient for directional insight. Leadership should reinforce teams with positive momentum while monitoring watch teams.`
  const leadershipAttention = [
    softened ? `Sentiment softened ${Math.abs(monthChange ?? 0).toFixed(2)} points month over month.` : 'Sentiment remains stable to improving month over month.',
    watchTeams.length ? `Watch signals are concentrated in ${watchTeams.slice(0, 2).map((t) => t.team).join(' and ')}.` : 'No material team-level risk concentration detected.',
    followUpRequests === 0 ? 'Follow-up request data shows no recorded requests; responsiveness scoring should remain provisional.' : `${followUpRequests} follow-up requests require responsiveness review.`,
  ]
  const improvements = [
    'Add active employee and opted-in population counts to improve engagement scoring accuracy.',
    'Normalize team naming across months to improve team trend reliability.',
    'Track follow-up completion status consistently so Leadership Responsiveness can be scored with confidence.',
  ]
  const recommendations = [
    { title: 'Reinforce participation cadence', urgency: 'Medium', impact: 'High', difficulty: 'Low', reason: 'Participation volume varies materially by month.', action: 'Use a reminder campaign before the next check-in window and monitor response breadth by team.' },
    { title: 'Review watch-team variance', urgency: retentionRisk === 'Elevated' || retentionRisk === 'High' ? 'High' : 'Medium', impact: 'High', difficulty: 'Medium', reason: 'Lower-scoring teams are creating most of the organizational variance.', action: 'Ask managers of watch teams to review workload, communication, and recognition patterns.' },
    { title: 'Improve follow-up data capture', urgency: 'Medium', impact: 'Medium', difficulty: 'Low', reason: 'Leadership responsiveness cannot be fully measured without reliable request and closure data.', action: 'Standardize follow-up status values and require closure confirmation.' },
  ]
  return { customerName: customer.name, month: current.month, label: current.label, previousLabel: previous?.label, responseCount: records.length, avgMood, avgMoodChange: monthChange, positivePct, positiveChange, negativeCount, engagementScore, healthScore, healthSeverity: severity(healthScore), retentionRisk, followUpRequests, followUpCompletionPct, unsubscribedCount: customer.unsubscribed.length, topTeams, watchTeams, allTeams, moodDistribution, topEmotions, monthlyTrend: customer.months.map((m) => { const ms = m.responses.map((r) => r.mood).filter(Boolean); return { label: m.label, avgMood: round(avg(ms), 2), positivePct: pct(ms.filter((v) => v >= 4).length, ms.length), responses: m.responses.length } }), comments: records.map((r) => r.comments).filter(Boolean).slice(0, 8), executiveSummary, leadershipAttention, improvements, recommendations }
}
