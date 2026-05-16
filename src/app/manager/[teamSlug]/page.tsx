import React from 'react'
import Link from 'next/link'
import { getReport, customers, slugifyTeam } from '@/lib/reportMetrics'
import {
  SectionHeader,
  KpiCard,
  TrendDelta,
  Delta,
} from '../../_components/ui'
import PieChart from '../../_components/PieChart'
import MiniMoodTrend from '../../_components/MiniMoodTrend'
import TopBar from '../../_components/TopBar'

const SEVERITY_LABEL: Record<string, string> = {
  'Positive Momentum': 'Positive momentum',
  Stable: 'Stable',
  Watchlist: 'Watch team',
  High: 'Needs attention',
}

const SEVERITY_HEALTH_CLASS: Record<string, string> = {
  'Positive Momentum': 'health-strong',
  Stable: 'health-mixed',
  Watchlist: 'health-watchlist',
  High: 'health-at-risk',
}

const managerToolsUrl = 'https://www.trylollipop.com/resources-page-hidden'

type Tool = { key: string; name: string; url: string; whenToUse: string }
const TOOLS: Record<string, Tool> = {
  quickInsights: {
    key: 'quickInsights',
    name: 'Quick insights',
    url: 'https://www.trylollipop.com/resources/quick-insights',
    whenToUse:
      'Short, scannable manager guidance for reading team signals and choosing the right next move.',
  },
  conversationStarters: {
    key: 'conversationStarters',
    name: 'Conversation starters',
    url: 'https://www.trylollipop.com/conversation-starters-hidden',
    whenToUse:
      'Use when scheduling a 1:1 or listening conversation — especially with employees showing low mood or workload pressure.',
  },
  smallAuthenticGestures: {
    key: 'smallAuthenticGestures',
    name: 'Small authentic gestures',
    url: 'https://www.trylollipop.com/small-authentic-gestures-hidden',
    whenToUse:
      'Use to reinforce recognition and visible support without expensive programs — low-cost, high-signal manager habits.',
  },
  connectionExercises: {
    key: 'connectionExercises',
    name: 'Connection exercises',
    url: 'https://www.trylollipop.com/connection-exercises-hidden',
    whenToUse:
      'Use to deepen trust on teams that feel disconnected or are coming out of a strained period.',
  },
  meetingIcebreakers: {
    key: 'meetingIcebreakers',
    name: 'Meeting icebreakers',
    url: 'https://www.trylollipop.com/meeting-icebreakers-hidden',
    whenToUse:
      'Use at the start of team meetings to lift engagement and surface what people are actually thinking.',
  },
}

const TRAINING_VIDEOS = [
  { title: 'Reading your team report', url: 'https://youtu.be/RpLInjIdswM' },
  { title: 'Running a listening conversation', url: 'https://youtu.be/inFoP-yrvqo' },
  { title: 'Recognition that lands', url: 'https://youtu.be/NCgJuUXhXrs' },
  { title: 'Closing the feedback loop', url: 'https://youtu.be/5PCjxElGU4g' },
]

function pickTools(opts: {
  severity: string
  avgMood: number
  positivePct: number
  participationTrend: number | null
  lowSample: boolean
  hasWorkloadTheme: boolean
}): Tool[] {
  const out: Tool[] = []
  const add = (k: keyof typeof TOOLS) => {
    if (!out.find((t) => t.key === k)) out.push(TOOLS[k])
  }

  if (opts.severity === 'High' || opts.avgMood < 3.5) {
    add('conversationStarters')
    add('quickInsights')
  }
  if (opts.severity === 'Watchlist' || (opts.positivePct < 55 && opts.avgMood < 3.9)) {
    add('conversationStarters')
    add('smallAuthenticGestures')
  }
  if (opts.hasWorkloadTheme) {
    add('quickInsights')
    add('conversationStarters')
  }
  if (opts.participationTrend !== null && opts.participationTrend < 0) {
    add('meetingIcebreakers')
  }
  if (opts.severity === 'Positive Momentum' || opts.avgMood >= 4.2) {
    add('connectionExercises')
    add('smallAuthenticGestures')
  }
  if (opts.lowSample) {
    add('meetingIcebreakers')
    add('conversationStarters')
  }
  // Always include a baseline if nothing picked
  if (out.length === 0) {
    add('quickInsights')
    add('conversationStarters')
  }
  return out.slice(0, 3)
}

export default async function ManagerPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>
}) {
  const { teamSlug } = await params
  const customer = customers[0]
  const report = getReport(customer.id)

  const team = report.teamIntelligence.find((t) => slugifyTeam(t.team) === teamSlug)

  if (!team) {
    return (
      <div className="shell manager-page">
        <TopBar title="Manager report" backLink={{ href: '/', label: '← Back to executive report' }} />
        <main className="wrap pages">
          <section className="brief-section">
            <SectionHeader
              eyebrow="Manager report"
              title="Team not found"
              subtitle="We could not find a team matching this URL."
            />
            <div className="card">
              <p>
                The team slug <code>{teamSlug}</code> does not match any team in the current report.
              </p>
              <p>
                <Link href="/">← Back to executive report</Link>
              </p>
            </div>
          </section>
        </main>
      </div>
    )
  }

  const severityLabel = SEVERITY_LABEL[team.severity] ?? team.severity
  const healthClass = SEVERITY_HEALTH_CLASS[team.severity] ?? 'health-mixed'

  const moodDelta = team.avgMood - report.avgMood
  const positiveDelta = team.positivePct - report.positivePct

  const teamSlices = [
    {
      mood: '4',
      label: 'Positive',
      pct: team.positivePct,
      color: '#22c55e',
      count: team.positiveCount,
      emoji: '/emojis/Good.png',
    },
    {
      mood: '3',
      label: 'Neutral',
      pct: team.neutralPct,
      color: '#facc15',
      count: team.neutralCount,
      emoji: '/emojis/Ok.png',
    },
    {
      mood: '2',
      label: 'Negative',
      pct: team.negativePct,
      color: '#ef4444',
      count: team.negativeCount,
      emoji: '/emojis/Bad.png',
    },
  ]

  const lowSample = team.responses < 5
  const hasWorkloadTheme = team.commentThemes.some((t) =>
    /workload|burnout|staffing|coverage/i.test(t),
  )
  const moodMove =
    team.change === null
      ? 'no prior-month comparison'
      : team.change > 0.05
      ? `up ${team.change.toFixed(2)} from prior month`
      : team.change < -0.05
      ? `down ${Math.abs(team.change).toFixed(2)} from prior month`
      : 'flat versus prior month'

  let execSummary = ''
  if (team.severity === 'Positive Momentum') {
    execSummary = `Your team is showing strong mood (${team.avgMood.toFixed(2)}, ${moodMove}) with ${team.positivePct}% positive sentiment. Preserve what's working and consider sharing practices with peer managers.`
  } else if (team.severity === 'High') {
    execSummary = `Mood (${team.avgMood.toFixed(2)}, ${moodMove}) and ${team.positivePct}% positive sentiment are below the company average. Schedule a direct listening conversation this period to identify the most pressing blocker.`
  } else if (team.severity === 'Watchlist') {
    execSummary = `Softer signals this period — mood ${team.avgMood.toFixed(2)} (${moodMove}), ${team.positivePct}% positive. Worth a brief check-in to surface workload, communication, or recognition gaps before they grow.`
  } else if (lowSample) {
    execSummary = `Only ${team.responses} check-ins this period — read the numbers directionally. Encourage more participation to make next month's signal more reliable.`
  } else {
    execSummary = `No acute signal — mood ${team.avgMood.toFixed(2)} (${moodMove}), ${team.positivePct}% positive. Continue your current cadence and reinforce the behaviors that are working.`
  }

  const recommendedTools = pickTools({
    severity: team.severity,
    avgMood: team.avgMood,
    positivePct: team.positivePct,
    participationTrend: team.participationTrend,
    lowSample,
    hasWorkloadTheme,
  })

  return (
    <div className="shell manager-page">
      <TopBar
        title="Manager report"
        backLink={{ href: '/', label: '← Back to executive report' }}
      />

      <main className="wrap pages">
        {/* A. Header */}
        <section className="exec-header brief-section">
          <div className="exec-header-main">
            <p className="h3-micro">Manager report</p>
            <div className="exec-header-title-row">
              <h1 className="client-title">{team.team}</h1>
              <div className={`health-tile ${healthClass}`}>
                <span className="health-label h3-micro">Team status</span>
                <strong>{severityLabel}</strong>
                <small>{team.responses} check-ins</small>
              </div>
            </div>
            <p className="exec-header-meta">
              {report.customerName} · {report.label} ·{' '}
              <span className="muted">Confidence {team.confidence}</span>
            </p>
          </div>
        </section>

        {/* A2. Short executive summary */}
        <section className="brief-section manager-exec-summary">
          <p className="h3-micro">Executive summary</p>
          <p>{execSummary}</p>
        </section>

        {/* B + E. Snapshot KPIs + Mood breakdown side-by-side */}
        <section className="brief-section manager-snapshot-row">
          <div className="manager-snapshot-left">
            <SectionHeader title="Your team snapshot" subtitle="Headline metrics for this reporting period" />
            <div className="kpi-grid kpi-grid-2x2">
              <KpiCard
                label="Average mood"
                value={team.avgMood.toFixed(2)}
                sub={<>out of 5.00</>}
                delta={<TrendDelta value={team.change} />}
                tone={
                  (team.change ?? 0) >= 0.05
                    ? 'green'
                    : (team.change ?? 0) <= -0.05
                    ? 'coral'
                    : 'amber'
                }
              />
              <KpiCard
                label="Positive sentiment"
                value={`${team.positivePct}%`}
                sub={<>of your team&apos;s check-ins</>}
                tone={team.positivePct >= 60 ? 'green' : team.positivePct >= 40 ? 'amber' : 'coral'}
              />
              <KpiCard
                label="Participation"
                value={team.responses}
                sub={<>check-ins</>}
                delta={<TrendDelta value={team.participationTrend} />}
                tone="blue"
              />
              <KpiCard
                label="Confidence"
                value={team.confidence}
                sub={lowSample ? <>Low sample — read directionally</> : <>Enough responses to act on</>}
                tone="neutral"
              />
            </div>
          </div>
          <div className="manager-snapshot-right">
            <SectionHeader title="Mood breakdown" subtitle="How this month's check-ins are distributed" />
            <div className="card" style={{ position: 'relative' }}>
              <div style={{ opacity: lowSample ? 0.55 : 1 }}>
                <PieChart slices={teamSlices} />
              </div>
              {lowSample && (
                <p className="muted" style={{ marginTop: 10 }}>
                  <strong>Low sample.</strong> Fewer than 5 check-ins this period — read the
                  distribution directionally, not as a firm conclusion.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* C + D. Versus company average + Trend, side-by-side */}
        <section className="brief-section manager-compare-row">
          <div className="manager-compare-left">
          <SectionHeader
            title="Your team versus company average"
            subtitle="The only peer comparison in your report — no other team data is shown."
          />
          <div className="card">
            <div style={{ display: 'grid', gap: 14 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <div>
                  <p className="h3-micro">Average mood</p>
                  <strong style={{ fontFamily: 'Georgia, serif', fontSize: 22 }}>
                    {team.avgMood.toFixed(2)}
                  </strong>
                  <small className="muted"> your team</small>
                </div>
                <div>
                  <p className="h3-micro">Company</p>
                  <strong style={{ fontFamily: 'Georgia, serif', fontSize: 22 }}>
                    {report.avgMood.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <p className="h3-micro">Gap</p>
                  <Delta value={Math.round(moodDelta * 100) / 100} />
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  vs. company avg
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: 16,
                  alignItems: 'center',
                  borderTop: '1px solid var(--line)',
                  paddingTop: 14,
                }}
              >
                <div>
                  <p className="h3-micro">Positive sentiment</p>
                  <strong style={{ fontFamily: 'Georgia, serif', fontSize: 22 }}>
                    {team.positivePct}%
                  </strong>
                  <small className="muted"> your team</small>
                </div>
                <div>
                  <p className="h3-micro">Company</p>
                  <strong style={{ fontFamily: 'Georgia, serif', fontSize: 22 }}>
                    {report.positivePct}%
                  </strong>
                </div>
                <div>
                  <p className="h3-micro">Gap</p>
                  <Delta value={Math.round(positiveDelta * 10) / 10} suffix=" pts" />
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  vs. company avg
                </span>
              </div>
            </div>
          </div>
          </div>
          <div className="manager-compare-right">
            <SectionHeader
              title="Your team's 6-month mood trend"
              subtitle="Dashed line shows the current company average for context."
            />
            <div className="card">
              <MiniMoodTrend points={team.history} companyAvg={report.avgMood} />
              {team.history.length < 2 && (
                <p className="muted" style={{ marginTop: 8 }}>
                  Limited history available — the trend will become more useful as more months
                  accumulate.
                </p>
              )}
            </div>
          </div>
          <div className="manager-compare-third">
            <SectionHeader
              title="What your team is saying"
              subtitle="Aggregated themes only — no individual quotes."
            />
            <div className="card">
              {team.commentThemes.length > 0 ? (
                <>
                  <p className="h3-micro">Themes mentioned</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {team.commentThemes.map((t) => (
                      <span
                        key={t}
                        style={{
                          background: 'var(--blueSoft)',
                          border: '1px solid #bddcff',
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#075cae',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="h3-micro">What this suggests</p>
                  <p style={{ marginTop: 2 }}>
                    These are the patterns surfacing most often in your team's comments. Use them as
                    a prompt for a 15-minute listening conversation: which of these is the team's
                    biggest blocker right now, and what one change would help?
                  </p>
                </>
              ) : (
                <>
                  <p className="muted">
                    No aggregated comment themes available for this period. Themes appear once at
                    least 3 comments have been submitted in a month.
                  </p>
                  <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    Encourage employees to share a brief comment with their next check-in — even
                    one sentence helps surface patterns earlier.
                  </p>
                </>
              )}
              {team.privacyNote && (
                <p className="muted" style={{ marginTop: 10, fontSize: 11 }}>
                  <strong>Privacy.</strong> {team.privacyNote}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* G. Recommended manager action — two-column layout */}
        <section className="brief-section">
          <SectionHeader title="Recommended manager action" />
          <div className="card manager-action-grid">
            <div className="manager-action-col">
              <p className="h3-micro">Primary read</p>
              <p>{team.keyConcernOrStrength}</p>
              <p className="h3-micro" style={{ marginTop: 12 }}>
                Suggested next step
              </p>
              <p>{team.managerAction}</p>
              <p className="h3-micro" style={{ marginTop: 12 }}>
                Tactical follow-through
              </p>
              <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
                <li>Schedule a 15-minute listening conversation with the team.</li>
                <li>Identify one workload, recognition, or communication blocker to close.</li>
                <li>Document the follow-through in your manager tools.</li>
              </ol>
              <p style={{ marginTop: 10 }}>
                <a className="link" href={managerToolsUrl} target="_blank" rel="noreferrer">
                  Open Lollipop manager tools →
                </a>
              </p>

              <p className="h3-micro" style={{ marginTop: 14 }}>
                Manager training videos
              </p>
              <ul className="manager-videos-list">
                {TRAINING_VIDEOS.map((v) => (
                  <li key={v.url}>
                    <a className="link" href={v.url} target="_blank" rel="noreferrer">
                      ▶ {v.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="manager-action-col">
              <p className="h3-micro">Suggested tools for this team</p>
              <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Selected based on this period's mood, participation, sentiment, and comment themes.
              </p>
              <ul className="manager-tools-list">
                {recommendedTools.map((tool) => (
                  <li key={tool.key}>
                    <a
                      className="link"
                      href={tool.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tool.name} →
                    </a>
                    <p>{tool.whenToUse}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* H. Privacy & scope notice */}
        <section className="appendix-section appendix-block">
          <SectionHeader
            eyebrow="Scope"
            title="About this report"
            subtitle="What is — and isn't — included"
            size="sm"
          />
          <div className="card">
            <p className="h2-sub">Privacy and scope</p>
            <ul>
              <li>
                This report includes only your team&apos;s metrics plus company averages. Peer team
                data is not shown.
              </li>
              <li>Comments are aggregated as themes only when at least 3 are available.</li>
              <li>Findings below 5 responses should be interpreted directionally.</li>
            </ul>
            <p className="muted" style={{ fontSize: 12 }}>
              This view is designed to support your team, not to rank managers. Use it as a
              starting point for conversation.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
