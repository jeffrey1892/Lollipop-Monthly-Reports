import data from '@/data/demoData.json'
import type { Confidence, CustomerData, MonthData, ReportMetrics, ResponseRecord, RetentionRisk, Severity, TeamMetric } from './types'

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
function confidenceFromCount(count: number): Confidence {
  if (count >= 30) return 'High'
  if (count >= 10) return 'Medium'
  if (count >= 5) return 'Low'
  return 'Provisional'
}
function confidenceScore(records: number, teams: TeamMetric[], commentCount: number, hasFollowUpData: boolean) {
  const volume = Math.min(40, records * 0.28)
  const teamCoverage = teams.length ? teams.filter((t) => !t.sampleWarning).length / teams.length : 0
  const coverage = teamCoverage * 25
  const comments = Math.min(20, commentCount * 1.2)
  const followup = hasFollowUpData ? 15 : 5
  return Math.round(volume + coverage + comments + followup)
}
function confidenceLabel(score: number): Confidence {
  if (score >= 78) return 'High'
  if (score >= 62) return 'Medium'
  if (score >= 45) return 'Low'
  return 'Provisional'
}
function byTeam(records: ResponseRecord[]) {
  const map = new Map<string, ResponseRecord[]>()
  for (const r of records) map.set(r.team, [...(map.get(r.team) ?? []), r])
  return map
}
function contains(text: string, words: string[]) { return words.some((w) => text.includes(w)) }
function anonymize(comment: string) {
  return comment.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, 'a team member').replace(/Jody Pagan/gi, 'a leader').trim()
}
function buildCommentIntelligence(records: ResponseRecord[]) {
  const commentRecords = records.filter((r) => r.comments.trim())
  const comments = commentRecords.map((r) => r.comments)
  const lower = comments.map((c) => c.toLowerCase())
  const countWhere = (words: string[]) => lower.filter((c) => contains(c, words)).length
  const stress = countWhere(['stressed', 'stress', 'overwhelmed', 'exhausted', 'tired', 'unable to keep up', 'behind', 'late night', 'bad day'])
  const recognition = countWhere(['appreciate', 'appreciated', 'grateful', 'backing', 'support', 'helping', 'great people'])
  const leadership = countWhere(['manager', 'supervisor', 'power', 'talks to others', 'support', 'communication', 'backing'])
  const work = countWhere(['deal', 'work', 'task', 'position', 'plant', 'clock', 'bonus', 'manager', 'supervisor', 'areas'])
  const wellbeing = countWhere(['stressed', 'insurance', 'asthma', 'mentally', 'physically', 'tired', 'bad day'])
  const positive = commentRecords.filter((r) => r.mood >= 4 || r.emotions.some((e) => ['Grateful', 'Happy', 'Optimistic', 'Motivated', 'Appreciated', 'Excited'].includes(e))).length
  const themes = [
    { theme: 'Positive momentum and optimism', count: positive, type: 'Positive' as const, signal: 'Employees are naming deals, motivation, gratitude, and optimism as sources of energy.' },
    { theme: 'Workload and burnout pressure', count: stress, type: 'Risk' as const, signal: 'A smaller but important set of comments references stress, exhaustion, falling behind, and long hours.' },
    { theme: 'Recognition and manager backing', count: recognition, type: 'Leadership' as const, signal: 'Recognition and visible leadership support appear to be strong drivers of positive sentiment.' },
    { theme: 'Leadership tone and communication', count: leadership, type: 'Leadership' as const, signal: 'Several comments point to manager behavior, support, and communication as culture-shaping variables.' },
    { theme: 'Operational staffing/friction', count: countWhere(['vacancies', 'positions', 'clock', 'bonus', 'tasks', 'behind']), type: 'Work' as const, signal: 'Operational blockers are showing up in emotional comments and may affect retention risk if unresolved.' },
  ].filter((t) => t.count > 0)
  const representative = commentRecords
    .sort((a, b) => (b.comments.length + (b.mood <= 2 ? 80 : 0)) - (a.comments.length + (a.mood <= 2 ? 80 : 0)))
    .slice(0, 4)
    .map((r) => `“${anonymize(r.comments).slice(0, 210)}${r.comments.length > 210 ? '…' : ''}”`)
  return {
    commentCount: comments.length,
    workRelatedCount: work,
    wellbeingCount: wellbeing,
    positiveCount: positive,
    stressBurnoutCount: stress,
    recognitionCount: recognition,
    leadershipCommunicationCount: leadership,
    themes,
    representativeComments: representative,
    revealing: stress > 0
      ? 'The comment layer shows a mixed workforce signal: broad positive energy remains present, but workload strain and leadership-tone concerns are concentrated enough to warrant targeted manager follow-up.'
      : 'The comment layer is primarily reinforcing the quantitative trend: sentiment is generally positive, with limited explicit burnout language in the selected month.',
    emergingRisks: [
      stress > 0 ? 'Burnout risk may be localized in specific roles or teams rather than systemic across the organization.' : 'Burnout risk is not prominent in comments this month, but should continue to be monitored.',
      leadership > 0 ? 'Leadership communication and manager behavior are recurring culture signals.' : 'Leadership-specific comment volume is limited this month.',
      work > 0 ? 'Operational friction is appearing in open text and may affect morale if not closed quickly.' : 'Operational blockers are not a dominant theme this month.',
    ],
    confidence: confidenceFromCount(comments.length),
  }
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
  const openFollowUps = Math.max(0, followUpRequests - completedFollowUps)
  const followUpCompletionPct = followUpRequests ? pct(completedFollowUps, followUpRequests) : null
  const teamMap = byTeam(records)
  const engagementScore = Math.min(100, Math.round((records.length / Math.max(...customer.months.map((m) => m.responses.length))) * 55 + Math.min(45, teamMap.size * 4)))
  const sentimentScore = Math.round(((avgMood / 5) * 70) + (positivePct * 0.3))
  const riskPenalty = negativeCount > records.length * 0.1 ? 8 : negativeCount > 0 ? 3 : 0
  const healthScore = Math.max(0, Math.min(100, Math.round(sentimentScore * 0.55 + engagementScore * 0.25 + (followUpCompletionPct ?? 75) * 0.1 + 80 * 0.1 - riskPenalty)))
  const monthChange = previous ? round(avgMood - prevAvgMood, 2) : null
  const positiveChange = previous ? round(positivePct - prevPositivePct, 1) : null
  const prevTeamMap = previous ? byTeam(previous.responses) : new Map<string, ResponseRecord[]>()
  const allTeams: TeamMetric[] = [...teamMap.entries()].map(([team, teamRecords]) => {
    const teamMoods = teamRecords.map((r) => r.mood).filter(Boolean)
    const previousTeamMoods = (prevTeamMap.get(team) ?? []).map((r) => r.mood).filter(Boolean)
    const tAvg = round(avg(teamMoods), 2)
    const tPositive = pct(teamMoods.filter((m) => m >= 4).length, teamMoods.length)
    const change = previousTeamMoods.length ? round(tAvg - avg(previousTeamMoods), 2) : null
    const risk = riskFromMood(tAvg, tPositive, change)
    const confidence = confidenceFromCount(teamRecords.length)
    return {
      team,
      responses: teamRecords.length,
      avgMood: tAvg,
      positivePct: tPositive,
      change,
      engagementShare: pct(teamRecords.length, records.length),
      risk,
      sampleWarning: teamRecords.length < 5,
      confidence,
      interpretation: teamRecords.length < 5
        ? 'Directional only; sample is too small to overinterpret.'
        : riskRank(risk) >= 3 ? 'Leadership should review workload, communication, and local operating conditions.' : 'Healthy signal; reinforce what is working and watch for participation consistency.',
    }
  }).sort((a, b) => b.responses - a.responses)
  const topTeams = [...allTeams].filter((t) => !t.sampleWarning).sort((a, b) => b.avgMood - a.avgMood || b.responses - a.responses).slice(0, 3)
  const watchTeams = [...allTeams].sort((a, b) => riskRank(b.risk) - riskRank(a.risk) || a.avgMood - b.avgMood).slice(0, 4)
  const improvingTeams = [...allTeams].filter((t) => (t.change ?? 0) > 0.15 && !t.sampleWarning).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 4)
  const decliningTeams = [...allTeams].filter((t) => (t.change ?? 0) < -0.15 && !t.sampleWarning).sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 4)
  const lowConfidenceTeams = allTeams.filter((t) => t.sampleWarning)
  const emotionCounts = new Map<string, number>()
  for (const r of records) for (const e of r.emotions) emotionCounts.set(e, (emotionCounts.get(e) ?? 0) + 1)
  const emotionTotal = [...emotionCounts.values()].reduce((a, b) => a + b, 0)
  const topEmotions = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emotion, count]) => ({ emotion, count, pct: pct(count, emotionTotal) }))
  const moodColors = ['#ef4444', '#f97316', '#f59e0b', '#3fa86a', '#0a81ff']
  const moodDistribution = [1, 2, 3, 4, 5].map((m, i) => ({ mood: String(m), count: moods.filter((v) => v === m).length, pct: pct(moods.filter((v) => v === m).length, moods.length), color: moodColors[i] }))
  const retentionRisk = riskFromMood(avgMood, positivePct, monthChange)
  const softened = monthChange !== null && monthChange < 0
  const monthlyTrend = customer.months.map((m) => { const ms = m.responses.map((r) => r.mood).filter(Boolean); return { label: m.label, avgMood: round(avg(ms), 2), positivePct: pct(ms.filter((v) => v >= 4).length, ms.length), responses: m.responses.length } })
  const lastThree = monthlyTrend.slice(Math.max(0, currentIndex - 2), currentIndex + 1)
  const threeMonthAvgMood = lastThree.length === 3 ? round(avg(lastThree.map((m) => m.avgMood)), 2) : null
  const rollingPositivePct = lastThree.length === 3 ? round(avg(lastThree.map((m) => m.positivePct)), 1) : null
  const bestMonth = [...monthlyTrend].sort((a, b) => b.avgMood - a.avgMood)[0]
  const worstMonth = [...monthlyTrend].sort((a, b) => a.avgMood - b.avgMood)[0]
  const volatilityValue = round(Math.max(...monthlyTrend.map((m) => m.avgMood)) - Math.min(...monthlyTrend.map((m) => m.avgMood)), 2)
  const commentIntelligence = buildCommentIntelligence(records)
  const reportConfidenceScore = confidenceScore(records.length, allTeams, commentIntelligence.commentCount, followUpRequests > 0)
  const reportConfidence = confidenceLabel(reportConfidenceScore)
  const participationChange = previous ? records.length - prevRecords.length : null
  const strategicNarrative = [
    `${customer.name}'s workforce signal in ${current.label} is ${severity(healthScore).toLowerCase()} with ${retentionRisk.toLowerCase()} retention risk. The organization is not showing a broad crisis signal, but the month softened enough to require targeted leadership attention rather than passive monitoring.`,
    `The most important movement is ${softened ? `a ${Math.abs(monthChange ?? 0).toFixed(2)} point decline in average mood and a ${Math.abs(positiveChange ?? 0).toFixed(1)} point decline in positive sentiment` : 'stable-to-improving sentiment versus the prior month'}. This matters because emotional movement is uneven by team; the risk appears concentrated, not fully systemic.`,
    `Leadership's opportunity is to preserve high-performing team momentum while intervening early where workload, recognition, communication, or staffing friction is showing up in comments and team variance.`,
  ]
  const executiveSummary = strategicNarrative.join(' ')
  const leadershipAttention = [
    softened ? `Sentiment softened ${Math.abs(monthChange ?? 0).toFixed(2)} points month over month; treat this as a directional early-warning signal, not a crisis finding.` : 'Sentiment remains stable to improving month over month; maintain cadence and reinforce positive drivers.',
    watchTeams.length ? `Watch signals are concentrated in ${watchTeams.slice(0, 2).map((t) => t.team).join(' and ')}; this suggests localized risk rather than an organization-wide deterioration.` : 'No material team-level risk concentration detected.',
    commentIntelligence.stressBurnoutCount > 0 ? 'Open comments include stress, exhaustion, or workload language; leadership should identify whether these comments cluster by role/team.' : 'Burnout language is limited in open comments this month.',
    followUpRequests === 0 ? 'Follow-up workflow data is incomplete or unused; responsiveness scoring should remain provisional.' : `${followUpRequests} follow-up requests require responsiveness review.`,
  ]
  const engagement = {
    optedInPopulation: null,
    activeEmployeeCount: null,
    responseRate: null,
    uniqueParticipants: records.length,
    repeatResponderConcentration: 'Cannot determine repeat-responder concentration until stable employee IDs are available across months.',
    silentPopulationRisk: 'Unknown denominator: opted-in and active employee counts are needed to quantify silent population risk.',
    participationChange,
    reliability: records.length >= 100 ? 'Strong directional read at the organization level; team-level confidence varies by response count.' : 'Directional read only; participation should be expanded before making major policy decisions.',
    confidence: records.length >= 100 ? 'Medium' as const : 'Low' as const,
  }
  const trend = {
    threeMonthAvgMood,
    rollingPositivePct,
    bestMonth: `${bestMonth.label} (${bestMonth.avgMood.toFixed(2)})`,
    worstMonth: `${worstMonth.label} (${worstMonth.avgMood.toFixed(2)})`,
    volatility: volatilityValue >= 0.35 ? `Elevated volatility (${volatilityValue.toFixed(2)} mood-point range).` : `Normal fluctuation (${volatilityValue.toFixed(2)} mood-point range).`,
    meaningfulMovement: monthChange === null ? 'No prior month comparison available.' : Math.abs(monthChange) >= 0.2 ? 'Movement is meaningful enough for leadership review.' : 'Movement appears within normal fluctuation; monitor for confirmation next month.',
    improvingMetrics: [monthChange !== null && monthChange > 0 ? 'Average mood improved month over month.' : '', positiveChange !== null && positiveChange > 0 ? 'Positive sentiment improved month over month.' : '', participationChange !== null && participationChange > 0 ? 'Participation increased month over month.' : ''].filter(Boolean),
    decliningMetrics: [monthChange !== null && monthChange < 0 ? 'Average mood declined month over month.' : '', positiveChange !== null && positiveChange < 0 ? 'Positive sentiment declined month over month.' : '', participationChange !== null && participationChange < 0 ? 'Participation declined month over month.' : ''].filter(Boolean),
    confidence: 'Medium' as const,
  }
  const responsiveness = {
    requests: followUpRequests,
    completed: completedFollowUps,
    open: openFollowUps,
    completionPct: followUpCompletionPct,
    avgTimeToResponse: 'Unavailable — response timestamp is not present in the current spreadsheet.',
    agingUnresolved: followUpRequests ? `${openFollowUps} unresolved follow-up item(s) need aging review.` : 'Unavailable — no follow-up requests are recorded for this month.',
    managerTeamResponsiveness: 'Unavailable until follow-up owner, team, created date, and closed date are captured consistently.',
    status: followUpRequests ? 'Directional' : 'Provisional: follow-up workflow appears incomplete or not used in this data set.',
    recommendation: followUpRequests ? 'Audit every open follow-up and require closure notes.' : 'Add required fields for follow-up owner, request date, first response date, status, closure date, and team owner.',
    confidence: followUpRequests ? 'Medium' as const : 'Provisional' as const,
  }
  const intelligencePoints = [
    { title: 'Organizational health', finding: `${severity(healthScore)} health score with ${retentionRisk} retention risk.`, whyItMatters: 'The organization is stable enough for targeted intervention, but team variance can become retention risk if ignored.', leadershipMove: 'Focus on watch teams first while reinforcing positive-team behaviors.', monitorNext: 'Watch whether average mood rebounds and whether negative comments cluster in the same teams.', confidence: reportConfidence },
    { title: 'Culture and burnout signal', finding: `${commentIntelligence.stressBurnoutCount} stress/burnout comment signal(s) and ${commentIntelligence.recognitionCount} recognition signal(s).`, whyItMatters: 'Positive culture signals coexist with operational strain; both are useful levers for retention.', leadershipMove: 'Ask managers to separate workload fixes from recognition/communication fixes.', monitorNext: 'Track workload language, manager behavior comments, and low-mood comments next month.', confidence: commentIntelligence.confidence },
    { title: 'Engagement reliability', finding: `${records.length} responses across ${allTeams.length} teams; denominator unavailable.`, whyItMatters: 'The signal is useful, but response-rate and silent-population risk cannot be quantified without active/opted-in counts.', leadershipMove: 'Add denominator data and compare participation by team.', monitorNext: 'Response rate, unique responders, and repeat-responder concentration.', confidence: engagement.confidence },
  ]
  const improvements = [
    'Add active employee count, opted-in population, and stable anonymized employee IDs to calculate response rate and repeat-responder concentration.',
    'Normalize team naming across months to improve team trend reliability and reduce false variance.',
    'Capture follow-up owner, request date, first-response date, closed date, and closure notes to score leadership responsiveness.',
    'Add AI-assisted comment taxonomy with human review: workload, recognition, manager behavior, staffing, wellbeing, safety, and retention intent.',
    'Create an executive one-page PDF followed by appendix pages so CEOs see decisions first and supporting analytics second.',
  ]
  const recommendations = [
    { title: 'Target watch-team intervention', priority: 'P1' as const, urgency: retentionRisk === 'Elevated' || retentionRisk === 'High' ? 'High' : 'Medium', impact: 'High', difficulty: 'Medium', owner: 'Operations leader + HR partner', nextStep: `Hold a 30-minute review with managers for ${watchTeams.slice(0, 2).map((t) => t.team).join(' and ')} to identify workload, communication, and recognition blockers.`, why: 'Risk is concentrated by team; targeted intervention is more useful than a broad corporate message.', confidence: 'Medium' as const },
    { title: 'Close the engagement data gap', priority: 'P1' as const, urgency: 'High', impact: 'High', difficulty: 'Low', owner: 'People analytics / system admin', nextStep: 'Add active employee count, opted-in count, and anonymized participant ID to the import schema.', why: 'Without a denominator, leadership cannot distinguish healthy participation from silent-population risk.', confidence: 'High' as const },
    { title: 'Operationalize follow-up accountability', priority: 'P2' as const, urgency: 'Medium', impact: 'High', difficulty: 'Medium', owner: 'HR leader + team managers', nextStep: 'Require status, owner, first-response date, and closure note for every follow-up request.', why: 'Responsiveness is a leadership-effectiveness signal; missing data prevents Lollipop from proving closure.', confidence: responsiveness.confidence },
    { title: 'Reinforce positive culture drivers', priority: 'P3' as const, urgency: 'Medium', impact: 'Medium', difficulty: 'Low', owner: 'Frontline managers', nextStep: 'Identify what top teams are doing differently and turn it into a manager coaching prompt.', why: 'Recognition, support, and visible progress appear to be meaningful positive sentiment drivers.', confidence: commentIntelligence.confidence },
  ]
  return { customerName: customer.name, month: current.month, label: current.label, previousLabel: previous?.label, responseCount: records.length, avgMood, avgMoodChange: monthChange, positivePct, positiveChange, negativeCount, engagementScore, healthScore, healthSeverity: severity(healthScore), retentionRisk, followUpRequests, followUpCompletionPct, unsubscribedCount: customer.unsubscribed.length, reportConfidenceScore, reportConfidence, confidenceRationale: `${records.length} responses, ${commentIntelligence.commentCount} comments, ${allTeams.filter((t) => t.sampleWarning).length} low-sample teams, and ${followUpRequests ? 'available' : 'missing'} follow-up workflow data.`, topTeams, watchTeams, improvingTeams, decliningTeams, lowConfidenceTeams, allTeams, moodDistribution, topEmotions, monthlyTrend, comments: records.map((r) => r.comments).filter(Boolean).slice(0, 8), executiveSummary, strategicNarrative, intelligencePoints, leadershipAttention, commentIntelligence, responsiveness, engagement, trend, improvements, recommendations }
}
