import data from '@/data/demoData.json'
import type { Confidence, CustomerData, EngagementRisk, IndividualRetentionRisk, MonthData, PriorityActionRow, ReportMetrics, ResponseRecord, RetentionRisk, Severity, TeamAttention, TeamMetric, TopPerformingTeam } from './types'

export const customers = data.customers as CustomerData[]

export function slugifyTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
function personKey(r: ResponseRecord) { return `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}|${r.team.trim().toLowerCase()}` }
function personName(r: ResponseRecord) { return `${r.firstName} ${r.lastName}`.trim() }
function buildIndividualRetentionRisks(customer: CustomerData, currentIndex: number): IndividualRetentionRisk[] {
  const recentMonths = customer.months.slice(Math.max(0, currentIndex - 2), currentIndex + 1)
  const current = customer.months[currentIndex]
  const currentKeys = new Set(current.responses.map(personKey))
  const riskWords = ['stressed', 'stress', 'overwhelmed', 'exhausted', 'tired', 'unable to keep up', 'behind', 'bad day', 'worried', 'upset', 'frustrated', 'sad', 'leave', 'quit', 'burnout']
  const workloadWords = ['workload', 'tasks', 'behind', 'unable to keep up', 'extra hours', 'late night', 'vacancies', 'positions', 'staffing']
  const people = new Map<string, ResponseRecord[]>()
  for (const month of recentMonths) for (const r of month.responses) people.set(personKey(r), [...(people.get(personKey(r)) ?? []), r])
  const risks: IndividualRetentionRisk[] = []
  for (const [key, history] of people.entries()) {
    if (!currentKeys.has(key)) continue
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const latest = sorted[sorted.length - 1]
    const first = sorted[0]
    const lowCheckIns = sorted.filter((r) => r.mood <= 2).length
    const moodDrop = round(latest.mood - first.mood, 1)
    const text = sorted.map((r) => `${r.comments} ${r.emotions.join(' ')}`.toLowerCase()).join(' ')
    const drivers = [
      lowCheckIns >= 2 ? `${lowCheckIns} low check-ins in the recent period` : '',
      latest.mood <= 2 ? `current mood is ${latest.mood}` : '',
      moodDrop <= -2 ? `mood declined ${Math.abs(moodDrop)} points` : '',
      contains(text, workloadWords) ? 'workload / capacity signal' : '',
      contains(text, riskWords) ? 'stress, burnout, or negative-emotion language' : '',
      latest.followUpRequested ? 'employee requested follow-up' : '',
    ].filter(Boolean)
    if (!drivers.length) continue
    const score = (lowCheckIns * 2) + (latest.mood <= 2 ? 3 : 0) + (moodDrop <= -2 ? 2 : 0) + (contains(text, workloadWords) ? 1 : 0) + (contains(text, riskWords) ? 1 : 0) + (latest.followUpRequested ? 2 : 0)
    const riskLevel = score >= 8 ? 'Urgent HR Review' : score >= 6 ? 'Manager Action Needed' : score >= 4 ? 'Follow-Up Suggested' : 'Monitor'
    risks.push({
      employeeName: personName(latest),
      team: latest.team,
      riskLevel,
      currentMood: latest.mood,
      lowCheckIns,
      trend: moodDrop < 0 ? `Down ${Math.abs(moodDrop)} mood points over recent check-ins` : moodDrop > 0 ? `Up ${moodDrop} mood points over recent check-ins` : 'Flat over recent check-ins',
      drivers,
      recommendedAction: riskLevel === 'Urgent HR Review' ? 'HR should review immediately and coordinate a sensitive follow-up plan with the manager.' : riskLevel === 'Manager Action Needed' ? 'Manager should conduct a private check-in within 7 days and document the support offered.' : 'Monitor next check-in and look for repeated low mood, workload language, or follow-up request.',
      confidence: sorted.length >= 3 ? 'Medium' : 'Low',
    })
  }
  const rank: Record<string, number> = { 'Urgent HR Review': 1, 'Manager Action Needed': 2, 'Follow-Up Suggested': 3, Monitor: 4 }
  return risks.sort((a, b) => rank[a.riskLevel] - rank[b.riskLevel] || a.currentMood - b.currentMood).slice(0, 8)
}
type ThemeProbe = { theme: string; words: string[] }
const COMMENT_THEME_PROBES: ThemeProbe[] = [
  { theme: 'Workload Pressure', words: ['workload', 'tasks', 'behind', 'unable to keep up', 'extra hours', 'late night', 'vacancies', 'positions', 'staffing', 'overwhelmed', 'exhausted'] },
  { theme: 'Recognition & Appreciation', words: ['appreciate', 'appreciated', 'grateful', 'backing', 'support', 'helping', 'great people'] },
  { theme: 'Leadership Support', words: ['manager', 'supervisor', 'power', 'talks to others', 'support', 'communication', 'backing'] },
  { theme: 'Operational Bottlenecks', words: ['vacancies', 'clock', 'bonus', 'positions', 'tasks', 'behind'] },
  { theme: 'Optimism / Momentum', words: ['deal', 'opportunity', 'closer', 'optimistic', 'excited', 'motivated'] },
  { theme: 'Personal / Wellbeing', words: ['insurance', 'wife', 'asthma', 'fired', 'personal', 'family', 'health', 'mentally', 'physically'] },
]
function probeThemeCounts(records: ResponseRecord[]) {
  const map = new Map<string, { count: number; teams: Set<string> }>()
  for (const probe of COMMENT_THEME_PROBES) map.set(probe.theme, { count: 0, teams: new Set<string>() })
  for (const r of records) {
    const text = r.comments.toLowerCase()
    if (!text.trim()) continue
    for (const probe of COMMENT_THEME_PROBES) {
      if (contains(text, probe.words)) {
        const entry = map.get(probe.theme)!
        entry.count += 1
        entry.teams.add(r.team)
      }
    }
  }
  return map
}
function buildPriorComparison(records: ResponseRecord[], priorRecords: ResponseRecord[]): import('./types').CommentPriorComparison {
  const priorCommentCount = priorRecords.filter((r) => r.comments.trim()).length
  if (priorCommentCount === 0) {
    return { hasPriorData: false, improving: [], persisting: [], worsening: [], faded: [], spreading: [], newThemes: [], persistingTeams: [] }
  }
  const cur = probeThemeCounts(records)
  const prev = probeThemeCounts(priorRecords)
  const improving: import('./types').CommentPriorComparison['improving'] = []
  const worsening: import('./types').CommentPriorComparison['worsening'] = []
  const persisting: import('./types').CommentPriorComparison['persisting'] = []
  const faded: import('./types').CommentPriorComparison['faded'] = []
  const spreading: import('./types').CommentPriorComparison['spreading'] = []
  const newThemes: import('./types').CommentPriorComparison['newThemes'] = []
  const persistingTeams: import('./types').CommentPriorComparison['persistingTeams'] = []
  for (const probe of COMMENT_THEME_PROBES) {
    const c = cur.get(probe.theme)!
    const p = prev.get(probe.theme)!
    const isRisk = probe.theme === 'Workload Pressure' || probe.theme === 'Operational Bottlenecks' || probe.theme === 'Personal / Wellbeing'
    const delta = c.count - p.count
    if (p.count === 0 && c.count > 0) newThemes.push({ theme: probe.theme, currentCount: c.count })
    else if (c.count === 0 && p.count > 0) faded.push({ theme: probe.theme, priorCount: p.count })
    else if (c.count > 0 && p.count > 0) {
      if (isRisk && delta <= -1) improving.push({ theme: probe.theme, currentCount: c.count, priorCount: p.count, delta })
      else if (isRisk && delta >= 1) worsening.push({ theme: probe.theme, currentCount: c.count, priorCount: p.count, delta })
      else if (!isRisk && delta >= 1) improving.push({ theme: probe.theme, currentCount: c.count, priorCount: p.count, delta })
      else if (!isRisk && delta <= -1) worsening.push({ theme: probe.theme, currentCount: c.count, priorCount: p.count, delta })
      else persisting.push({ theme: probe.theme, currentCount: c.count, priorCount: p.count })
    }
    const currentTeams = c.teams.size
    const priorTeams = p.teams.size
    if (currentTeams > priorTeams && currentTeams >= 2) spreading.push({ theme: probe.theme, currentTeams, priorTeams })
    const sharedTeams = [...c.teams].filter((t) => p.teams.has(t))
    if (sharedTeams.length >= 2 && c.count > 0 && p.count > 0) persistingTeams.push({ theme: probe.theme, teams: sharedTeams.slice(0, 4) })
  }
  return { hasPriorData: true, improving, persisting, worsening, faded, spreading, newThemes, persistingTeams }
}
function buildCommentIntelligence(records: ResponseRecord[], priorRecords: ResponseRecord[] = []) {
  const commentRecords = records.filter((r) => r.comments.trim())
  const priorComparison = buildPriorComparison(records, priorRecords)
  const comments = commentRecords.map((r) => r.comments)
  const lower = comments.map((c) => c.toLowerCase())
  const countWhere = (words: string[]) => lower.filter((c) => contains(c, words)).length
  const recordsWhere = (words: string[]) => commentRecords.filter((r) => contains(r.comments.toLowerCase(), words))
  const teamList = (items: ResponseRecord[]) => [...new Set(items.map((r) => r.team))].slice(0, 3).join(', ') || 'Limited team signal'
  const stressWords = ['stressed', 'stress', 'overwhelmed', 'exhausted', 'tired', 'unable to keep up', 'behind', 'late night', 'bad day']
  const workloadWords = ['workload', 'tasks', 'behind', 'unable to keep up', 'extra hours', 'late night', 'vacancies', 'positions', 'staffing']
  const personalWords = ['insurance', 'wife', 'asthma', 'fired', 'personal', 'family', 'health']
  const recognitionWords = ['appreciate', 'appreciated', 'grateful', 'backing', 'support', 'helping', 'great people']
  const leadershipWords = ['manager', 'supervisor', 'power', 'talks to others', 'support', 'communication', 'backing']
  const optimismWords = ['deal', 'opportunity', 'closer', 'optimistic', 'excited', 'motivated']
  const stress = countWhere(stressWords)
  const recognition = countWhere(recognitionWords)
  const leadership = countWhere(leadershipWords)
  const work = countWhere(['deal', 'work', 'task', 'position', 'plant', 'clock', 'bonus', 'manager', 'supervisor', 'areas', ...workloadWords])
  const wellbeing = countWhere(personalWords.concat(['mentally', 'physically', 'tired', 'bad day']))
  const positive = commentRecords.filter((r) => r.mood >= 4 || r.emotions.some((e) => ['Grateful', 'Happy', 'Optimistic', 'Motivated', 'Appreciated', 'Excited'].includes(e))).length
  const workStressRecords = recordsWhere(workloadWords)
  const personalStressRecords = recordsWhere(personalWords)
  const mixedStressRecords = workStressRecords.filter((r) => contains(r.comments.toLowerCase(), personalWords))
  const pureWorkStress = Math.max(0, workStressRecords.length - mixedStressRecords.length)
  const purePersonalStress = Math.max(0, personalStressRecords.length - mixedStressRecords.length)
  const stressTotal = pureWorkStress + purePersonalStress + mixedStressRecords.length
  const themes = [
    { theme: 'Positive momentum and optimism', count: positive, type: 'Positive' as const, signal: 'Employees are naming progress, motivation, gratitude, and optimism as sources of energy.' },
    { theme: 'Workload and burnout pressure', count: stress, type: 'Risk' as const, signal: 'A focused set of comments references stress, exhaustion, falling behind, and long hours.' },
    { theme: 'Recognition and manager backing', count: recognition, type: 'Leadership' as const, signal: 'Recognition and visible leadership support appear to be strong drivers of positive sentiment.' },
    { theme: 'Leadership tone and communication', count: leadership, type: 'Leadership' as const, signal: 'Several comments point to manager behavior, support, and communication as culture-shaping variables.' },
    { theme: 'Operational staffing/friction', count: countWhere(['vacancies', 'positions', 'clock', 'bonus', 'tasks', 'behind']), type: 'Work' as const, signal: 'Operational blockers are appearing in emotional comments and may affect morale if unresolved.' },
  ].filter((t) => t.count > 0)
  const representative = commentRecords
    .sort((a, b) => (b.comments.length + (b.mood <= 2 ? 80 : 0)) - (a.comments.length + (a.mood <= 2 ? 80 : 0)))
    .slice(0, 4)
    .map((r) => `“${anonymize(r.comments).slice(0, 170)}${r.comments.length > 170 ? '…' : ''}”`)
  const themeTable = [
    { theme: 'Workload Pressure', trendDirection: stress > 2 ? 'Increasing' as const : 'Stable' as const, sentimentType: 'Negative' as const, primaryTeams: teamList(workStressRecords), interpretation: 'Repeated workload language suggests operational strain may be a root cause behind lower-mood pockets.', suggestion: 'Run a 30-minute workload review with affected team managers; identify one task, deadline, or staffing gap to remove or reassign this period.' },
    { theme: 'Recognition & Appreciation', trendDirection: recognition > 3 ? 'Increasing' as const : 'Stable' as const, sentimentType: 'Positive' as const, primaryTeams: teamList(recordsWhere(recognitionWords)), interpretation: 'Appreciation and visible support are reinforcing morale and should be preserved as management behaviors.', suggestion: 'Capture one specific recognition story from a top-performing team and share it as a manager-coaching prompt to peers.' },
    { theme: 'Leadership Support', trendDirection: leadership > 2 ? 'Stable' as const : 'Stable' as const, sentimentType: leadership > 0 ? 'Mixed' as const : 'Positive' as const, primaryTeams: teamList(recordsWhere(leadershipWords)), interpretation: 'Manager tone, communication, and backing are showing up as meaningful cultural levers.', suggestion: 'Reinforce a clear weekly communication cadence (expectations, changes, support availability) with affected managers; revisit next cycle.' },
    { theme: 'Operational Bottlenecks', trendDirection: countWhere(['vacancies', 'clock', 'bonus', 'positions']) > 1 ? 'Increasing' as const : 'Stable' as const, sentimentType: 'Mixed' as const, primaryTeams: teamList(recordsWhere(['vacancies', 'clock', 'bonus', 'positions'])), interpretation: 'Process and staffing friction may be creating avoidable frustration in operational teams.', suggestion: 'Pick one visible operational friction point (clock-in, scheduling, vacancies) and close it before the next check-in cycle so employees see action from the feedback loop.' },
    { theme: 'Optimism / Momentum', trendDirection: countWhere(optimismWords) > 2 ? 'Increasing' as const : 'Stable' as const, sentimentType: 'Positive' as const, primaryTeams: teamList(recordsWhere(optimismWords)), interpretation: 'Employees are voicing optimism, progress, and confidence — visible positive drivers worth reinforcing in parts of the workforce.', suggestion: 'Name the wins driving momentum in an all-team message; tie them to behaviors others can replicate.' },
  ]
  const executiveSummary = 'Employee comments show a workforce with meaningful positive energy, especially around appreciation, support, progress, and optimism. At the same time, a smaller but important set of comments points to workload pressure, operational friction, and manager communication as the most likely drivers of lower-mood pockets. The comment signal appears concentrated rather than organization-wide, which makes targeted manager action more appropriate than broad messaging. Leadership should preserve recognition and peer-support behaviors while addressing the operational blockers that employees are explicitly naming.'
  const positiveDrivers = [
    { observation: 'Employees repeatedly referenced appreciation, support, and gratitude as positive emotional drivers.', suggestion: 'Standardize a simple manager habit: 1–2 specific thank-you moments per week called out by name in team meetings.' },
    { observation: 'Optimism appears connected to visible progress, team momentum, and confidence that work is moving forward.', suggestion: 'Make progress visible — share weekly wins, milestones, or completed projects in an all-hands or team channel.' },
    { observation: 'Positive comments suggest that manager backing and peer support are practical behaviors worth reinforcing.', suggestion: 'Surface what top-team managers are doing differently and turn it into a one-page coaching prompt for peer managers.' },
  ]
  const attentionAreas = [
    { observation: 'Workload-related language suggests some employees are experiencing sustained pressure or difficulty keeping up.', suggestion: 'Schedule a workload review with affected managers; agree to remove, reassign, or defer one item per team this period.' },
    { observation: 'Operational friction such as staffing gaps, process issues, or administrative errors may be creating avoidable frustration.', suggestion: 'Pick the single most-named operational issue (clock-in, scheduling, vacancies) and resolve it visibly before the next cycle.' },
    { observation: 'Leadership tone and communication appear important enough to monitor because they shape whether employees feel supported or dismissed.', suggestion: 'Coach managers on a consistent weekly communication cadence: expectations, changes, recognition, and availability for support.' },
  ]
  const stressAnalysis = [
    { category: 'Work-Related' as const, count: pureWorkStress, pct: pct(pureWorkStress, stressTotal), interpretation: 'Primarily tied to workload, staffing, processes, or role execution.' },
    { category: 'Personal' as const, count: purePersonalStress, pct: pct(purePersonalStress, stressTotal), interpretation: 'Driven mainly by personal, health, family, or external life factors.' },
    { category: 'Mixed' as const, count: mixedStressRecords.length, pct: pct(mixedStressRecords.length, stressTotal), interpretation: 'Both work and personal stressors appear in the same comment.' },
  ]
  const byTeamComments = new Map<string, ResponseRecord[]>()
  for (const r of commentRecords) byTeamComments.set(r.team, [...(byTeamComments.get(r.team) ?? []), r])
  const teamSpecificInsights = [...byTeamComments.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([team, rs]) => {
      const text = rs.map((r) => r.comments.toLowerCase()).join(' ')
      const category = contains(text, workloadWords) ? 'Operational pressure' : contains(text, recognitionWords) ? 'Positive support' : contains(text, leadershipWords) ? 'Leadership signal' : 'General morale'
      const insight = category === 'Operational pressure'
        ? `${team} comments point to workload intensity, staffing pressure, or process friction, helping explain why leadership should look beyond the score and address operating conditions directly.`
        : category === 'Positive support'
          ? `${team} comments emphasize appreciation, help, and support, suggesting there are management or peer behaviors worth preserving and potentially replicating.`
          : category === 'Leadership signal'
            ? `${team} comments reference manager support, communication, or tone, indicating that frontline leadership behavior is influencing the employee experience.`
            : `${team} comments provide useful emotional texture but do not yet show a strong recurring theme; continue monitoring before drawing firm conclusions.`
      return { team, insight, category }
    })
  const closingLine = priorComparison.hasPriorData
    ? (() => {
        const bits: string[] = []
        if (priorComparison.improving.length) bits.push(`${priorComparison.improving.map((i) => i.theme).join(', ')} improved versus the prior month`)
        if (priorComparison.persisting.length) bits.push(`${priorComparison.persisting.map((i) => i.theme).join(', ')} are persisting at similar levels`)
        if (priorComparison.worsening.length) bits.push(`${priorComparison.worsening.map((i) => i.theme).join(', ')} appear worse than the prior month`)
        if (priorComparison.faded.length) bits.push(`${priorComparison.faded.map((i) => i.theme).join(', ')} faded from last month`)
        if (priorComparison.spreading.length) bits.push(`${priorComparison.spreading.map((i) => i.theme).join(', ')} are spreading to more teams`)
        if (priorComparison.newThemes.length) bits.push(`${priorComparison.newThemes.map((i) => i.theme).join(', ')} are newly present this month`)
        return bits.length
          ? `Comparing against the prior month's comments: ${bits.join('; ')}. Continue tracking whether these patterns repeat next month.`
          : 'Comment themes are broadly stable versus the prior month; continue tracking for confirmation.'
      })()
    : 'Use next month’s comments to verify whether the same themes are persisting, improving, or spreading to additional teams.'
  const leadershipRecommendations = [
    stress > 0 ? 'Run a targeted workload review in teams where comments reference falling behind, exhaustion, staffing gaps, or sustained pressure.' : '',
    recognition > 0 ? 'Reinforce recognition and manager-backing behaviors that employees are already naming positively.' : '',
    leadership > 0 ? 'Tighten manager communication cadence around expectations, changes, and support availability.' : '',
    work > 0 ? 'Close one visible operational friction point before the next check-in cycle so employees see action from the feedback loop.' : '',
    closingLine,
  ].filter(Boolean)
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
    executiveSummary,
    themeTable,
    positiveDrivers,
    attentionAreas,
    stressAnalysis,
    teamSpecificInsights,
    voiceQuotes: representative,
    leadershipRecommendations,
    priorComparison,
  }
}

export function getReport(customerId = 'cosmo-cabinets', month?: string, range: 'month' | 'quarter' = 'month'): ReportMetrics {
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
  const historyMonths = customer.months.slice(Math.max(0, currentIndex - 5), currentIndex + 1)
  const personKey = (r: ResponseRecord) => `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`
  const allTeams: TeamMetric[] = [...teamMap.entries()].map(([team, teamRecords]) => {
    const teamMoods = teamRecords.map((r) => r.mood).filter(Boolean)
    const previousTeamRecords = prevTeamMap.get(team) ?? []
    const previousTeamMoods = previousTeamRecords.map((r) => r.mood).filter(Boolean)
    const tAvg = round(avg(teamMoods), 2)
    const tPositive = pct(teamMoods.filter((m) => m >= 4).length, teamMoods.length)
    const change = previousTeamMoods.length ? round(tAvg - avg(previousTeamMoods), 2) : null
    const risk = riskFromMood(tAvg, tPositive, change)
    const confidence = confidenceFromCount(teamRecords.length)
    const uniqueRespondents = new Set(teamRecords.map(personKey)).size
    const uniqueRespondentsChange = previous
      ? uniqueRespondents - new Set(previousTeamRecords.map(personKey)).size
      : null
    const history = historyMonths
      .map((m) => {
        const ms = m.responses.filter((r) => r.team === team).map((r) => r.mood).filter(Boolean)
        return ms.length ? { month: m.month, label: m.label, avgMood: round(avg(ms), 2) } : null
      })
      .filter((h): h is { month: string; label: string; avgMood: number } => h !== null)
    // Weekly history across the same window — Monday-start ISO weeks
    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const weekBuckets = new Map<string, { date: Date; moods: number[]; monthIdx: number }>()
    for (const m of historyMonths) {
      const teamRecs = m.responses.filter((r) => r.team === team)
      for (const r of teamRecs) {
        if (!r.mood) continue
        const d = new Date(r.date)
        if (Number.isNaN(d.getTime())) continue
        // Snap to Monday of that week
        const wd = d.getDay() // 0=Sun..6=Sat
        const offset = (wd + 6) % 7 // Mon=0..Sun=6
        const monday = new Date(d)
        monday.setHours(0, 0, 0, 0)
        monday.setDate(d.getDate() - offset)
        const key = monday.toISOString().slice(0, 10)
        const existing = weekBuckets.get(key)
        if (existing) existing.moods.push(r.mood)
        else weekBuckets.set(key, { date: monday, moods: [r.mood], monthIdx: monday.getMonth() })
      }
    }
    const weeklyHistory = [...weekBuckets.entries()]
      .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
      .map(([key, b]) => {
        const isFirstWeekOfMonth = b.date.getDate() <= 7
        return {
          weekStart: key,
          label: isFirstWeekOfMonth ? `${monthAbbrev[b.monthIdx]} ${b.date.getFullYear()}` : '',
          monthLabel: `${monthAbbrev[b.monthIdx]} ${b.date.getFullYear()}`,
          avgMood: round(avg(b.moods), 2),
        }
      })
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
      history,
      weeklyHistory,
      uniqueRespondents,
      uniqueRespondentsChange,
    }
  }).sort((a, b) => b.responses - a.responses)
  const topTeams = [...allTeams].filter((t) => !t.sampleWarning).sort((a, b) => b.avgMood - a.avgMood || b.responses - a.responses).slice(0, 3)
  const watchTeams = [...allTeams].sort((a, b) => riskRank(b.risk) - riskRank(a.risk) || a.avgMood - b.avgMood).slice(0, 4)
  const improvingTeams = [...allTeams].filter((t) => (t.change ?? 0) > 0.15 && !t.sampleWarning).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 4)
  const decliningTeams = [...allTeams].filter((t) => (t.change ?? 0) < -0.15 && !t.sampleWarning).sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 4)
  const engagementImprovingTeams = [...allTeams].filter((t) => (t.uniqueRespondentsChange ?? 0) > 0).sort((a, b) => (b.uniqueRespondentsChange ?? 0) - (a.uniqueRespondentsChange ?? 0)).slice(0, 4)
  const engagementDecliningTeams = [...allTeams].filter((t) => (t.uniqueRespondentsChange ?? 0) < 0).sort((a, b) => (a.uniqueRespondentsChange ?? 0) - (b.uniqueRespondentsChange ?? 0)).slice(0, 4)
  const lowConfidenceTeams = allTeams.filter((t) => t.sampleWarning)
  const emotionCounts = new Map<string, number>()
  for (const r of records) for (const e of r.emotions) emotionCounts.set(e, (emotionCounts.get(e) ?? 0) + 1)
  const emotionTotal = [...emotionCounts.values()].reduce((a, b) => a + b, 0)
  const topEmotions = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emotion, count]) => ({ emotion, count, pct: pct(count, emotionTotal) }))
  const moodMeta = [
    { mood: '1', label: 'Terrible', color: '#ef4444', emoji: '/emojis/Terrible.png' },
    { mood: '2', label: 'Bad', color: '#f97316', emoji: '/emojis/Bad.png' },
    { mood: '3', label: 'Ok', color: '#facc15', emoji: '/emojis/Ok.png' },
    { mood: '4', label: 'Good', color: '#84cc16', emoji: '/emojis/Good.png' },
    { mood: '5', label: 'Great', color: '#22c55e', emoji: '/emojis/Great.png' },
  ]
  const moodDistribution = moodMeta.map((meta) => { const n = Number(meta.mood); const count = moods.filter((v) => v === n).length; return { ...meta, count, pct: pct(count, moods.length) } })
  const retentionRisk = riskFromMood(avgMood, positivePct, monthChange)
  const softened = monthChange !== null && monthChange < 0
  const monthlyTrend = customer.months.map((m) => { const ms = m.responses.map((r) => r.mood).filter(Boolean); return { label: m.label, avgMood: round(avg(ms), 2), positivePct: pct(ms.filter((v) => v >= 4).length, ms.length), responses: m.responses.length } })
  const lastThree = monthlyTrend.slice(Math.max(0, currentIndex - 2), currentIndex + 1)
  const threeMonthAvgMood = lastThree.length === 3 ? round(avg(lastThree.map((m) => m.avgMood)), 2) : null
  const rollingPositivePct = lastThree.length === 3 ? round(avg(lastThree.map((m) => m.positivePct)), 1) : null
  const bestMonth = [...monthlyTrend].sort((a, b) => b.avgMood - a.avgMood)[0]
  const worstMonth = [...monthlyTrend].sort((a, b) => a.avgMood - b.avgMood)[0]
  const volatilityValue = round(Math.max(...monthlyTrend.map((m) => m.avgMood)) - Math.min(...monthlyTrend.map((m) => m.avgMood)), 2)
  const commentIntelligence = buildCommentIntelligence(records, prevRecords)
  const individualRetentionRisks = buildIndividualRetentionRisks(customer, currentIndex)
  const reportConfidenceScore = confidenceScore(records.length, allTeams, commentIntelligence.commentCount, followUpRequests > 0)
  const reportConfidence = confidenceLabel(reportConfidenceScore)
  const participationChange = previous ? records.length - prevRecords.length : null
  // Person-level key (name only, no team) so roster matching and unique
  // counts treat the same employee as one person even across teams.
  const uniqueParticipantKey = (r: ResponseRecord) => `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`
  const uniqueParticipants = new Set(records.map(uniqueParticipantKey)).size
  const previousUniqueParticipants = previous ? new Set(prevRecords.map(uniqueParticipantKey)).size : null

  // === Engagement summary with off-roster inclusion ===
  const roster = customer.roster ?? []
  const hasRoster = roster.length > 0
  const rosterCount = hasRoster ? roster.length : (customer.optedInPopulation ?? 0)
  const rosterKeys = new Set(
    roster.map((r) => `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`),
  )
  const respondentsThisMonth = new Set(records.map(uniqueParticipantKey))
  const offRosterThisMonth: string[] = []
  respondentsThisMonth.forEach((key) => { if (hasRoster && !rosterKeys.has(key)) offRosterThisMonth.push(key) })
  const monthlyEffectiveRoster = hasRoster
    ? rosterCount + offRosterThisMonth.length
    : (customer.optedInPopulation ?? (uniqueParticipants + customer.unsubscribed.length))
  const monthlyEngagementRate = pct(uniqueParticipants, monthlyEffectiveRoster)

  // Prior-month effective roster and rate (for change indicator)
  const respondentsPrev = previous ? new Set(prevRecords.map(uniqueParticipantKey)) : null
  const offRosterPrev: string[] = []
  respondentsPrev?.forEach((key) => { if (hasRoster && !rosterKeys.has(key)) offRosterPrev.push(key) })
  const prevMonthlyEffectiveRoster = respondentsPrev
    ? (hasRoster ? rosterCount + offRosterPrev.length : (customer.optedInPopulation ?? ((previousUniqueParticipants ?? 0) + customer.unsubscribed.length)))
    : null
  const previousEngagementRate = prevMonthlyEffectiveRoster ? pct(previousUniqueParticipants ?? 0, prevMonthlyEffectiveRoster) : null

  // Weekly breakdown — the reporting month's weeks by default, or the
  // calendar quarter containing the reporting month (up to that month).
  const parseDate = (s: string): Date | null => { const d = new Date(s); return isNaN(d.getTime()) ? null : d }
  const currentMonthNum = parseInt(current.month.slice(5, 7), 10)
  const currentYear = current.month.slice(0, 4)
  const quarterNum = Math.ceil(currentMonthNum / 3)
  // Full calendar quarter (all three months, wherever data exists)
  const quarterMonthKeys = [1, 2, 3]
    .map((i) => `${currentYear}-${String((quarterNum - 1) * 3 + i).padStart(2, '0')}`)
  const weeklyWindowMonths = range === 'quarter'
    ? customer.months.filter((m) => quarterMonthKeys.includes(m.month))
    : [current]
  const weeklyWindowMonthKeys = range === 'quarter' ? quarterMonthKeys : [current.month]
  const weeklyWindowLabel = range === 'quarter' ? `Q${quarterNum} ${currentYear}` : current.label
  const monthAbbrev = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const buildWeekly = (recs: ResponseRecord[]) => {
    const weekBuckets = new Map<string, { start: Date; respondents: Set<string> }>()
    for (const r of recs) {
      const d = parseDate(r.date)
      if (!d) continue
      const wd = d.getDay()
      const offset = (wd + 6) % 7 // Monday-start
      const monday = new Date(d); monday.setHours(0, 0, 0, 0); monday.setDate(d.getDate() - offset)
      const key = monday.toISOString().slice(0, 10)
      const bucket = weekBuckets.get(key) ?? { start: monday, respondents: new Set<string>() }
      bucket.respondents.add(uniqueParticipantKey(r))
      weekBuckets.set(key, bucket)
    }
    return [...weekBuckets.entries()]
      .sort((a, b) => a[1].start.getTime() - b[1].start.getTime())
      .map(([weekStart, b]) => {
        const uniques = b.respondents.size
        const offCount = hasRoster ? [...b.respondents].filter((k) => !rosterKeys.has(k)).length : 0
        const effRoster = hasRoster ? rosterCount + offCount : (rosterCount || uniques)
        const engagement = pct(uniques, effRoster)
        const wd = b.start.getDate()
        const wLabel = `${monthAbbrev[b.start.getMonth()]} ${wd}`
        return { weekStart, weekLabel: wLabel, uniqueRespondents: uniques, offRosterRespondents: offCount, effectiveRoster: effRoster, engagementRate: engagement }
      })
  }
  // Detail table: reporting month's weeks, or the quarter's weeks in quarter
  // view. Presentation-only filter: show weeks whose start (Monday) falls
  // inside the selected period, so boundary weeks belonging to the prior
  // month don't appear (e.g. 'Wk of Mar 30' is excluded from an April table).
  const weeklyEngagement = buildWeekly(weeklyWindowMonths.flatMap((m) => m.responses))
    .filter((w) => weeklyWindowMonthKeys.includes(w.weekStart.slice(0, 7)))
  // Chart: always trailing 3 months ending at the reporting month
  const weeklyTrailing = buildWeekly(
    customer.months.slice(Math.max(0, currentIndex - 2), currentIndex + 1).flatMap((m) => m.responses),
  )

  // Off-roster respondents list (this month, with names)
  const offRosterList = hasRoster
    ? records.filter((r) => !rosterKeys.has(uniqueParticipantKey(r)))
        .map((r) => `${(r.firstName || '').trim().toLowerCase()}|${(r.lastName || '').trim().toLowerCase()}|${(r.firstName || '').trim()} ${(r.lastName || '').trim()}`)
        .filter((s, i, a) => a.indexOf(s) === i)
        .map((s) => {
          const parts = s.split('|')
          return { firstName: parts[2].split(' ').slice(0, -1).join(' ') || parts[2], lastName: parts[2].split(' ').slice(-1)[0] || '', firstSeen: current.month, monthLabel: current.label }
        })
    : []

  // Weekly movement: latest week vs prior week (from the trailing series so
  // the delta is stable regardless of the detail-table window)
  const weeklyEngagementChange = weeklyTrailing.length >= 2
    ? round(
        weeklyTrailing[weeklyTrailing.length - 1].engagementRate -
          weeklyTrailing[weeklyTrailing.length - 2].engagementRate,
        1,
      )
    : null

  const engagementSummary = {
    hasRoster,
    rosterCount,
    uniqueRespondents: uniqueParticipants,
    offRosterCount: offRosterThisMonth.length,
    effectiveRoster: monthlyEffectiveRoster,
    engagementRate: monthlyEngagementRate,
    offRosterList,
    weekly: weeklyEngagement,
    weeklyTrailing,
    weeklyChange: weeklyEngagementChange,
    weeklyWindowLabel,
  }

  const optedInPopulation = monthlyEffectiveRoster
  const engagementRate = monthlyEngagementRate
  // Engagement movement is judged week-over-week within the month, not month-over-month
  const engagementRateChange = weeklyEngagementChange ?? (previousEngagementRate !== null ? round(engagementRate - previousEngagementRate, 1) : null)

  // === Team risk engine: mood + engagement signals combined ===
  // Team engagement rate uses an estimated team roster: the unique people
  // seen responding for that team across the trailing 6-month window. This
  // keeps calculations consistent while no per-team headcount is uploaded.
  const teamWeeklyConsecutiveDeclines = (team: string) => {
    const buckets = new Map<string, Set<string>>()
    for (const m of weeklyWindowMonths) {
      for (const r of m.responses) {
        if (r.team !== team) continue
        const d = parseDate(r.date)
        if (!d) continue
        const off = (d.getDay() + 6) % 7
        const monday = new Date(d); monday.setHours(0, 0, 0, 0); monday.setDate(d.getDate() - off)
        const k = monday.toISOString().slice(0, 10)
        const set = buckets.get(k) ?? new Set<string>()
        set.add(personKey(r))
        buckets.set(k, set)
      }
    }
    const counts = [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, s]) => s.size)
    let run = 0
    let maxRun = 0
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] < counts[i - 1]) { run++; maxRun = Math.max(maxRun, run) } else run = 0
    }
    return maxRun
  }

  const companyEngagement = monthlyEngagementRate
  const teamAssessments = allTeams.map((t) => {
    const teamRosterProxy = new Set(
      historyMonths.flatMap((m) => m.responses.filter((r) => r.team === t.team).map(personKey)),
    ).size
    const teamRate = teamRosterProxy ? pct(t.uniqueRespondents, teamRosterProxy) : null
    const prevUnique = new Set((prevTeamMap.get(t.team) ?? []).map(personKey)).size
    const prevRate = teamRosterProxy && previous ? pct(prevUnique, teamRosterProxy) : null
    const engChangePts = teamRate !== null && prevRate !== null ? round(teamRate - prevRate, 1) : null
    const teamRecs = teamMap.get(t.team) ?? []
    const negPct = pct(teamRecs.filter((r) => r.mood && r.mood <= 2).length, t.responses)
    const consecutiveDeclines = teamWeeklyConsecutiveDeclines(t.team)

    // Mood signals
    const moodMajor = t.avgMood <= avgMood - 0.5 || (t.change ?? 0) <= -0.5
    const moodMinor = !moodMajor && (t.avgMood <= avgMood - 0.2 || (t.change ?? 0) <= -0.3 || negPct >= 20)
    // Engagement signals
    const engMajor = teamRate !== null && (teamRate <= companyEngagement - 15 || (engChangePts ?? 0) <= -15)
    const engMinor = !engMajor && ((engChangePts ?? 0) <= -10 || consecutiveDeclines >= 3 || (teamRate !== null && teamRate <= companyEngagement - 10))

    const moodReasons: string[] = []
    if (t.avgMood <= avgMood - 0.5) moodReasons.push(`mood is ${(avgMood - t.avgMood).toFixed(1)} pts below the company average`)
    else if (t.avgMood <= avgMood - 0.2) moodReasons.push('mood is slightly below the company average')
    if ((t.change ?? 0) <= -0.3) moodReasons.push(`mood declined ${Math.abs(t.change ?? 0).toFixed(2)} pts this period`)
    if (negPct >= 20) moodReasons.push(`${negPct}% of check-ins were negative`)
    const engReasons: string[] = []
    if (teamRate !== null && teamRate <= companyEngagement - 15) engReasons.push(`engagement is ${round(companyEngagement - teamRate, 0)} pts below the company average`)
    else if (teamRate !== null && teamRate <= companyEngagement - 10) engReasons.push('engagement is below the company average')
    if ((engChangePts ?? 0) <= -10) engReasons.push(`engagement fell ${Math.abs(engChangePts ?? 0)} pts v. prior month`)
    if (consecutiveDeclines >= 3) engReasons.push(`participation declined ${consecutiveDeclines} consecutive weeks`)

    return { t, teamRate, engChangePts, negPct, consecutiveDeclines, moodMajor, moodMinor, engMajor, engMinor, moodReasons, engReasons }
  })

  const teamsNeedingAttention: TeamAttention[] = teamAssessments
    .filter((a) => a.moodMajor || a.moodMinor || a.engMajor || a.engMinor)
    .map((a) => {
      const moodBad = a.moodMajor || a.moodMinor
      const engBad = a.engMajor || a.engMinor
      let riskLevel: TeamAttention['riskLevel']
      if (a.t.sampleWarning) riskLevel = 'Watch'
      else if (moodBad && engBad) riskLevel = 'Critical'
      else if (a.moodMajor || a.engMajor) riskLevel = 'High'
      else riskLevel = 'Moderate'
      const reasons = [...a.moodReasons, ...a.engReasons]
      const why = reasons.length
        ? reasons.join('; ').replace(/^./, (c) => c.toUpperCase()) + (a.t.sampleWarning ? ` (only ${a.t.responses} responses — read directionally)` : '')
        : 'Early signal worth monitoring'
      const suggestedFocus =
        riskLevel === 'Watch'
          ? 'Monitor next period and encourage more check-ins; the sample is small'
          : moodBad && engBad
          ? 'Manager check-in and targeted follow-up this week'
          : engBad
          ? 'Re-engage the team and reinforce participation expectations'
          : 'Manager-led listening session on workload, communication, and recognition'
      return {
        team: a.t.team,
        riskLevel,
        whyItMatters: why,
        suggestedFocus,
        avgMood: a.t.avgMood,
        moodChange: a.t.change,
        engagementRate: a.teamRate,
        engagementChangePts: a.engChangePts,
      }
    })
    .sort((x, y) => {
      const rank: Record<string, number> = { Critical: 0, High: 1, Moderate: 2, Watch: 3 }
      return rank[x.riskLevel] - rank[y.riskLevel] || x.avgMood - y.avgMood
    })

  const attentionTeamNames = new Set(teamsNeedingAttention.map((t) => t.team))
  const topPerformingTeams: TopPerformingTeam[] = teamAssessments
    .filter((a) => !attentionTeamNames.has(a.t.team) && !a.t.sampleWarning)
    .map((a) => {
      const strengths: string[] = []
      const whys: string[] = []
      if (a.t.avgMood >= avgMood + 0.3) { strengths.push('High mood'); whys.push(`mood ${a.t.avgMood.toFixed(2)} vs company ${avgMood.toFixed(2)}`) }
      if ((a.t.change ?? 0) >= 0.2) { strengths.push('Improving mood'); whys.push(`mood improved ${(a.t.change ?? 0).toFixed(2)} pts this period`) }
      if (a.teamRate !== null && a.teamRate >= Math.max(companyEngagement + 10, 70)) { strengths.push('Strong engagement'); whys.push(`engagement is ${a.teamRate}%`) }
      if ((a.engChangePts ?? 0) >= 10) { strengths.push('Improving engagement'); whys.push(`engagement rose ${a.engChangePts} pts v. prior month`) }
      if (!strengths.length) return null
      return {
        team: a.t.team,
        strength: strengths.join(' + '),
        why: whys.join('; ').replace(/^./, (c) => c.toUpperCase()),
        _mood: a.t.avgMood,
      }
    })
    .filter((x): x is TopPerformingTeam & { _mood: number } => x !== null)
    .sort((x, y) => y._mood - x._mood)
    .slice(0, 4)
    .map(({ team, strength, why }) => ({ team, strength, why }))

  const engagementRisks: EngagementRisk[] = teamAssessments
    .filter((a) => (a.engMajor || a.engMinor) && a.teamRate !== null)
    .map((a) => {
      let issue = 'Low engagement'
      let changeText = `${round(companyEngagement - (a.teamRate ?? 0), 0)} pts below company average`
      if (a.consecutiveDeclines >= 3) { issue = 'Sustained decline'; changeText = `down ${a.consecutiveDeclines} consecutive weeks` }
      else if ((a.engChangePts ?? 0) <= -10) { issue = 'Declining engagement'; changeText = `down ${Math.abs(a.engChangePts ?? 0)} pts` }
      return { team: a.t.team, issue, currentEngagement: a.teamRate ?? 0, change: changeText }
    })
    .sort((x, y) => x.currentEngagement - y.currentEngagement)
    .slice(0, 5)

  const priorityActionRows: PriorityActionRow[] = []
  {
    const criticalHigh = teamsNeedingAttention.filter((t) => t.riskLevel === 'Critical' || t.riskLevel === 'High')
    if (criticalHigh.length)
      priorityActionRows.push({
        priority: 'High',
        action: 'Schedule manager-led listening check-ins',
        appliesTo: criticalHigh.map((t) => t.team).join(', '),
        reason: 'Mood and/or engagement declined materially this period',
      })
    const engIssue = teamsNeedingAttention.filter((t) => t.riskLevel !== 'Watch' && (t.engagementRate ?? 100) < companyEngagement)
    if (engIssue.length)
      priorityActionRows.push({
        priority: 'Medium',
        action: 'Reinforce participation expectations',
        appliesTo: engIssue.map((t) => t.team).join(', '),
        reason: 'Engagement is below the company average',
      })
    const watchers = teamsNeedingAttention.filter((t) => t.riskLevel === 'Watch')
    if (watchers.length)
      priorityActionRows.push({
        priority: 'Low',
        action: 'Monitor and grow participation before drawing conclusions',
        appliesTo: watchers.map((t) => t.team).join(', '),
        reason: 'Sample sizes are too small for a confident read',
      })
    if (topPerformingTeams.length)
      priorityActionRows.push({
        priority: 'Medium',
        action: 'Recognize and learn from strong teams',
        appliesTo: topPerformingTeams.map((t) => t.team).join(', '),
        reason: 'High or improving mood and engagement worth replicating',
      })
  }
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
    optedInPopulation,
    activeEmployeeCount: null,
    responseRate: engagementRate,
    responseRateChange: engagementRateChange,
    uniqueParticipants,
    repeatResponderConcentration: 'Cannot determine repeat-responder concentration until stable employee IDs are available across months.',
    silentPopulationRisk: 'Engagement rate uses unique employees checking in divided by total opted-in employees. Add active employee count later to measure eligible-population coverage.',
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
  const priorThree = customer.months.slice(Math.max(0, currentIndex - 3), currentIndex)
  const currentEmotionCounts = new Map<string, number>()
  const previousEmotionCounts = new Map<string, number>()
  for (const r of records) for (const e of r.emotions) currentEmotionCounts.set(e, (currentEmotionCounts.get(e) ?? 0) + 1)
  for (const r of prevRecords) for (const e of r.emotions) previousEmotionCounts.set(e, (previousEmotionCounts.get(e) ?? 0) + 1)
  const emotionChanges = [...currentEmotionCounts.entries()].map(([emotion, count]) => ({ emotion, change: count - (previousEmotionCounts.get(emotion) ?? 0), count })).sort((a,b) => Math.abs(b.change) - Math.abs(a.change)).slice(0,3)
  const neutralPct = pct(moods.filter((m) => m === 3).length, moods.length)
  const prevNeutralPct = prevMoods.length ? pct(prevMoods.filter((m) => m === 3).length, prevMoods.length) : 0
  const negativePct = pct(moods.filter((m) => m <= 2).length, moods.length)
  const prevNegativePct = prevMoods.length ? pct(prevMoods.filter((m) => m <= 2).length, prevMoods.length) : 0
  const teamIntelligence = allTeams.map((t) => {
    const teamRecords = teamMap.get(t.team) ?? []
    const teamMoods = teamRecords.map((r) => r.mood)
    const teamComments = teamRecords.filter((r) => r.comments.trim())
    const posCount = teamMoods.filter((m) => m >= 4).length
    const neuCount = teamMoods.filter((m) => m === 3).length
    const negCount = teamMoods.filter((m) => m <= 2).length
    const text = teamComments.map((r) => r.comments.toLowerCase()).join(' ')
    const themes = [
      contains(text, ['stress', 'stressed', 'overwhelmed', 'exhausted', 'behind']) ? 'workload / burnout pressure' : '',
      contains(text, ['appreciate', 'grateful', 'appreciated', 'helping', 'support']) ? 'recognition / support' : '',
      contains(text, ['manager', 'supervisor', 'power', 'talks', 'communication']) ? 'manager communication' : '',
      contains(text, ['deal', 'opportunity', 'closed']) ? 'progress and wins' : '',
      contains(text, ['vacancies', 'positions', 'staffing']) ? 'staffing / coverage' : '',
    ].filter(Boolean)
    const severity = t.sampleWarning ? 'Watchlist' as const : riskRank(t.risk) >= 4 ? 'High' as const : riskRank(t.risk) >= 2 ? 'Watchlist' as const : (t.change ?? 0) > 0.2 ? 'Positive Momentum' as const : 'Stable' as const
    const privacyNote = teamComments.length < 3 ? 'Comment themes suppressed or generalized because fewer than 3 comments are available.' : undefined
    return {
      ...t,
      positiveCount: posCount,
      neutralCount: neuCount,
      negativeCount: negCount,
      positivePct: pct(posCount, teamMoods.length),
      neutralPct: pct(neuCount, teamMoods.length),
      negativePct: pct(negCount, teamMoods.length),
      participationTrend: previous ? teamRecords.length - (prevTeamMap.get(t.team)?.length ?? 0) : null,
      commentThemes: teamComments.length >= 3 ? themes : [],
      keyConcernOrStrength: severity === 'Positive Momentum' ? 'Positive momentum worth reinforcing and learning from.' : severity === 'High' ? 'Below-average mood and/or sentiment movement warrants direct manager attention.' : t.sampleWarning ? 'Signal is too small for a firm conclusion; increase participation first.' : 'No acute signal; continue monitoring and reinforce positive practices.',
      managerAction: severity === 'High' ? `Schedule a manager listening session with ${t.team} focused on workload, staffing, communication, and recognition.` : t.sampleWarning ? `Increase sampling in ${t.team} before drawing strong conclusions from this score.` : severity === 'Positive Momentum' ? `Capture what ${t.team} is doing well and consider sharing practices with peer managers.` : `Review ${t.team}'s neutral responses and ask what would move employees from okay to positive.`,
      severity,
      privacyNote,
    }
  })
  const whatChanged = [
    { title: 'Morale direction', detail: monthChange === null ? 'No prior-month comparison is available.' : `Average mood moved ${monthChange > 0 ? 'up' : monthChange < 0 ? 'down' : 'flat'} ${Math.abs(monthChange).toFixed(2)} points versus ${previous?.label}.`, severity: monthChange !== null && monthChange < -0.25 ? 'Watchlist' as const : monthChange !== null && monthChange > 0.2 ? 'Positive Momentum' as const : 'Stable' as const, confidence: reportConfidence, meaning: monthChange !== null && Math.abs(monthChange) >= 0.2 ? 'Large enough to warrant leadership attention.' : 'Likely normal fluctuation unless it repeats next month.' },
    { title: 'Positive sentiment movement', detail: positiveChange === null ? 'No prior-month comparison is available.' : `Positive sentiment changed ${positiveChange > 0 ? '+' : ''}${positiveChange} points.`, severity: positiveChange !== null && positiveChange < -5 ? 'Watchlist' as const : positiveChange !== null && positiveChange > 5 ? 'Positive Momentum' as const : 'Stable' as const, confidence: reportConfidence, meaning: 'Positive sentiment is a stronger retention signal than average mood alone.' },
    { title: 'Neutral / negative movement', detail: `Neutral sentiment is ${neutralPct}% (${neutralPct - prevNeutralPct > 0 ? '+' : ''}${round(neutralPct - prevNeutralPct,1)} pts); negative sentiment is ${negativePct}% (${negativePct - prevNegativePct > 0 ? '+' : ''}${round(negativePct - prevNegativePct,1)} pts).`, severity: negativePct - prevNegativePct > 3 ? 'High' as const : neutralPct - prevNeutralPct > 5 ? 'Watchlist' as const : 'Stable' as const, confidence: reportConfidence, meaning: 'Rising neutral sentiment can be an early warning before employees become openly negative.' },
    { title: 'Response volume', detail: participationChange === null ? 'No prior-month participation comparison is available.' : `Responses changed by ${participationChange > 0 ? '+' : ''}${participationChange} versus ${previous?.label}.`, severity: participationChange !== null && participationChange < -20 ? 'Watchlist' as const : 'Stable' as const, confidence: 'Medium' as const, meaning: 'Engagement quality matters because a shrinking respondent base can hide silent-population risk.' },
    { title: 'Largest team declines', detail: decliningTeams.length ? decliningTeams.map((t) => `${t.team} (${t.change})`).join(', ') : 'No meaningful team-level decline detected above threshold.', severity: decliningTeams.length ? 'Watchlist' as const : 'Stable' as const, confidence: decliningTeams.some((t) => t.confidence === 'Low' || t.confidence === 'Provisional') ? 'Low' as const : 'Medium' as const, meaning: 'Team movement is more actionable when supported by adequate response volume.' },
    { title: 'Largest team increases', detail: improvingTeams.length ? improvingTeams.map((t) => `${t.team} (+${t.change})`).join(', ') : 'No meaningful team-level increase detected above threshold.', severity: improvingTeams.length ? 'Positive Momentum' as const : 'Stable' as const, confidence: improvingTeams.some((t) => t.confidence === 'Low' || t.confidence === 'Provisional') ? 'Low' as const : 'Medium' as const, meaning: 'Improving teams may reveal practices worth replicating.' },
    { title: 'Emotion mix changes', detail: emotionChanges.length ? emotionChanges.map((e) => `${e.emotion} ${e.change > 0 ? '+' : ''}${e.change}`).join(', ') : 'No emotion trend comparison available.', severity: emotionChanges.some((e) => ['Overwhelmed','Frustrated','Upset','Sad','Worried'].includes(e.emotion) && e.change > 3) ? 'Watchlist' as const : 'Stable' as const, confidence: 'Medium' as const, meaning: 'Emotion shifts help explain why the score moved, not just that it moved.' },
  ]
  const healthSummary = {
    rating: healthScore >= 82 ? 'Strong' as const : healthScore >= 74 ? 'Healthy' as const : healthScore >= 64 ? 'Mixed' as const : healthScore >= 52 ? 'Watchlist' as const : 'At Risk' as const,
    score: healthScore,
    reason: `${severity(healthScore)} overall signal: mood is ${avgMood.toFixed(2)}, positive sentiment is ${positivePct}%, ${watchTeams.length} teams are on the watchlist, and report confidence is ${reportConfidence.toLowerCase()}.`,
    components: [
      { label: 'Mood', score: Math.round((avgMood / 5) * 100), note: `${avgMood.toFixed(2)} average mood` },
      { label: 'Positive sentiment', score: Math.round(positivePct), note: `${positivePct}% positive` },
      { label: 'Engagement quality', score: engagementScore, note: engagement.reliability },
      { label: 'Team consistency', score: Math.max(0, 100 - watchTeams.length * 12 - lowConfidenceTeams.length * 4), note: `${watchTeams.length} watchlist teams; ${lowConfidenceTeams.length} low-sample teams` },
      { label: 'Comment signal', score: Math.max(0, 85 - commentIntelligence.stressBurnoutCount * 4), note: `${commentIntelligence.stressBurnoutCount} stress/burnout signals` },
    ],
  }
  const persistentTeams = teamIntelligence.filter((t) => {
    const history = customer.months.slice(Math.max(0, currentIndex - 2), currentIndex + 1).map((m) => {
      const rs = m.responses.filter((r) => r.team === t.team).map((r) => r.mood)
      return rs.length ? avg(rs) : null
    })
    return history.length >= 3 && history.every((v) => v !== null && v < 3.4)
  })
  const riskWatchlist = [
    ...watchTeams.slice(0, 4).map((t) => ({ title: t.team, severity: riskRank(t.risk) >= 4 ? 'High' as const : 'Watchlist' as const, signal: `${t.avgMood.toFixed(2)} avg mood, ${t.positivePct}% positive, ${t.responses} responses. ${t.sampleWarning ? 'Low-confidence sample.' : t.interpretation}`, recommendedAction: `Manager should run a focused listening check-in and close one visible blocker before the next report.`, confidence: t.confidence })),
    ...persistentTeams.map((t) => ({ title: `${t.team} persistence risk`, severity: 'High' as const, signal: 'Below-average mood appears persistent across the recent period.', recommendedAction: 'Treat as a management operating issue, not a one-month anomaly.', confidence: t.confidence })),
    ...(negativePct > prevNegativePct + 3 ? [{ title: 'Rising negative sentiment', severity: 'High' as const, signal: `Negative sentiment increased ${round(negativePct - prevNegativePct,1)} points.`, recommendedAction: 'Review low-mood comments and require team-level response plans where concentrated.', confidence: reportConfidence }] : []),
  ].slice(0, 6)
  const positiveMomentum = [
    ...topTeams.slice(0, 3).map((t) => ({ title: t.team, severity: 'Positive Momentum' as const, signal: `${t.avgMood.toFixed(2)} avg mood with ${t.positivePct}% positive sentiment.`, recommendedAction: 'Identify the management practices creating this signal and share one replicable behavior with peer leaders.', confidence: t.confidence })),
    ...(commentIntelligence.recognitionCount ? [{ title: 'Recognition is working', severity: 'Positive Momentum' as const, signal: `${commentIntelligence.recognitionCount} recognition/support comment signals.`, recommendedAction: 'Preserve visible appreciation and manager backing as a retention lever.', confidence: commentIntelligence.confidence }] : []),
  ].slice(0, 5)
  const managerReport = {
    available: true,
    privacyThreshold: 5,
    description: 'Manager reports should be scoped to that manager’s own team plus company average only. Other team details stay hidden, comments are shown only when privacy thresholds are met, and every manager report includes practical next actions.',
    eligibleTeams: allTeams.filter((t) => t.responses >= 5).map((t) => t.team),
    sampleWarningTeams: allTeams.filter((t) => t.responses < 5).map((t) => t.team),
    safeguards: ['Manager visibility: own team plus company average only.', 'Suppress or paraphrase comments when fewer than 3 comments exist.', 'Show sample-size warnings below 5 responses.', 'Executive report may rank teams; manager reports must not expose peer-team rankings.', 'PDF outputs should support both a short executive brief and a full 10–15 page intelligence report.', 'Tone should stay practical, direct, and operator-ready.'],
  }

  const intelligencePoints = [
    { title: 'Organizational health', finding: `${severity(healthScore)} health score with ${retentionRisk} retention risk.`, whyItMatters: 'The organization is stable enough for targeted intervention, but team variance can become retention risk if ignored.', leadershipMove: 'Focus on watch teams first while reinforcing positive-team behaviors.', monitorNext: 'Watch whether average mood rebounds and whether negative comments cluster in the same teams.', confidence: reportConfidence },
    { title: 'Culture and burnout signal', finding: `${commentIntelligence.stressBurnoutCount} stress/burnout comment signal(s) and ${commentIntelligence.recognitionCount} recognition signal(s).`, whyItMatters: 'Positive culture signals coexist with operational strain; both are useful levers for retention.', leadershipMove: 'Ask managers to separate workload fixes from recognition/communication fixes.', monitorNext: 'Track workload language, manager behavior comments, and low-mood comments next month.', confidence: commentIntelligence.confidence },
    { title: 'Engagement reliability', finding: `${uniqueParticipants} unique employees checked in out of ${optedInPopulation} opted-in employees (${engagementRate}%).`, whyItMatters: 'The signal is useful, but full eligible-population coverage still requires active employee count.', leadershipMove: 'Monitor opted-in coverage and compare participation quality by team.', monitorNext: 'Response rate, unique responders, and repeat-responder concentration.', confidence: engagement.confidence },
  ]
  const improvements = [
    'Add active employee count, opted-in population, and stable anonymized employee IDs to calculate response rate and repeat-responder concentration.',
    'Normalize team naming across months to improve team trend reliability and reduce false variance.',
    'Capture follow-up owner, request date, first-response date, closed date, and closure notes to score leadership responsiveness.',
    'Add AI-assisted comment taxonomy with human review: workload, recognition, manager behavior, staffing, wellbeing, safety, and retention intent.',
    'Create two PDF outputs: a short 3–5 page executive brief and a full 10–15 page intelligence report with appendix detail.',
  ]
  const engagementDropPct = engagementRateChange !== null && engagementRateChange <= -5
  const engagementDropCount = participationChange !== null && participationChange < -10
  const teamEngagementDrop = allTeams.some((t) => records.filter((r) => r.team === t.team).length - (prevTeamMap.get(t.team)?.length ?? 0) <= -5)
  const engagementDrop = engagementDropPct || engagementDropCount || teamEngagementDrop
  const managerToolsUrl = 'https://www.trylollipop.com/resources-page-hidden'
  const employeeEmailBody = 'Hi team,\n\nPlease take a minute to complete this period’s Lollipop check-in. We use Lollipop to better understand how employees are doing, identify where support is needed, and improve the employee experience. Your feedback helps leadership spot workload, communication, recognition, and wellbeing trends early.\n\nWhile your check-ins are optional, your participation makes the feedback more representative and helps leadership see patterns before they become bigger problems. Thank you for participating.\n'
  const managerEmailBody = 'Hi managers,\n\nPlease review your Lollipop manager tools before the next team meeting. Use the team insights to identify participation gaps, follow up on watchlist signals, and encourage employees to complete their check-ins. Manager resources are here: https://www.trylollipop.com/resources-page-hidden\n\nSuggested action: mention Lollipop during your team meeting and remind employees why the company implemented it — to listen earlier, support teams faster, and improve the workplace experience.\n'
  const giveawayEmailBody = 'Hi team,\n\nTo encourage everyone to complete this month’s Lollipop check-in, we are adding a small participation giveaway. Please complete your check-in by the deadline to be included.\n\nThe goal is simple: the more employees who check in, the better leadership can understand what is working, where support is needed, and how to improve the employee experience.\n\nThank you for helping us keep the feedback loop active.\n'
  const employeeEmail = `mailto:?subject=${encodeURIComponent('Reminder: Please complete your Lollipop check-in')}&body=${encodeURIComponent(employeeEmailBody)}`
  const managerEmail = `mailto:?subject=${encodeURIComponent('Using Lollipop manager tools this month')}&body=${encodeURIComponent(managerEmailBody)}`
  const giveawayEmail = `mailto:?subject=${encodeURIComponent('Lollipop check-in participation giveaway')}&body=${encodeURIComponent(giveawayEmailBody)}`
  const recommendations = [
    engagementDrop
      ? { title: 'Rebuild check-in participation', priority: 'P1' as const, urgency: 'High', impact: 'High', difficulty: 'Low', owner: 'HR / operations leader + managers', nextStep: `Weekly engagement ${engagementRateChange !== null ? `moved ${engagementRateChange > 0 ? '+' : ''}${engagementRateChange} pts` : 'softened'} in the most recent week of the period. Use the new giveaway feature, team-meeting reminders, employee email notices, and manager follow-up to restore participation before the next report.`, why: 'When company or team engagement drops, leadership loses visibility into silent-population risk and the report becomes less representative.', confidence: engagement.confidence, trigger: 'Use when company engagement falls 5+ percentage points, response volume falls by 10+ check-ins, or a team shows a meaningful participation decline.', links: [{ label: 'Draft employee reminder email', href: employeeEmail }, { label: 'Draft giveaway email', href: giveawayEmail }, { label: 'Manager tools', href: managerToolsUrl }] }
      : { title: 'Maintain check-in participation cadence', priority: 'P2' as const, urgency: 'Medium', impact: 'High', difficulty: 'Low', owner: 'HR / operations leader + managers', nextStep: 'Keep Lollipop visible through team-meeting reminders, periodic employee email notices, manager prompts, and optional giveaways when participation begins to soften.', why: 'Participation quality protects the usefulness of the report and helps leadership hear from more than the most vocal employees.', confidence: engagement.confidence, trigger: 'Use as the standard operating cadence; escalate to a giveaway/reminder push if engagement drops 5+ percentage points.', links: [{ label: 'Draft employee reminder email', href: employeeEmail }, { label: 'Draft giveaway email', href: giveawayEmail }, { label: 'Manager tools', href: managerToolsUrl }] },
    { title: 'Activate managers on watch-team signals', priority: 'P1' as const, urgency: retentionRisk === 'Elevated' || retentionRisk === 'High' ? 'High' : 'Medium', impact: 'High', difficulty: 'Medium', owner: 'Operations leader + HR partner', nextStep: `Ask managers for ${watchTeams.slice(0, 2).map((t) => t.team).join(' and ') || 'watchlist teams'} to review the Lollipop Manager tools before their next team meeting, remind employees to complete check-ins, and identify one workload, communication, or recognition blocker to close.`, why: 'Risk is concentrated by team; managers need a practical operating prompt, not only a score in a report.', confidence: 'Medium' as const, trigger: 'Use when a team has low mood, negative month-over-month movement, low engagement, or repeated watchlist status.', links: [{ label: 'Manager tools', href: managerToolsUrl }, { label: 'Draft manager email', href: managerEmail }] },
    { title: 'Operationalize follow-up accountability', priority: 'P2' as const, urgency: 'Medium', impact: 'High', difficulty: 'Medium', owner: 'HR leader + team managers', nextStep: 'Require status, owner, first-response date, and closure note for every follow-up request. Remind managers to use the manager tools to track action items and close the feedback loop.', why: 'Responsiveness is a leadership-effectiveness signal; missing data prevents Lollipop from proving closure.', confidence: responsiveness.confidence, trigger: 'Use when follow-up requests are open, incomplete, or missing owner/status data.', links: [{ label: 'Manager tools', href: managerToolsUrl }, { label: 'Draft manager email', href: managerEmail }] },
    { title: 'Reinforce positive culture drivers', priority: 'P3' as const, urgency: 'Medium', impact: 'Medium', difficulty: 'Low', owner: 'Frontline managers', nextStep: 'Identify what top teams are doing differently and turn it into a manager coaching prompt.', why: 'Recognition, support, and visible progress appear to be meaningful positive sentiment drivers.', confidence: commentIntelligence.confidence, trigger: 'Use when positive sentiment or comment themes identify manager behaviors worth repeating.' },
  ]
  return { customerName: customer.name, month: current.month, label: current.label, previousLabel: previous?.label, responseCount: records.length, avgMood, avgMoodChange: monthChange, positivePct, positiveChange, negativeCount, engagementScore, healthScore, healthSeverity: severity(healthScore), retentionRisk, followUpRequests, followUpCompletionPct, unsubscribedCount: customer.unsubscribed.length, reportConfidenceScore, reportConfidence, confidenceRationale: `${records.length} responses, ${commentIntelligence.commentCount} comments, ${allTeams.filter((t) => t.sampleWarning).length} low-sample teams, and ${followUpRequests ? 'available' : 'missing'} follow-up workflow data.`, topTeams, watchTeams, improvingTeams, decliningTeams, engagementImprovingTeams, engagementDecliningTeams, lowConfidenceTeams, allTeams, moodDistribution, topEmotions, monthlyTrend, comments: records.map((r) => r.comments).filter(Boolean).slice(0, 8), executiveSummary, strategicNarrative, intelligencePoints, leadershipAttention, commentIntelligence, responsiveness, engagement, trend, improvements, recommendations, healthSummary, whatChanged, teamIntelligence, riskWatchlist, positiveMomentum, individualRetentionRisks, managerReport, engagementSummary, engagementRisks, teamsNeedingAttention, topPerformingTeams, priorityActionRows }
}
