export type Severity = 'Healthy' | 'Stable' | 'Watch' | 'Intervention Needed' | 'Elevated Risk'
export type RetentionRisk = 'Low' | 'Watch' | 'Elevated' | 'High' | 'Critical'

export type ResponseRecord = {
  id: string
  firstName: string
  lastName: string
  team: string
  date: string
  mood: number
  emotions: string[]
  followUpRequested: boolean
  followUpStatus: string
  comments: string
}

export type MonthData = { month: string; label: string; responses: ResponseRecord[] }
export type CustomerData = { id: string; name: string; industry: string; demo: boolean; months: MonthData[]; unsubscribed: Array<{ firstName: string; lastName: string; date: string; type: string }> }

export type TeamMetric = {
  team: string
  responses: number
  avgMood: number
  positivePct: number
  change: number | null
  engagementShare: number
  risk: RetentionRisk
  sampleWarning: boolean
}

export type ReportMetrics = {
  customerName: string
  month: string
  label: string
  previousLabel?: string
  responseCount: number
  avgMood: number
  avgMoodChange: number | null
  positivePct: number
  positiveChange: number | null
  negativeCount: number
  engagementScore: number
  healthScore: number
  healthSeverity: Severity
  retentionRisk: RetentionRisk
  followUpRequests: number
  followUpCompletionPct: number | null
  unsubscribedCount: number
  topTeams: TeamMetric[]
  watchTeams: TeamMetric[]
  allTeams: TeamMetric[]
  moodDistribution: Array<{ mood: string; count: number; pct: number }>
  topEmotions: Array<{ emotion: string; count: number; pct: number }>
  monthlyTrend: Array<{ label: string; avgMood: number; positivePct: number; responses: number }>
  comments: string[]
  executiveSummary: string
  leadershipAttention: string[]
  improvements: string[]
  recommendations: Array<{ title: string; urgency: string; impact: string; difficulty: string; reason: string; action: string }>
}
