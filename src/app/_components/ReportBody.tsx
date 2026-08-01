import React from 'react'
import type { ReportMetrics } from '@/lib/types'
import { MONTHLY_ENGAGEMENT_NOTE } from '@/lib/engagementCalc'
import {
  Delta,
  TrendDelta,
  ConfidenceBadge,
  SeverityBadge,
  NoteRef,
  KpiCard,
  SectionHeader,
} from './ui'
import TrendChart from './TrendChart'
import PieChart from './PieChart'
import WeeklyEngagementChart from './WeeklyEngagementChart'

export type ReportRenderMode = 'web' | 'print'
export type ReportAudience = 'executive' | 'hr-restricted'

/**
 * ReportBody — the single shared report tree consumed by both the web view
 * (src/app/page.tsx, renderMode="web") and the print/PDF route
 * (src/app/print/page.tsx, renderMode="print"). Web and print therefore
 * consume the identical getReport() payload by construction; the only
 * differences are interactive chrome (range toggle, help pills) and the
 * audience gating of individual retention-risk names.
 */
export default function ReportBody({
  report,
  customerId,
  range,
  renderMode,
  audience,
}: {
  report: ReportMetrics
  customerId: string
  range: 'month' | 'quarter'
  renderMode: ReportRenderMode
  audience: ReportAudience
}) {
  const isWeb = renderMode === 'web'
  const rangeHref = (r: 'month' | 'quarter') =>
    `/?customer=${customerId}&month=${report.month}&range=${r}${
      audience === 'hr-restricted' ? '&audience=hr-restricted' : ''
    }`

  // === Follow-up Responsiveness placeholder data ===
  // When real data is wired, populate these from report.followUpResponsiveness.
  const followUp = {
    requested: 0,
    confirmed: 0,
    notConfirmed: 0,
    hrEscalations: 0,
    completionRate: null as number | null,
    completionRateChange: null as number | null,
  }

  // The engagement recommendation's email links render beside the
  // Team engagement risks table in the Engagement summary section.
  const ENGAGEMENT_REC_TITLES = ['Rebuild check-in participation', 'Maintain check-in participation cadence']
  const engagementRec = report.recommendations.find((r) => ENGAGEMENT_REC_TITLES.includes(r.title))
  const engagementActionLinks = (engagementRec?.links ?? []).filter((l) =>
    l.label.toLowerCase().includes('email'),
  )

  // Engagement tone
  const engagementPct = report.engagement.responseRate
  const watchTone: 'green' | 'amber' | 'coral' =
    report.teamsNeedingAttention.length === 0
      ? 'green'
      : report.teamsNeedingAttention.some((t) => t.riskLevel === 'Critical') ||
        report.teamsNeedingAttention.length > 2
      ? 'coral'
      : 'amber'
  const moodTone: 'green' | 'amber' | 'coral' =
    (report.avgMoodChange ?? 0) >= 0.05
      ? 'green'
      : (report.avgMoodChange ?? 0) <= -0.05
      ? 'coral'
      : 'amber'
  const positiveTone: 'green' | 'amber' | 'coral' =
    (report.positiveChange ?? 0) >= 2
      ? 'green'
      : (report.positiveChange ?? 0) <= -2
      ? 'coral'
      : 'amber'

  // Top emotion narrative
  const topEmotion = report.topEmotions[0]
  const topEmotionMax = Math.max(...report.topEmotions.slice(0, 6).map((e) => e.count), 1)

  const priorCaption = report.previousLabel ? `v. ${report.previousLabel}` : 'v. prior month'

  // Executive audience: summarize individual retention risks per team instead
  // of naming individuals (names are restricted to manager/HR views).
  const retentionByTeam = (() => {
    const map = new Map<string, { count: number; mix: Map<string, number> }>()
    for (const r of report.individualRetentionRisks) {
      const entry = map.get(r.team) ?? { count: 0, mix: new Map<string, number>() }
      entry.count += 1
      entry.mix.set(r.riskLevel, (entry.mix.get(r.riskLevel) ?? 0) + 1)
      map.set(r.team, entry)
    }
    const levelOrder = ['Urgent HR Review', 'Manager Action Needed', 'Follow-Up Suggested', 'Monitor']
    return [...map.entries()]
      .map(([team, e]) => ({
        team,
        count: e.count,
        mix: levelOrder
          .filter((l) => e.mix.has(l))
          .map((l) => `${e.mix.get(l)} ${l}`)
          .join(' · '),
      }))
      .sort((a, b) => b.count - a.count)
  })()

  return (
    <main className="wrap pages">
      {/* === A. Executive Header === */}
      <section className="exec-header brief-section">
        <div className="exec-header-main">
          <div className="exec-header-title-row">
            <div className="exec-header-left">
              <p className="h3-micro">Workforce intelligence report</p>
              <h1 className="client-title">{report.customerName}</h1>
              <p className="exec-header-meta">
                {report.label} · Prepared by Lollipop ·{' '}
                <span className="muted">Confidence {report.reportConfidence}</span>
              </p>
              {isWeb && (
                <div className="dashboard-help">
                  <a
                    href="https://www.trylollipop.com/resources-page-hidden"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Dashboard walkthrough
                  </a>
                  <a href="mailto:support@trylollipop.com">support@trylollipop.com</a>
                </div>
              )}
            </div>
            <div className={`health-tile health-${report.healthSummary.rating.toLowerCase().replace(/\s+/g, '-')}`}>
              <span className="health-label h3-micro">Organizational health</span>
              <strong>{report.healthSummary.rating}</strong>
              <small>{report.healthSummary.score} / 100</small>
              <NoteRef n={1} />
            </div>
          </div>
        </div>
      </section>

      {/* === B. Executive KPI Snapshot === */}
      <section className="brief-section">
        <div className="print-keep">
          <SectionHeader title="Executive snapshot" subtitle="Headline metrics versus prior month" />
          <div className="kpi-grid">
            <KpiCard
              label="Average mood"
              value={report.avgMood.toFixed(2)}
              sub={<>out of 5.00</>}
              delta={<TrendDelta value={report.avgMoodChange} />}
              deltaCaption={priorCaption}
              tone={moodTone}
            />
            <KpiCard
              label="Positive sentiment"
              value={`${report.positivePct}%`}
              sub={<>of all check-ins</>}
              delta={<TrendDelta value={report.positiveChange} suffix=" pts" />}
              deltaCaption={priorCaption}
              tone={positiveTone}
            />
            <KpiCard
              label="Monthly engagement rate"
              value={engagementPct !== null ? `${engagementPct}%` : '—'}
              sub={
                <>
                  average of the month&apos;s weekly rates ·{' '}
                  {report.engagement.uniqueParticipants} of{' '}
                  {report.engagement.optedInPopulation ?? '—'} checked in at least once
                </>
              }
              delta={<TrendDelta value={report.engagement.responseRateChange} suffix=" pp" />}
              deltaCaption={priorCaption}
              tone="blue"
              help={<>{MONTHLY_ENGAGEMENT_NOTE}</>}
            />
            <KpiCard
              label="Teams requiring attention"
              value={report.teamsNeedingAttention.length}
              sub={
                report.teamsNeedingAttention.length > 0 ? (
                  <>{report.teamsNeedingAttention.map((t) => t.team).join(', ')}</>
                ) : (
                  <>no concentrated hotspot</>
                )
              }
              tone={watchTone}
            />
            {report.followUpRequests > 0 && (
              <KpiCard
                label="Follow-up requests"
                value={report.followUpRequests}
                sub={
                  report.followUpCompletionPct !== null ? (
                    <>{report.followUpCompletionPct}% completed</>
                  ) : (
                    <>awaiting triage</>
                  )
                }
                tone={
                  report.followUpCompletionPct !== null && report.followUpCompletionPct >= 70
                    ? 'green'
                    : 'amber'
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* === B2. Engagement summary — monthly + weekly === */}
      {report.engagementSummary && (
        <section className="brief-section engagement-summary-section">
          <div className="print-keep">
            <div className="engagement-section-head">
              <SectionHeader
                title="Engagement summary"
                subtitle="Monthly and weekly engagement with off-roster respondents included"
              />
              {isWeb && (
                <div className="range-toggle" aria-label="Weekly engagement period">
                  <a className={`range-pill${range === 'month' ? ' active' : ''}`} href={rangeHref('month')}>
                    Month
                  </a>
                  <a className={`range-pill${range === 'quarter' ? ' active' : ''}`} href={rangeHref('quarter')}>
                    Quarter
                  </a>
                </div>
              )}
            </div>
            <div className="engagement-grid">
              <div className="engagement-left-col">
                <div className="card engagement-weekly-table-card">
                  <p className="h2-sub">Weekly detail — {report.engagementSummary.weeklyWindowLabel}</p>
                  <div className="table-wrap">
                    <table className="table engagement-weekly-table">
                      <thead>
                        <tr>
                          <th>Week</th>
                          <th style={{ textAlign: 'right' }}>Unique respondents</th>
                          <th style={{ textAlign: 'right' }}>Engagement %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.engagementSummary.weekly.map((w) => (
                          <tr key={w.weekStart}>
                            <td>{w.weekLabel}</td>
                            <td style={{ textAlign: 'right' }}>{w.uniqueRespondents}</td>
                            <td style={{ textAlign: 'right' }}><strong>{w.engagementRate}%</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted engagement-note">{MONTHLY_ENGAGEMENT_NOTE}</p>
                </div>
              </div>
              <div className="card engagement-chart-card">
                <p className="h2-sub">Weekly engagement — trailing 3 months</p>
                <div className="engagement-chart-wrap">
                  <WeeklyEngagementChart points={report.engagementSummary.weeklyTrailing} />
                </div>
                <p className="muted engagement-note">
                  Engagement rates are based on unique employees, with a maximum of one counted response per employee per week.
                </p>
              </div>
            </div>
          </div>
          <div className="completion-row">
            <div className="card completion-card">
              <p className="h2-sub">
                Incomplete check-ins — {report.engagementSummary.weeklyWindowLabel}
              </p>
              <p className="muted completion-note">
                Employees who completed fewer than the{' '}
                {report.engagementSummary.checkInCompletion[0]?.total ??
                  report.engagementSummary.weekly.length}{' '}
                check-in deliveries this period.
              </p>
              {report.engagementSummary.checkInCompletion.length === 0 ? (
                <p className="muted">Every employee completed all check-ins this period.</p>
              ) : (
                <>
                  <ul className="completion-list">
                    {report.engagementSummary.checkInCompletion.slice(0, 30).map((p) => (
                      <li key={p.name}>
                        <span className="completion-name">
                          {p.name}
                          {!p.onRoster && <span className="sample-flag"> off-roster</span>}
                        </span>
                        <span className="completion-count">
                          {p.completed} of {p.total}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {report.engagementSummary.checkInCompletion.length > 30 && (
                    <p className="completion-more">
                      Showing the 30 least active employees.{' '}
                      <a href="#full-checkin-list">
                        The full list of {report.engagementSummary.checkInCompletion.length}{' '}
                        employees with incomplete check-ins is at the end of this report.
                      </a>
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="card opted-out-card">
              <p className="h2-sub">Opted out</p>
              <p className="muted completion-note">Roster employees who opted out of check-ins.</p>
              {report.engagementSummary.optedOut.length === 0 ? (
                <p className="muted">No opted-out employees on record.</p>
              ) : (
                <ul className="opted-out-list">
                  {report.engagementSummary.optedOut.map((p) => (
                    <li key={p.name}>
                      <span className="completion-name">{p.name}</span>
                      {p.date && <span className="muted completion-date">{p.date}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="engagement-risks-row">
            <div className="card engagement-risks-card">
              <p className="h2-sub">Team engagement risks</p>
              {report.engagementRisks.length === 0 ? (
                <p className="muted">No material engagement risks identified for this period.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table engagement-risks-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Engagement issue</th>
                        <th style={{ textAlign: 'right' }}>Current engagement</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.engagementRisks.map((r) => (
                        <tr key={r.team}>
                          <td><strong>{r.team}</strong></td>
                          <td>{r.issue}</td>
                          <td style={{ textAlign: 'right' }}>{r.currentEngagement}%</td>
                          <td>{r.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card engagement-actions-card">
              <p className="h2-sub">Suggested actions to increase engagement</p>
              {report.engagementRisks.length > 0 ? (
                <ul className="engagement-actions-list">
                  <li>
                    Ask managers of {report.engagementRisks.map((r) => r.team).join(', ')} to
                    remind employees about check-ins at their next team meeting.
                  </li>
                  <li>Send an employee email notice reminding the team why check-ins matter.</li>
                  <li>Run the giveaway feature to make participation visible and rewarding.</li>
                  <li>
                    Have managers follow up individually with low-participation employees before
                    the next reporting period.
                  </li>
                </ul>
              ) : (
                <ul className="engagement-actions-list">
                  <li>Keep Lollipop visible with periodic team-meeting reminders.</li>
                  <li>Send occasional employee email notices to maintain the check-in habit.</li>
                  <li>Use the giveaway feature if participation begins to soften.</li>
                </ul>
              )}
              {engagementActionLinks.length > 0 && (
                <div className="action-links">
                  {engagementActionLinks.map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* === B3. Monthly Wide Mood Trends === */}
      <section className="brief-section trend-section">
        <div className="print-keep">
          <SectionHeader title="Monthly Wide Mood Trends" subtitle="Sentiment and participation over time" />
          <div className="trend-card-grid">
            <div className="card trend-chart-card">
              <TrendChart data={report.monthlyTrend} />
            </div>
            <div className="trend-stats">
              <div className="stat-tile">
                <span className="h3-micro">Trailing 3-month mood</span>
                <strong>{report.trend.threeMonthAvgMood ?? '—'}</strong>
              </div>
              <div className="stat-tile">
                <span className="h3-micro">Rolling positive</span>
                <strong>{report.trend.rollingPositivePct ?? '—'}%</strong>
              </div>
              <div className="stat-tile">
                <span className="h3-micro">Best month</span>
                <strong>{report.trend.bestMonth}</strong>
              </div>
              <div className="stat-tile">
                <span className="h3-micro">Worst month</span>
                <strong>{report.trend.worstMonth}</strong>
              </div>
              <div className="stat-tile wide">
                <span className="h3-micro">Persistence</span>
                <strong className="stat-narrative">{report.trend.meaningfulMovement}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === E. Leadership Priorities === */}
      <section className="brief-section action-section">
        <div className="print-keep">
          <SectionHeader
            title="Leadership Priorities"
            subtitle="What leadership should do next, in priority order"
          />
          <div className="exec-summary-card assessment-card">
            <p className="exec-summary-lede">{report.leadershipAssessment}</p>
          </div>
          {report.priorityActionRows.length === 0 ? (
            <p className="muted">No material leadership action is recommended this period.</p>
          ) : (
            <div className="card leadership-block">
              <div className="leadership-grid">
                <div className="leadership-table-col">
                  <table className="table priority-actions-table">
                    <thead>
                      <tr>
                        <th>Priority</th>
                        <th>Recommended action</th>
                        <th>Applies to</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.priorityActionRows.map((row, i) => (
                        <tr key={i}>
                          <td><span className={`risk-pill priority-${row.priority.toLowerCase()}`}>{row.priority}</span></td>
                          <td><strong>{row.action}</strong></td>
                          <td>{row.appliesTo}</td>
                          <td>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="leadership-steps-col">
                  <p className="h2-sub">Recommended next steps</p>
                  {report.priorityActionDetails.map((d, i) => (
                    <div className="next-step" key={d.title}>
                      <p className="next-step-title">
                        <span className="next-step-number">{i + 1}.</span> {d.title}
                      </p>
                      <p className="next-step-guidance">{d.description}</p>
                      <p className="next-step-meta">
                        <span><span className="h3-micro">Owner</span>{d.owner}</span>
                        <span><span className="h3-micro">Timing</span>{d.timing}</span>
                      </p>
                      {d.links.length > 0 && (
                        <div className="action-links">
                          {d.links.map((l) => (
                            <a key={l.label} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Snapshot-only strip: key figures from the sections the one-page
          brief omits, plus a pointer to the full report. Hidden everywhere
          except the print brief (globals.css / print.css). */}
      <section className="brief-section brief-more-section">
        <div className="card brief-more-card">
          <p className="brief-more-data">
            <strong>Also this month:</strong>{' '}
            {report.followUpRequests} follow-up request{report.followUpRequests === 1 ? '' : 's'}
            {report.followUpRequests > 0 && report.followUpCompletionPct !== null
              ? ` (${report.followUpCompletionPct}% addressed)`
              : ''}
            {' · '}
            {report.engagementSummary.checkInCompletion.length} employee
            {report.engagementSummary.checkInCompletion.length === 1 ? '' : 's'} with incomplete
            check-ins · {report.engagementSummary.optedOut.length} opted out ·{' '}
            {report.commentIntelligence.commentCount} comments analyzed
            {report.topEmotions.length > 0
              ? ` · Top emotions: ${report.topEmotions
                  .slice(0, 3)
                  .map((e) => `${e.emotion} ${e.pct}%`)
                  .join(', ')}`
              : ''}
          </p>
          <p className="brief-more-note">
            See the full report for AI comment intelligence, emotional wellness, follow-up
            responsiveness, the complete check-in and opted-out rosters, and team-level appendix
            detail.
          </p>
        </div>
      </section>

      {/* === G. Emotional Wellness === */}
      <section className="brief-section emotion-section">
        <div className="print-keep">
          <SectionHeader title="Emotional wellness" subtitle="Most-named emotions this period" />
          <div className="emotion-grid">
            <div className="card emotion-bars-card">
              {report.topEmotions.slice(0, 6).map((e) => (
                <div className="emotion-row" key={e.emotion}>
                  <span className="emotion-name">{e.emotion}</span>
                  <div className="emotion-bar">
                    <i style={{ width: `${(e.count / topEmotionMax) * 100}%` }} />
                  </div>
                  <span className="emotion-count">
                    {e.count} <small>({e.pct}%)</small>
                  </span>
                </div>
              ))}
            </div>
            <div className="card emotion-narrative-card">
              <p className="h3-micro">Interpretation</p>
              <p>
                The dominant emotion this period is{' '}
                <strong>{topEmotion ? topEmotion.emotion.toLowerCase() : 'unspecified'}</strong>
                {topEmotion ? ` (${topEmotion.pct}% of all emotion mentions)` : ''}. The mix
                reflects the broader sentiment read of{' '}
                <strong>{report.positivePct}% positive</strong> check-ins.
              </p>
              <p className="muted">
                Emotion frequency is directional: it reflects what employees chose to name, not a
                clinical assessment. Read alongside comment intelligence for context.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/*
        === Follow-up Responsiveness (placeholder) ===
        Visual placeholder only — the data layer is not yet wired. When real
        data exists, replace `FOLLOWUP_PLACEHOLDER` with values from
        `report.followUpResponsiveness` (KPI values, trend series, exception
        rows) and remove the empty-state row from the exceptions table.
      */}
      {(() => {
        const FOLLOWUP_PLACEHOLDER = {
          kpis: [
            { label: 'Employees requesting follow-up', value: String(followUp.requested) },
            { label: 'Follow-up confirmed', value: String(followUp.confirmed) },
            { label: 'Follow-up not confirmed', value: String(followUp.notConfirmed) },
            { label: 'HR escalations triggered', value: String(followUp.hrEscalations) },
            {
              label: 'Follow-up completion rate',
              value: followUp.completionRate !== null ? `${followUp.completionRate}%` : '—',
              delta: <TrendDelta value={followUp.completionRateChange} suffix=" pp" />,
            },
          ] as Array<{ label: string; value: string; delta?: React.ReactNode }>,
          columns: [
            'Check-in date',
            'Employee',
            'Manager',
            'Follow-up requested',
            'Employee confirmed follow-up',
            'HR escalation status',
          ],
          exceptions: [] as Array<Record<string, React.ReactNode>>,
        }
        return (
          <section className="brief-section followup-section">
            <div className="print-keep">
              <SectionHeader
                title="Follow-up responsiveness"
                subtitle="Track whether employees who requested support later confirmed that follow-up occurred."
                accent="blue"
              />
              <p className="muted followup-helper">
                When employees request support after a low check-in, Lollipop can track whether the
                employee later confirms that follow-up occurred. Unconfirmed follow-ups can be
                escalated for HR visibility and support.
              </p>

              <div className="kpi-grid">
                {FOLLOWUP_PLACEHOLDER.kpis.map((k) => (
                  <KpiCard
                    key={k.label}
                    label={k.label}
                    value={k.value}
                    sub={<span className="muted">Awaiting data</span>}
                    delta={k.delta}
                    tone="neutral"
                  />
                ))}
              </div>
            </div>

            <div className="followup-bottom-row">
              <div className="card followup-trend-card">
                <p className="h2-sub">Follow-up completion trends</p>
                <div className="empty-chart">
                  Trend data will appear as employee follow-up confirmations are collected.
                </div>
              </div>

              <div className="card followup-exceptions-card">
                <p className="h2-sub">Missed follow-ups</p>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 8px' }}>
                  Employees who indicated requested support did not occur — flagged for HR review.
                </p>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        {FOLLOWUP_PLACEHOLDER.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FOLLOWUP_PLACEHOLDER.exceptions.length === 0 ? (
                        <tr className="empty-row">
                          <td colSpan={FOLLOWUP_PLACEHOLDER.columns.length}>
                            <div>No missed follow-ups recorded yet.</div>
                            <small className="muted">
                              When employees indicate that requested support did not occur, those
                              events will appear here for HR visibility and follow-through
                              tracking.
                            </small>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )
      })()}

      {/* === H. Comment Intelligence === */}
      <section className="brief-section comment-intel-v2">
        <div className="print-keep">
          <SectionHeader
            eyebrow={<>AI · synthesized signal</>}
            title="AI comment intelligence"
            subtitle={`Synthesized from ${report.commentIntelligence.commentCount} free-text comments`}
            accent="blue"
          />

          <div className="card ci-summary-card">
            <p className="ci-summary">{report.commentIntelligence.executiveSummary}</p>
          </div>

          <div className="ci-themes-grid">
            {report.commentIntelligence.themes.map((t) => (
              <div className={`ci-theme-card type-${t.type.toLowerCase()}`} key={t.theme}>
                <header>
                  <strong>{t.theme}</strong>
                  <span className="ci-theme-count">{t.count}</span>
                </header>
                <span className="ci-theme-type">{t.type}</span>
                <p>{t.signal}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card ci-table-card">
          <h3 className="h2-sub">Theme detail</h3>
          <div className="table-wrap">
            <table className="table ci-theme-table">
              <thead>
                <tr>
                  <th>Theme</th>
                  <th>Trend</th>
                  <th>Sentiment</th>
                  <th>Primary Teams</th>
                  <th>Executive Interpretation</th>
                  <th>Suggested action</th>
                </tr>
              </thead>
              <tbody>
                {report.commentIntelligence.themeTable.map((t) => (
                  <tr key={t.theme}>
                    <td><strong>{t.theme}</strong></td>
                    <td><span className={`pill trend-${t.trendDirection.toLowerCase()}`}>{t.trendDirection}</span></td>
                    <td><span className={`pill senti-${t.sentimentType.toLowerCase()}`}>{t.sentimentType}</span></td>
                    <td>{t.primaryTeams}</td>
                    <td>{t.interpretation}</td>
                    <td className="ci-suggestion">{t.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ci-two-col">
          <div className="card ci-list positive">
            <h3 className="h2-sub">Positive drivers</h3>
            <ul className="ci-driver-list">
              {report.commentIntelligence.positiveDrivers.map((d) => (
                <li key={d.observation}>
                  <p className="ci-driver-obs">{d.observation}</p>
                  <p className="ci-driver-action">
                    <span className="h3-micro">Suggested action</span>
                    {d.suggestion}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="card ci-list attention">
            <h3 className="h2-sub">Areas requiring attention</h3>
            <ul className="ci-driver-list">
              {report.commentIntelligence.attentionAreas.map((a) => (
                <li key={a.observation}>
                  <p className="ci-driver-obs">{a.observation}</p>
                  <p className="ci-driver-action">
                    <span className="h3-micro">Suggested action</span>
                    {a.suggestion}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 className="h2-sub">Leadership recommendations</h3>
          <ol className="recs-ol">
            {report.commentIntelligence.leadershipRecommendations.slice(0, 6).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </div>
      </section>

      {/* === I. Detailed Team Breakdowns === */}
      <section className="appendix-section appendix-block team-detail-section">
        <SectionHeader
          eyebrow="Appendix"
          title="Team detail"
          subtitle="Full breakdown ranked by signal strength"
          size="sm"
        />
        {/* Cards are chunked into per-row grids so print pagination can break
            between rows (Chromium fragments a single tall grid container
            poorly). .team-detail-rows re-creates the single-grid look on web. */}
        <div className="team-detail-rows">
          {Array.from({ length: Math.ceil(report.teamIntelligence.length / 2) }, (_, ri) => (
            <div className="team-detail-grid" key={ri}>
              {report.teamIntelligence.slice(ri * 2, ri * 2 + 2).map((t, ci) => {
                const index = ri * 2 + ci
                return (
            <article className="team-detail-card" key={t.team}>
              <header>
                <span className="team-rank-num">#{index + 1}</span>
                <div>
                  <h3 className="h2-sub">{t.team}</h3>
                  <SeverityBadge value={t.severity} />
                </div>
              </header>
              <div className="team-detail-metrics">
                <div><span className="h3-micro">Mood</span><strong>{t.avgMood.toFixed(2)}</strong><small><Delta value={t.change} /></small></div>
                <div><span className="h3-micro">Positive</span><strong>{t.positivePct}%</strong><small>{t.positiveCount} positive</small></div>
                <div><span className="h3-micro">Neutral</span><strong>{t.neutralPct}%</strong><small>{t.neutralCount} neutral</small></div>
                <div><span className="h3-micro">Negative</span><strong>{t.negativePct}%</strong><small>{t.negativeCount} negative</small></div>
                <div><span className="h3-micro">Participation</span><strong>{t.responses}</strong><small><Delta value={t.participationTrend} /> vs prior</small></div>
                <div><span className="h3-micro">Confidence</span><strong>{t.confidence}</strong><small>{t.sampleWarning ? <>Low sample <NoteRef n={4} /></> : 'Usable read'}</small></div>
              </div>
              <p><strong>Primary read.</strong> {t.keyConcernOrStrength}</p>
              {/* DATA-LOGIC NOTE: managerAction for non-High/non-warning teams says
                  "Review {team}'s neutral responses…" even when neutralCount is 0
                  (see src/lib/reportMetrics.ts teamIntelligence.managerAction). */}
              <p><strong>Manager action.</strong> {t.managerAction}</p>
              {t.commentThemes.length > 0 && (
                <p className="muted"><strong>Comment themes.</strong> {t.commentThemes.join(', ')}</p>
              )}
              {t.privacyNote && (
                <p className="muted"><strong>Privacy.</strong> {t.privacyNote}</p>
              )}
            </article>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      {/* === J. Appendix === */}
      <section className="appendix-section appendix-block">
        <SectionHeader
          eyebrow="Appendix"
          title="Appendix · supporting tables"
          subtitle="Distribution, watchlists, and methodology"
          size="sm"
        />
        <div className="grid two appendix-supporting-grid">
          <div className="appendix-stack">
            <div className="card mood-distribution-card">
              <h3 className="h2-sub">Mood distribution</h3>
              <p className="muted small">How responses are spread</p>
              <PieChart slices={report.moodDistribution} />
            </div>
            <div className="card">
              <h3 className="h2-sub">Positive momentum</h3>
              <p className="muted small">What&apos;s working</p>
              <div className="list">
                {report.positiveMomentum.slice(0, 4).map((r) => (
                  <div className="rec positive" key={r.title}>
                    <strong>{r.title}</strong>
                    <p>{r.signal}</p>
                    <p>
                      <strong>Preserve:</strong> {r.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <h3 className="h2-sub">Risk / watchlist areas</h3>
            {/* DATA-LOGIC NOTE: riskWatchlist (and whatChanged) are still derived from
                the legacy watchTeams ranking in reportMetrics.ts, while the
                "Teams requiring attention" KPI uses the newer teamsNeedingAttention
                engine — the two lists can disagree for the same month. */}
            <div className="list">
              {report.riskWatchlist.slice(0, 4).map((r) => (
                <div className="rec" key={r.title}>
                  <strong>
                    {r.title} <SeverityBadge value={r.severity} />
                  </strong>
                  <p>{r.signal}</p>
                  <p>
                    <strong>Action:</strong> {r.recommendedAction}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <p className="h3-micro">
            Data quality &amp; confidence <NoteRef n={3} />
          </p>
          <h3 className="h2-sub">
            {report.reportConfidenceScore}/100 · {report.reportConfidence}
          </h3>
          <p>{report.confidenceRationale}</p>
          <p>
            <strong>
              Low-sample teams <NoteRef n={4} />:
            </strong>{' '}
            {report.lowConfidenceTeams.length
              ? report.lowConfidenceTeams.map((t) => t.team).join(', ')
              : 'None'}
          </p>
        </div>

        <div className="retention-risk-section">
          <div className="print-keep">
            <div className="retention-risk-head">
              <p className="h3-micro">Restricted · manager / HR follow-up <NoteRef n={2} /></p>
              <h3 className="h2-sub">Individual retention risk</h3>
              <p className="muted">
                Specific names should be shown only in authorized manager or HR views. Executive PDFs
                should summarize counts and teams rather than broadly distributing individual names.
              </p>
            </div>
            {audience === 'hr-restricted' ? (
              <div className="retention-grid-v2">
                {report.individualRetentionRisks.length ? (
                  report.individualRetentionRisks.map((r) => (
                    <div className="retention-card" key={`${r.employeeName}-${r.team}`}>
                      <div className="priority-head">
                        <strong>{r.employeeName}</strong>
                        <span className="urgency-pill">{r.riskLevel}</span>
                      </div>
                      <p>
                        <strong>Team:</strong> {r.team}
                      </p>
                      <p>
                        <strong>Current mood:</strong> {r.currentMood} ·{' '}
                        <strong>Low check-ins:</strong> {r.lowCheckIns}
                      </p>
                      <p>
                        <strong>Trend:</strong> {r.trend}
                      </p>
                      {/* DATA-LOGIC NOTE: drivers text can claim "stress, burnout, or
                          negative-emotion language" for employees whose current mood is
                          high (e.g. 5) because buildIndividualRetentionRisks matches risk
                          words across the concatenated 3-month comment history, including
                          words like "tired" used in otherwise positive comments. */}
                      <p>
                        <strong>Drivers:</strong> {r.drivers.join(', ')}
                      </p>
                      <p>
                        <strong>Suggested action:</strong> {r.recommendedAction}
                      </p>
                      <ConfidenceBadge value={r.confidence} />
                    </div>
                  ))
                ) : (
                  <p>No individual retention-risk flags met the current threshold.</p>
                )}
              </div>
            ) : report.individualRetentionRisks.length ? (
              <div className="card retention-summary-card">
                <div className="table-wrap">
                  <table className="table retention-summary-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th style={{ textAlign: 'right' }}>Flagged individuals</th>
                        <th>Risk-level mix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retentionByTeam.map((t) => (
                        <tr key={t.team}>
                          <td><strong>{t.team}</strong></td>
                          <td style={{ textAlign: 'right' }}>{t.count}</td>
                          <td>{t.mix}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted small" style={{ margin: '10px 0 0' }}>
                  {report.individualRetentionRisks.length} individual
                  {report.individualRetentionRisks.length === 1 ? '' : 's'} flagged in total.
                  Named details are available in the authorized manager / HR view.
                </p>
              </div>
            ) : (
              <p>No individual retention-risk flags met the current threshold.</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="h2-sub">Explanatory notes</h3>
          <p className="muted small">Definitions and methodology references</p>
          <div className="notes-grid">
            <div id="note-1">
              <strong>Note 1 — Organizational Health</strong>
              <p>
                Organizational Health is a composite rating that summarizes overall workforce
                condition for the period. It synthesizes average mood, positive sentiment,
                engagement quality, trend direction, team consistency, risk flags, and comment
                signals into a practical executive read such as Strong, Healthy, Mixed, Watchlist,
                or At Risk.
              </p>
            </div>
            <div id="note-2">
              <strong>Note 2 — Individual Retention Risk</strong>
              <p>
                Individual Retention Risk is a restricted manager/HR follow-up signal, not a public
                performance label or a prediction that someone will resign. It looks for repeated
                low check-ins, current low mood, meaningful mood declines, stress/burnout or
                workload language in comments, negative-emotion patterns, unresolved follow-up
                requests, and other load/capacity signals. Names should be visible only in
                authorized manager or HR views.
              </p>
            </div>
            <div id="note-3">
              <strong>Note 3 — Confidence</strong>
              <p>
                Confidence is a reliability indicator, not a performance score. It reflects response
                volume, team coverage, comment depth, trend consistency, and data completeness.
                High confidence is decision-ready; medium is directional; low/provisional should be
                validated before major decisions.
              </p>
            </div>
            <div id="note-4">
              <strong>Note 4 — Low Sample</strong>
              <p>
                Team-level findings below 5 responses should not be overinterpreted. Comment themes
                are suppressed or generalized below 3 comments to protect privacy and reduce
                over-identification risk.
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* Full check-in completion list — referenced from Engagement summary */}
      {report.engagementSummary && report.engagementSummary.checkInCompletion.length > 30 && (
        <section id="full-checkin-list" className="appendix-section appendix-block full-completion-section">
          <SectionHeader
            eyebrow="Appendix"
            title={`Full check-in completion list — ${report.engagementSummary.weeklyWindowLabel}`}
            subtitle={`All ${report.engagementSummary.checkInCompletion.length} employees who completed fewer than the ${report.engagementSummary.weekly.length} check-in deliveries this period, least active first`}
            size="sm"
          />
          <div className="card">
            <ul className="completion-list full-completion-list">
              {report.engagementSummary.checkInCompletion.map((p) => (
                <li key={p.name}>
                  <span className="completion-name">
                    {p.name}
                    {!p.onRoster && <span className="sample-flag"> off-roster</span>}
                  </span>
                  <span className="completion-count">
                    {p.completed} of {p.total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  )
}
