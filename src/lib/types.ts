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
export type RosterEntry = { id?: string; firstName: string; lastName: string; email?: string; source?: string }
/** A roster snapshot effective from a given month (inclusive). Months before
    the earliest version use that earliest version. */
export type RosterVersion = { effectiveFrom: string; roster: RosterEntry[] }
export type CustomerData = { id: string; name: string; industry: string; demo: boolean; months: MonthData[]; unsubscribed: Array<{ firstName: string; lastName: string; date: string; type: string }>; optedInPopulation?: number; roster?: RosterEntry[]; rosterVersions?: RosterVersion[] }

export type WeeklyEngagementPoint = {
  weekStart: string
  weekLabel: string
  uniqueRespondents: number
  offRosterRespondents: number
  effectiveRoster: number
  engagementRate: number
}
export type OffRosterRespondent = { firstName: string; lastName: string; firstSeen: string; monthLabel: string }
export type CheckInCompletion = { name: string; completed: number; total: number; onRoster: boolean }
export type OptedOutEmployee = { name: string; date?: string; type?: string }

export type EngagementSummary = {
  hasRoster: boolean
  rosterCount: number
  uniqueRespondents: number
  offRosterCount: number
  effectiveRoster: number
  engagementRate: number
  offRosterList: OffRosterRespondent[]
  /** Detail-table series: the reporting month's weeks, or the quarter's weeks in quarter view. */
  weekly: WeeklyEngagementPoint[]
  /** Chart series: always the trailing 3 months ending at the reporting month. */
  weeklyTrailing: WeeklyEngagementPoint[]
  /** Engagement change of the latest week versus the prior week (pp). Null when fewer than 2 weeks. */
  weeklyChange: number | null
  /** Window the weekly detail series covers, e.g. 'May 2026' or 'Q2 2026'. */
  weeklyWindowLabel: string
  /** Employees who completed fewer than the total check-in deliveries in the window, fewest first. */
  checkInCompletion: CheckInCompletion[]
  /** Roster employees who have opted out of check-ins. */
  optedOut: OptedOutEmployee[]
}

export type WeeklyHistoryPoint = { weekStart: string; label: string; monthLabel: string; avgMood: number }

export type TeamRiskLevel = 'Critical' | 'High' | 'Moderate' | 'Watch'
export type TeamAttention = {
  team: string
  riskLevel: TeamRiskLevel
  whyItMatters: string
  suggestedFocus: string
  avgMood: number
  moodChange: number | null
  engagementRate: number | null
  engagementChangePts: number | null
}
export type TopPerformingTeam = { team: string; strength: string; why: string }
export type EngagementRisk = { team: string; issue: string; currentEngagement: number; change: string }
export type PriorityActionRow = { priority: 'High' | 'Medium' | 'Low'; action: string; appliesTo: string; reason: string; owner: string; timing: string }
export type PriorityActionDetail = { title: string; description: string; appliesTo: string; owner: string; timing: string; links: Array<{ label: string; href: string }> }

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
  history: Array<{ month: string; label: string; avgMood: number }>
  weeklyHistory: WeeklyHistoryPoint[]
  /** Unique employees (person-level) who checked in for this team this month. */
  uniqueRespondents: number
  /** Change in unique respondents versus the prior month; null when no prior month. */
  uniqueRespondentsChange: number | null
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
  executiveSummary: string
  themeTable: Array<{ theme: string; trendDirection: 'Increasing' | 'Stable' | 'Decreasing'; sentimentType: 'Positive' | 'Mixed' | 'Negative'; primaryTeams: string; interpretation: string; suggestion: string }>
  positiveDrivers: Array<{ observation: string; suggestion: string }>
  attentionAreas: Array<{ observation: string; suggestion: string }>
  stressAnalysis: Array<{ category: 'Work-Related' | 'Personal' | 'Mixed'; count: number; pct: number; interpretation: string }>
  teamSpecificInsights: Array<{ team: string; insight: string; category: string }>
  voiceQuotes: string[]
  leadershipRecommendations: string[]
  priorComparison: CommentPriorComparison
}

export type CommentPriorComparison = {
  hasPriorData: boolean
  improving: Array<{ theme: string; currentCount: number; priorCount: number; delta: number }>
  persisting: Array<{ theme: string; currentCount: number; priorCount: number }>
  worsening: Array<{ theme: string; currentCount: number; priorCount: number; delta: number }>
  faded: Array<{ theme: string; priorCount: number }>
  spreading: Array<{ theme: string; currentTeams: number; priorTeams: number }>
  newThemes: Array<{ theme: string; currentCount: number }>
  persistingTeams: Array<{ theme: string; teams: string[] }>
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
  responseRateChange: number | null
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
  trigger?: string
  links?: Array<{ label: string; href: string }>
}

export type RiskSeverity = 'Critical' | 'High' | 'Watchlist' | 'Stable' | 'Positive Momentum'

export type ChangeInsight = {
  title: string
  detail: string
  severity: RiskSeverity
  confidence: Confidence
  meaning: string
}

export type TeamIntelligence = TeamMetric & {
  positiveCount: number
  neutralCount: number
  negativeCount: number
  positivePct: number
  neutralPct: number
  negativePct: number
  participationTrend: number | null
  commentThemes: string[]
  keyConcernOrStrength: string
  managerAction: string
  severity: RiskSeverity
  privacyNote?: string
}

export type ManagerReport = {
  available: boolean
  privacyThreshold: number
  description: string
  eligibleTeams: string[]
  sampleWarningTeams: string[]
  safeguards: string[]
}

export type HealthScoreSummary = {
  rating: 'Strong' | 'Healthy' | 'Mixed' | 'Watchlist' | 'At Risk'
  score: number
  reason: string
  components: Array<{ label: string; score: number; note: string }>
}

export type AlertInsight = {
  title: string
  severity: RiskSeverity
  signal: string
  recommendedAction: string
  confidence: Confidence
}

export type IndividualRetentionRisk = {
  employeeName: string
  team: string
  riskLevel: 'Monitor' | 'Follow-Up Suggested' | 'Manager Action Needed' | 'Urgent HR Review'
  currentMood: number
  lowCheckIns: number
  trend: string
  drivers: string[]
  recommendedAction: string
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
  engagementImprovingTeams: TeamMetric[]
  engagementDecliningTeams: TeamMetric[]
  decliningTeams: TeamMetric[]
  lowConfidenceTeams: TeamMetric[]
  allTeams: TeamMetric[]
  moodDistribution: Array<{ mood: string; label: string; count: number; pct: number; color: string; emoji: string }>
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
  healthSummary: HealthScoreSummary
  whatChanged: ChangeInsight[]
  teamIntelligence: TeamIntelligence[]
  riskWatchlist: AlertInsight[]
  positiveMomentum: AlertInsight[]
  individualRetentionRisks: IndividualRetentionRisk[]
  managerReport: ManagerReport
  engagementSummary: EngagementSummary
  engagementRisks: EngagementRisk[]
  teamsNeedingAttention: TeamAttention[]
  topPerformingTeams: TopPerformingTeam[]
  priorityActionRows: PriorityActionRow[]
  priorityActionDetails: PriorityActionDetail[]
  /** Three-sentence executive assessment for the Leadership Priorities section. */
  leadershipAssessment: string
}
