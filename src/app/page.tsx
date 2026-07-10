import React from 'react'
import Link from 'next/link'
import { getReport, customers, slugifyTeam } from '@/lib/reportMetrics'
import {
  Delta,
  TrendDelta,
  InlineTrend,
  ConfidenceBadge,
  SeverityBadge,
  NoteRef,
  KpiCard,
  SectionHeader,
} from './_components/ui'
import TrendChart from './_components/TrendChart'
import PieChart from './_components/PieChart'
import TopBar from './_components/TopBar'
import WeeklyEngagementChart from './_components/WeeklyEngagementChart'

export const dynamic = 'force-dynamic'


export default async function Home({ searchParams }: { searchParams?: Promise<{ month?: string; customer?: string; range?: string }> }) {
  const params = (await searchParams) ?? {}
  const customer = customers.find((c) => c.id === params.customer) ?? customers[0]
  const range: 'month' | 'quarter' = params.range === 'quarter' ? 'quarter' : 'month'
  const report = getReport(customer.id, params.month, range)
  const rangeHref = (r: 'month' | 'quarter') =>
    `/?customer=${customer.id}&month=${report.month}&range=${r}`

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

  return (
    <div className="shell">
      <TopBar
        months={customer.months}
        selectedMonth={report.month}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        selectedCustomer={customer.id}
      />


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
                  {report.engagement.uniqueParticipants} of{' '}
                  {report.engagement.optedInPopulation ?? '—'} employees checked in at least once
                  this month
                </>
              }
              delta={<TrendDelta value={report.engagement.responseRateChange} suffix=" pp" />}
              deltaCaption={priorCaption}
              tone="blue"
              help={
                <>
                  Unique employees who checked in at least once during the month ÷ total
                  employees on the roster (plus any respondents not on the roster).
                </>
              }
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
        </section>

        {/* === B2. Engagement summary — monthly + weekly === */}
        {report.engagementSummary && (
          <section className="brief-section engagement-summary-section">
            <div className="engagement-section-head">
              <SectionHeader
                title="Engagement summary"
                subtitle="Monthly and weekly engagement with off-roster respondents included"
              />
              <div className="range-toggle" aria-label="Weekly engagement period">
                <a className={`range-pill${range === 'month' ? ' active' : ''}`} href={rangeHref('month')}>
                  Month
                </a>
                <a className={`range-pill${range === 'quarter' ? ' active' : ''}`} href={rangeHref('quarter')}>
                  Quarter
                </a>
              </div>
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
        </section>

        {/* === E. Leadership Priorities === */}
        <section className="brief-section action-section">
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
            <div className="card priority-actions-card">
              <div className="table-wrap">
                <table className="table priority-actions-table">
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Recommended action</th>
                      <th>Applies to</th>
                      <th>Reason</th>
                      <th>Owner</th>
                      <th>Timing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.priorityActionRows.map((row, i) => (
                      <tr key={i}>
                        <td><span className={`risk-pill priority-${row.priority.toLowerCase()}`}>{row.priority}</span></td>
                        <td><strong>{row.action}</strong></td>
                        <td>{row.appliesTo}</td>
                        <td>{row.reason}</td>
                        <td>{row.owner}</td>
                        <td>{row.timing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {report.priorityActionDetails.map((d) => (
            <div className="priority-detail-block" key={d.title}>
              <div className="priority-detail-main">
                <p className="h2-sub">{d.title}</p>
                <p>{d.description}</p>
              </div>
              <div className="priority-detail-meta">
                <p><span className="h3-micro">Applies to</span>{d.appliesTo}</p>
                <p><span className="h3-micro">Owner</span>{d.owner}</p>
                <p><span className="h3-micro">Timing</span>{d.timing}</p>
                {d.links.length > 0 && (
                  <div className="action-links">
                    {d.links.map((l) => (
                      <a key={l.label} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* === G. Emotional Wellness === */}
        <section className="brief-section emotion-section">
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

          <div className="ci-two-col">
            <div className="card">
              <h3 className="h2-sub">Work vs personal stress</h3>
              <div className="stress-rows">
                {report.commentIntelligence.stressAnalysis.map((s) => (
                  <div className={`stress-row stress-${s.category.toLowerCase().replace(/[^a-z]/g, '')}`} key={s.category}>
                    <div className="stress-head">
                      <strong>{s.category}</strong>
                      <span>{s.pct}% · {s.count}</span>
                    </div>
                    <div className="stress-bar"><i style={{ width: `${s.pct}%` }} /></div>
                    <small>{s.interpretation}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="h2-sub">Representative employee voice</h3>
              <div className="quote-grid-v2">
                {report.commentIntelligence.voiceQuotes.slice(0, 4).map((q) => (
                  <blockquote key={q}>{q}</blockquote>
                ))}
              </div>
            </div>
          </div>

          <div className="ci-two-col">
            <div className="card">
              <h3 className="h2-sub">Team-specific comment insights</h3>
              <div className="mini-insight-list">
                {report.commentIntelligence.teamSpecificInsights.map((t) => (
                  <div className="mini-insight" key={t.team}>
                    <strong>{t.team}</strong>
                    <p>{t.insight}</p>
                  </div>
                ))}
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
          <div className="team-detail-grid">
            {report.teamIntelligence.map((t, index) => (
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
                <p><strong>Manager action.</strong> {t.managerAction}</p>
                {t.commentThemes.length > 0 && (
                  <p className="muted"><strong>Comment themes.</strong> {t.commentThemes.join(', ')}</p>
                )}
                {t.privacyNote && (
                  <p className="muted"><strong>Privacy.</strong> {t.privacyNote}</p>
                )}
              </article>
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
          <div className="grid two">
            <div className="card">
              <h3 className="h2-sub">Mood distribution</h3>
              <p className="muted small">How responses are spread</p>
              <PieChart slices={report.moodDistribution} />
            </div>
            <div className="card">
              <h3 className="h2-sub">Risk / watchlist areas</h3>
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

          <div className="grid two">
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
            <div className="card">
              <h3 className="h2-sub">Manager reports</h3>
              <p className="muted small">
                {report.managerReport.eligibleTeams.length} of {report.teamIntelligence.length}{' '}
                teams meet the response threshold. Each manager sees only their team plus company
                averages.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {report.teamIntelligence.map((t) => {
                  const slug = slugifyTeam(t.team)
                  const below = t.responses < 5
                  return (
                    <Link
                      key={t.team}
                      href={`/manager/${slug}`}
                      className="rec"
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        color: 'inherit',
                        padding: 10,
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        background: '#fff',
                      }}
                    >
                      <strong style={{ display: 'block' }}>{t.team}</strong>
                      <small className="muted" style={{ display: 'block' }}>
                        {t.responses} check-ins · {t.severity}
                      </small>
                      {below ? (
                        <small className="muted" style={{ display: 'block', marginTop: 4 }}>
                          Below threshold · directional only
                        </small>
                      ) : null}
                      <small style={{ display: 'block', marginTop: 6, color: 'var(--blue)' }}>
                        View report →
                      </small>
                    </Link>
                  )
                })}
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
            <div className="retention-risk-head">
              <p className="h3-micro">Restricted · manager / HR follow-up <NoteRef n={2} /></p>
              <h3 className="h2-sub">Individual retention risk</h3>
              <p className="muted">
                Specific names should be shown only in authorized manager or HR views. Executive PDFs
                should summarize counts and teams rather than broadly distributing individual names.
              </p>
            </div>
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
      </main>
    </div>
  )
}
