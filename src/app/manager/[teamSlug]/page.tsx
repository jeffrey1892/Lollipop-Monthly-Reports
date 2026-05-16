import React from 'react'
import Link from 'next/link'
import { getReport, customers, slugifyTeam } from '@/lib/reportMetrics'
import {
  SectionHeader,
  KpiCard,
  TrendDelta,
  Delta,
  ConfidenceBadge,
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

        {/* B. Snapshot KPIs */}
        <section className="brief-section">
          <SectionHeader title="Your team snapshot" subtitle="Headline metrics for this reporting period" />
          <div className="kpi-grid">
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
              delta={<TrendDelta value={null} />}
              tone={team.positivePct >= 60 ? 'green' : team.positivePct >= 40 ? 'amber' : 'coral'}
            />
            <KpiCard
              label="Participation"
              value={team.responses}
              sub={<>check-ins this period</>}
              delta={<TrendDelta value={team.participationTrend} suffix=" check-ins" />}
              tone="blue"
            />
            <KpiCard
              label="Confidence"
              value={team.confidence}
              sub={lowSample ? <>Low sample · directional</> : <>Usable read</>}
              delta={<ConfidenceBadge value={team.confidence} />}
              tone="neutral"
            />
          </div>
        </section>

        {/* C. Versus company average */}
        <section className="brief-section">
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
        </section>

        {/* D. Trend */}
        <section className="brief-section">
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
        </section>

        {/* E. Mood breakdown */}
        <section className="brief-section">
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
        </section>

        {/* F. What your team is saying */}
        <section className="brief-section">
          <SectionHeader
            title="What your team is saying"
            subtitle="Aggregated themes only — no individual quotes are shown at the team level."
          />
          <div className="card">
            {team.commentThemes.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {team.commentThemes.map((t) => (
                  <span
                    key={t}
                    className="h2-sub"
                    style={{
                      background: 'var(--blueSoft)',
                      border: '1px solid #bddcff',
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontSize: 13,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">
                No aggregated comment themes available for this period. Themes appear when at least
                3 comments are submitted.
              </p>
            )}
            {team.privacyNote && (
              <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                <strong>Privacy.</strong> {team.privacyNote}
              </p>
            )}
          </div>
        </section>

        {/* G. Recommended manager action */}
        <section className="brief-section">
          <SectionHeader title="Recommended manager action" />
          <div className="card">
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
              <a href={managerToolsUrl} target="_blank" rel="noreferrer">
                Open Lollipop manager tools →
              </a>
            </p>
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
