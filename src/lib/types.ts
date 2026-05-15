export type Severity = 'Healthy' | 'Stable' | 'Watch' | 'Intervention Needed' | 'Elevated Risk'
export type RetentionRisk = 'Low' | 'Watch' | 'Elevated' | 'High' | 'Critical'
export type Confidence = 'High' | 'Medium' | 'Low' | 'Provisional'

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
  confidence: Confidence
  interpretation: string
}

export type IntelligencePoint = {
  title: string
  finding: string
  whyItMatters: string
  leadershipMove: string
  monitorNext: string
  confidence: Confidence
}

export type CommentTheme = {
  theme: string
  count: number
  type: 'Work' | 'Wellbeing' | 'Positive' | 'Risk' | 'Leadership'
  signal: string
}

export type CommentIntelligence = {
  commentCount: number
  workRelatedCount: number
  wellbeingCount: number
  positiveCount: number
  stressBurnoutCount: number
  recognitionCount: number
  leadershipCommunicationCount: number
  themes: CommentTheme[]
  representativeComments: string[]
  revealing: string
  emergingRisks: string[]
  confidence: Confidence
}

export type ResponsivenessIntelligence = {
  requests: number
  completed: number
  open: number
  completionPct: number | null
  avgTimeToResponse: string
  agingUnresolved: string
  managerTeamResponsiveness: string
  status: string
  recommendation: string
  confidence: Confidence
}

export type EngagementIntelligence = {
  optedInPopulation: number | null
  activeEmployeeCount: number | null
  responseRate: number | null
  uniqueParticipants: number
  repeatResponderConcentration: string
  silentPopulationRisk: string
  participationChange: number | null
  reliability: string
  confidence: Confidence
}

export type TrendIntelligence = {
  threeMonthAvgMood: number | null
  rollingPositivePct: number | null
  bestMonth: string
  worstMonth: string
  volatility: string
  meaningfulMovement: string
  improvingMetrics: string[]
  decliningMetrics: string[]
  confidence: Confidence
}

export type PrioritizedAction = {
  title: string
  priority: 'P1' | 'P2' | 'P3'
  urgency: string
  impact: string
  difficulty: string
  owner: string
  nextStep: string
  why: string
  confidence: Confidence
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
  reportConfidenceScore: number
  reportConfidence: Confidence
  confidenceRationale: string
  topTeams: TeamMetric[]
  watchTeams: TeamMetric[]
  improvingTeams: TeamMetric[]
  decliningTeams: TeamMetric[]
  lowConfidenceTeams: TeamMetric[]
  allTeams: TeamMetric[]
  moodDistribution: Array<{ mood: string; count: number; pct: number; color: string }>
  topEmotions: Array<{ emotion: string; count: number; pct: number }>
  monthlyTrend: Array<{ label: string; avgMood: number; positivePct: number; responses: number }>
  comments: string[]
  executiveSummary: string
  strategicNarrative: string[]
  intelligencePoints: IntelligencePoint[]
  leadershipAttention: string[]
  commentIntelligence: CommentIntelligence
  responsiveness: ResponsivenessIntelligence
  engagement: EngagementIntelligence
  trend: TrendIntelligence
  improvements: string[]
  recommendations: PrioritizedAction[]
}
