import React from 'react'
import DownloadPdfButton from './DownloadPdfButton'
import { getReport, customers } from '@/lib/reportMetrics'
import {
  Delta,
  TrendDelta,
  InlineTrend,
  ConfidenceBadge,
  SeverityBadge,
  NoteRef,
  KpiCard,
} from './_components/ui'
import TrendChart from './_components/TrendChart'
import TeamRankCard from './_components/TeamRankCard'
import PieChart from './_components/PieChart'

const URGENCY_RANK: Record<string, number> = { High: 1, Medium: 2, Low: 3 }

export default async function Home({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const customer = customers[0]
  const params = (await searchParams) ?? {}
  const report = getReport(customer.id, params.month)

  const sortedRecs = [...report.recommendations].sort(
    (a, b) =>
      (URGENCY_RANK[a.urgency] ?? 9) - (URGENCY_RANK[b.urgency] ?? 9) ||
      a.priority.localeCompare(b.priority),
  )

  // Engagement tone
  const engagementPct = report.engagement.responseRate
  const watchTone: 'green' | 'amber' | 'coral' =
    report.watchTeams.length === 0 ? 'green' : report.watchTeams.length > 2 ? 'coral' : 'amber'
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

  // What changed / strategic narrative split
  const sn = report.strategicNarrative
  const whatChangedNarrative = sn[0] ?? 'Stable period with no headline shifts.'
  const whyItMattersNarrative = sn[1] ?? report.executiveSummary
  const leadershipFocusNarrative = sn[2] ?? 'Continue current cadence and re-evaluate next cycle.'

  return (
    <div className="shell">
      {/* === Topbar (compact dashboard nav) === */}
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand-block">
            <div className="brand-mark">L</div>
            <div>
              <strong className="brand-name">Lollipop</strong>
              <small>Workforce Intelligence</small>
            </div>
          </div>
          <form className="controls" action="">
            <select name="month" defaultValue={report.month} aria-label="Reporting month">
              {customer.months.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.label}
                </option>
              ))}
            </select>
            <button className="btn primary" type="submit">
              Generate
            </button>
            <DownloadPdfButton />
          </form>
        </div>
      </header>

      <main className="wrap pages">
        {/* === A. Executive Header === */}
        <section className="exec-header brief-section">
          <div className="exec-header-main">
            <p className="eyebrow">Workforce Intelligence Report</p>
            <div className="exec-header-title-row">
              <h1 className="client-title">{report.customerName}</h1>
              <div className={`health-tile health-${report.healthSummary.rating.toLowerCase().replace(/\s+/g, '-')}`}>
                <span className="health-label">
                  Organizational Health <NoteRef n={1} />
                </span>
                <strong>{report.healthSummary.rating}</strong>
                <small>{report.healthSummary.score} / 100</small>
              </div>
            </div>
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
        </section>

        {/* === B. Executive KPI Snapshot === */}
        <section className="brief-section kpi-grid">
          <KpiCard
            label="Average Mood"
            value={report.avgMood.toFixed(2)}
            sub={<>out of 5.00</>}
            delta={<TrendDelta value={report.avgMoodChange} />}
            tone={moodTone}
          />
          <KpiCard
            label="Positive Sentiment"
            value={`${report.positivePct}%`}
            sub={<>of all check-ins</>}
            delta={<TrendDelta value={report.positiveChange} suffix=" pts" />}
            tone={positiveTone}
          />
          <KpiCard
            label="Participation Rate"
            value={engagementPct !== null ? `${engagementPct}%` : '—'}
            sub={
              <>
                {report.engagement.uniqueParticipants} of{' '}
                {report.engagement.optedInPopulation ?? '—'} opted-in
              </>
            }
            delta={<TrendDelta value={report.engagement.responseRateChange} suffix=" pp" />}
            tone="blue"
          />
          <KpiCard
            label="Total Responses"
            value={report.responseCount}
            sub={<>check-ins this period</>}
            delta={<TrendDelta value={report.engagement.participationChange} suffix=" check-ins" />}
            tone="neutral"
          />
          <KpiCard
            label="Teams Requiring Attention"
            value={report.watchTeams.length}
            sub={
              report.watchTeams.length > 0 ? (
                <>{report.watchTeams.map((t) => t.team).join(', ')}</>
              ) : (
                <>no concentrated hotspot</>
              )
            }
            tone={watchTone}
          />
          {report.followUpRequests > 0 && (
            <KpiCard
              label="Follow-Up Requests"
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
        </section>

        {/* === C. Executive Summary === */}
        <section className="brief-section narrative-grid">
          <div className="narrative-card narr-changed">
            <p className="eyebrow">What Changed</p>
            <p className="narrative-headline">{whatChangedNarrative}</p>
            {report.whatChanged[0] && (
              <p className="narrative-detail">{report.whatChanged[0].detail}</p>
            )}
          </div>
          <div className="narrative-card narr-matters">
            <p className="eyebrow">Why It Matters</p>
            <p className="narrative-headline">{whyItMattersNarrative}</p>
            <p className="narrative-detail">{report.executiveSummary}</p>
          </div>
          <div className="narrative-card narr-focus">
            <p className="eyebrow">Recommended Leadership Focus</p>
            <p className="narrative-headline">{leadershipFocusNarrative}</p>
            {report.leadershipAttention[0] && (
              <p className="narrative-detail">{report.leadershipAttention[0]}</p>
            )}
          </div>
        </section>

        {/* === D. Priority Action Items === */}
        <section className="brief-section action-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Priority Action Items</p>
              <h2>What leadership should do next</h2>
            </div>
            <small className="muted">Sorted by urgency · {sortedRecs.length} actions</small>
          </div>
          <div className="action-grid-v2">
            {sortedRecs.map((r) => (
              <article
                key={r.title}
                className={`action-card urgency-${r.urgency.toLowerCase()}`}
              >
                <div className="action-card-head">
                  <span className="action-priority">{r.priority}</span>
                  <span className="urgency-pill">{r.urgency} urgency</span>
                </div>
                <h3>{r.title}</h3>
                {r.trigger && (
                  <p className="action-block">
                    <span className="label">Issue</span>
                    {r.trigger}
                  </p>
                )}
                <p className="action-block">
                  <span className="label">Why it matters</span>
                  {r.why}
                </p>
                <p className="action-block">
                  <span className="label">Recommended action</span>
                  {r.nextStep}
                </p>
                <footer className="action-card-foot">
                  <small>
                    {r.owner} · {r.impact} impact · {r.difficulty} difficulty
                  </small>
                  {r.links && r.links.length > 0 && (
                    <div className="action-links">
                      {r.links.map((l) => (
                        <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </section>

        {/* === E. Company-Wide Trend Dashboard === */}
        <section className="brief-section trend-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Company-Wide Trends</p>
              <h2>Sentiment and participation over time</h2>
            </div>
          </div>
          <div className="trend-card-grid">
            <div className="card trend-chart-card">
              <TrendChart data={report.monthlyTrend} />
            </div>
            <div className="trend-stats">
              <div className="stat-tile">
                <span>Trailing 3-month mood</span>
                <strong>{report.trend.threeMonthAvgMood ?? '—'}</strong>
              </div>
              <div className="stat-tile">
                <span>Rolling positive</span>
                <strong>{report.trend.rollingPositivePct ?? '—'}%</strong>
              </div>
              <div className="stat-tile">
                <span>Best month</span>
                <strong>{report.trend.bestMonth}</strong>
              </div>
              <div className="stat-tile">
                <span>Worst month</span>
                <strong>{report.trend.worstMonth}</strong>
              </div>
              <div className="stat-tile wide">
                <span>Persistence</span>
                <strong className="stat-narrative">{report.trend.meaningfulMovement}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* === F. Team Performance Dashboard === */}
        <section className="brief-section team-perf-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Team Performance</p>
              <h2>Rankings and movement by team</h2>
            </div>
          </div>
          <div className="team-perf-grid">
            <TeamRankCard
              title="Top Performing"
              subtitle="Highest average mood"
              teams={report.topTeams}
              tone="green"
              variant="bars"
            />
            <TeamRankCard
              title="Watch / Lowest"
              subtitle="Concentrated risk signal"
              teams={report.watchTeams}
              tone="coral"
            />
            <TeamRankCard
              title="Biggest Improvement"
              subtitle="Largest mood gains vs prior month"
              teams={report.improvingTeams}
              tone="blue"
            />
            <TeamRankCard
              title="Biggest Decline"
              subtitle="Largest mood drops vs prior month"
              teams={report.decliningTeams}
              tone="amber"
            />
          </div>
        </section>

        {/* === G. Emotional Wellness === */}
        <section className="brief-section emotion-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Emotional Wellness</p>
              <h2>Most-named emotions this period</h2>
            </div>
          </div>
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
              <p className="eyebrow">Interpretation</p>
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

        {/* === H. Comment Intelligence === */}
        <section className="brief-section comment-intel-v2">
          <div className="section-header centered">
            <p className="eyebrow ai">AI · Comment Intelligence</p>
            <h2 className="serif-heading">What employee comments are revealing</h2>
            <p className="muted small">
              Synthesized from {report.commentIntelligence.commentCount} free-text comments
            </p>
          </div>

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
            <p className="eyebrow">Theme detail</p>
            <div className="table-wrap">
              <table className="table ci-theme-table">
                <thead>
                  <tr>
                    <th>Theme</th>
                    <th>Trend</th>
                    <th>Sentiment</th>
                    <th>Primary Teams</th>
                    <th>Executive Interpretation</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ci-two-col">
            <div className="card ci-list positive">
              <p className="eyebrow">Positive Drivers</p>
              <ul>
                {report.commentIntelligence.positiveDrivers.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="card ci-list attention">
              <p className="eyebrow">Areas Requiring Attention</p>
              <ul>
                {report.commentIntelligence.attentionAreas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="ci-two-col">
            <div className="card">
              <p className="eyebrow">Personal vs Work-Related Stress</p>
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
              <p className="eyebrow">Representative Employee Voice</p>
              <div className="quote-grid-v2">
                {report.commentIntelligence.voiceQuotes.slice(0, 4).map((q) => (
                  <blockquote key={q}>{q}</blockquote>
                ))}
              </div>
            </div>
          </div>

          <div className="ci-two-col">
            <div className="card">
              <p className="eyebrow">Team-Specific Comment Insights</p>
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
              <p className="eyebrow">Leadership Recommendations</p>
              <ol className="recs-ol">
                {report.commentIntelligence.leadershipRecommendations.slice(0, 6).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* === I. Detailed Team Breakdowns === */}
        <section className="appendix-section team-detail-section">
          <div className="section-header centered">
            <p className="eyebrow">Appendix</p>
            <h2 className="serif-heading">Team-Level Intelligence</h2>
            <p className="muted small">Full breakdown ranked by signal strength</p>
          </div>
          <div className="team-detail-grid">
            {report.teamIntelligence.map((t, index) => (
              <article className="team-detail-card" key={t.team}>
                <header>
                  <span className="team-rank-num">#{index + 1}</span>
                  <div>
                    <h3>{t.team}</h3>
                    <SeverityBadge value={t.severity} />
                  </div>
                </header>
                <div className="team-detail-metrics">
                  <div><span>Mood</span><strong>{t.avgMood.toFixed(2)}</strong><small><Delta value={t.change} /></small></div>
                  <div><span>Positive</span><strong>{t.positivePct}%</strong><small>{t.positiveCount} positive</small></div>
                  <div><span>Neutral</span><strong>{t.neutralPct}%</strong><small>{t.neutralCount} neutral</small></div>
                  <div><span>Negative</span><strong>{t.negativePct}%</strong><small>{t.negativeCount} negative</small></div>
                  <div><span>Participation</span><strong>{t.responses}</strong><small><Delta value={t.participationTrend} /> vs prior</small></div>
                  <div><span>Confidence</span><strong>{t.confidence}</strong><small>{t.sampleWarning ? <>Low sample <NoteRef n={4} /></> : 'Usable read'}</small></div>
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
        <section className="appendix-section grid two">
          <div className="card">
            <p className="eyebrow">Mood Distribution</p>
            <h2>How responses are spread</h2>
            <PieChart slices={report.moodDistribution} />
          </div>
          <div className="card">
            <p className="eyebrow">Risk / Watchlist Areas</p>
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
        </section>

        <section className="appendix-section grid two">
          <div className="card">
            <p className="eyebrow">Positive Momentum / What&apos;s Working</p>
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
            <p className="eyebrow">Manager Report Outputs</p>
            <h2>Scoped team-only reports</h2>
            <p>{report.managerReport.description}</p>
            <p>
              <strong>Eligible teams:</strong>{' '}
              {report.managerReport.eligibleTeams.join(', ') || 'None yet'}
            </p>
            <ul className="list compact">
              {report.managerReport.safeguards.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="appendix-section card">
          <p className="eyebrow">
            Data Quality &amp; Confidence <NoteRef n={3} />
          </p>
          <h2>
            {report.reportConfidenceScore}/100 · {report.reportConfidence}
          </h2>
          <p>{report.confidenceRationale}</p>
          <p>
            <strong>
              Low-sample teams <NoteRef n={4} />:
            </strong>{' '}
            {report.lowConfidenceTeams.length
              ? report.lowConfidenceTeams.map((t) => t.team).join(', ')
              : 'None'}
          </p>
        </section>

        <section className="appendix-section retention-risk-section">
          <div className="section-header centered">
            <p className="eyebrow">Restricted</p>
            <h2 className="serif-heading">Individual Retention Risk</h2>
            <p className="muted small">
              Manager / HR follow-up view <NoteRef n={2} />
            </p>
          </div>
          <p className="muted">
            Specific names should be shown only in authorized manager or HR views. Executive PDFs
            should summarize counts and teams rather than broadly distributing individual names.
          </p>
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
        </section>

        <section className="appendix-section card">
          <p className="eyebrow">Explanatory Notes</p>
          <h2>Definitions and methodology references</h2>
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
        </section>

        <section className="appendix-section card">
          <p className="eyebrow">Methodology Improvements</p>
          <ul className="list">
            {report.improvements.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="muted">
            Confirmed direction: brief PDF for executives; full report with appendices for operators
            and HR.
          </p>
        </section>
      </main>
    </div>
  )
}
