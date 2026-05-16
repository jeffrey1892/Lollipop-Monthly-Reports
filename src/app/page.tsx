import DownloadPdfButton from './DownloadPdfButton'
import { getReport, customers } from '@/lib/reportMetrics'
import type { TeamMetric } from '@/lib/types'

function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="muted">—</span>
  const up = value >= 0
  return <span className={up ? 'delta up' : 'delta down'}>{up ? '↑' : '↓'} {up ? '+' : ''}{value}{suffix}</span>
}
function PriorBox({ label, value, change, suffix = '' }: { label: string; value: string; change: number | null; suffix?: string }) {
  if (change === null) return <div className="prior-box neutral" aria-label={`${label} prior month not available`}><span className="prior-label">Prior Month</span><strong>—</strong><small>No prior data</small></div>
  const up = change >= 0
  const flat = change === 0
  return <div className={`prior-box ${flat ? 'neutral' : up ? 'up' : 'down'}`} aria-label={`${label} prior month ${value}; change ${change}${suffix}`}>
    <span className="prior-label">Prior Month</span>
    <strong>{value}</strong>
    <small>{flat ? '→' : up ? '↗' : '↘'} {up && !flat ? '+' : ''}{change}{suffix}</small>
  </div>
}
function InlineTrend({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="inline-trend neutral">No prior comparison</span>
  const up = value >= 0
  const flat = value === 0
  return <span className={`inline-trend ${flat ? 'neutral' : up ? 'up' : 'down'}`}>{flat ? '→' : up ? '↗' : '↘'} {up && !flat ? '+' : ''}{value}{suffix}</span>
}
function KpiWithPrior({ label, value, priorValue, priorChange, priorSuffix = '', note }: { label: React.ReactNode; value: React.ReactNode; priorValue: string; priorChange: number | null; priorSuffix?: string; note?: React.ReactNode }) {
  return <div className="card kpi kpi-with-prior"><div className="kpi-main"><p className="eyebrow">{label}</p><strong>{value}</strong>{note}</div><PriorBox label={typeof label === 'string' ? label : 'value'} value={priorValue} change={priorChange} suffix={priorSuffix} /></div>
}
function Kpi({ label, value, delta, tone }: { label: React.ReactNode; value: React.ReactNode; delta?: React.ReactNode; tone?: string }) {
  return <div className={`card kpi ${tone ?? ''}`}><p className="eyebrow">{label}</p><strong>{value}</strong><div>{delta}</div></div>
}
function ConfidenceBadge({ value }: { value: string }) { return <span className={`badge confidence ${value.toLowerCase()}`}>Confidence: {value} <NoteRef n={3} /></span> }
function SeverityBadge({ value }: { value: string }) { return <span className={`badge severity ${value.toLowerCase().replace(' ', '-')}`}>{value}</span> }
function NoteRef({ n }: { n: number }) { return <sup className="note-ref">See Explanatory Note {n}</sup> }
function PieChart({ slices }: { slices: Array<{ mood: string; label: string; pct: number; color: string; count: number; emoji: string }> }) {
  const total = slices.reduce((a, b) => a + b.count, 0)
  if (!total) return <div className="empty-state" role="status">No mood responses recorded for this period.</div>
  let start = 0
  const gradient = slices.map((s) => { const end = start + s.pct; const seg = `${s.color} ${start}% ${end}%`; start = end; return seg }).join(', ')
  const desc = slices.map((s) => `${s.label} ${s.pct}%`).join(', ')
  return <div className="pie-wrap" role="img" aria-label={`Mood distribution: ${desc}. ${total} responses.`}><div className="pie" style={{ background: `conic-gradient(${gradient})` }}><span>{total}<small>responses</small></span></div><div className="legend">{slices.map((s) => <div key={s.mood}><img src={s.emoji} alt={`${s.label} mood`} />{s.label}: <strong>{s.pct}%</strong><small>{s.count}</small></div>)}</div></div>
}
function teamLabel(severity: string) {
  if (severity === 'High' || severity === 'Critical') return 'Needs Attention'
  if (severity === 'Watchlist') return 'Watch Team'
  return severity
}
function TeamSeverityBadge({ value }: { value: string }) {
  const label = teamLabel(value)
  return <span className={`badge severity ${value.toLowerCase().replace(' ', '-')}`}>{label}</span>
}
function TeamCompareList({ title, subtitle, teams, mode }: { title: string; subtitle: string; teams: TeamMetric[]; mode: 'top' | 'watch' | 'increase' | 'decline' }) {
  return <div className="card team-compare">
    <div className="page-label"><strong>{title}</strong><span>{subtitle}</span></div>
    {teams.length === 0
      ? <p className="empty-state">{mode === 'increase' ? 'No teams crossed the meaningful-improvement threshold this period.' : mode === 'decline' ? 'No teams crossed the meaningful-decline threshold this period.' : mode === 'watch' ? 'No teams currently meet the watch threshold.' : 'No teams meet the sample threshold yet.'}</p>
      : <ol className="team-compare-list">
        {teams.map((t) => <li key={t.team}>
          <div className="tc-head"><strong>{t.team}</strong><span className="tc-mood">{t.avgMood.toFixed(2)}</span></div>
          <div className="tc-meta">
            <span>{t.positivePct}% positive</span>
            <span>{t.responses} responses</span>
            {t.change !== null && <span className={t.change >= 0 ? 'tc-up' : 'tc-down'}>{t.change >= 0 ? '↗' : '↘'} {t.change > 0 ? '+' : ''}{t.change}</span>}
          </div>
        </li>)}
      </ol>}
  </div>
}
function CommentPriorComparison({ priorComparison }: { priorComparison: import('@/lib/types').CommentPriorComparison }) {
  if (!priorComparison.hasPriorData) {
    return <p className="comment-prior-empty empty-state">No prior-month comment data available, so prior-month theme comparison is not shown.</p>
  }
  const blocks: Array<{ key: string; title: string; items: string[]; tone: string }> = [
    { key: 'improving', title: 'Improving themes', tone: 'positive', items: priorComparison.improving.map((i) => `${i.theme} (${i.priorCount} → ${i.currentCount})`) },
    { key: 'persisting', title: 'Persisting themes', tone: 'neutral', items: priorComparison.persisting.map((i) => `${i.theme} (${i.priorCount} → ${i.currentCount})`) },
    { key: 'worsening', title: 'Worsening themes', tone: 'attention', items: priorComparison.worsening.map((i) => `${i.theme} (${i.priorCount} → ${i.currentCount})`) },
    { key: 'faded', title: 'Themes that faded', tone: 'positive', items: priorComparison.faded.map((i) => `${i.theme} (was ${i.priorCount})`) },
    { key: 'spreading', title: 'Themes spreading to more teams', tone: 'attention', items: priorComparison.spreading.map((i) => `${i.theme} (${i.priorTeams} → ${i.currentTeams} teams)`) },
    { key: 'new', title: 'New themes this month', tone: 'attention', items: priorComparison.newThemes.map((i) => `${i.theme} (${i.currentCount})`) },
    { key: 'persistingTeams', title: 'Themes staying in the same teams', tone: 'neutral', items: priorComparison.persistingTeams.map((i) => `${i.theme}: ${i.teams.join(', ')}`) },
  ].filter((b) => b.items.length)
  if (!blocks.length) return <p className="comment-prior-empty empty-state">Comment themes are broadly stable versus the prior month — no notable improvements, worsenings, or new themes detected.</p>
  return <div className="comment-prior-grid">
    {blocks.map((b) => <div key={b.key} className={`comment-prior-card tone-${b.tone}`}>
      <h3>{b.title}</h3>
      <ul>{b.items.map((it) => <li key={it}>{it}</li>)}</ul>
    </div>)}
  </div>
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const customer = customers[0]
  const params = (await searchParams) ?? {}
  const report = getReport(customer.id, params.month)
  const maxResponses = Math.max(...report.monthlyTrend.map((m) => m.responses), 1)
  const hotspots = report.watchTeams.slice(0, 2).map((t) => t.team).join(' and ') || 'no concentrated hotspot'
  const urgencyRank: Record<string, number> = { High: 1, Medium: 2, Low: 3 }
  const topPriorities = [...report.recommendations].sort((a, b) => (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9) || a.priority.localeCompare(b.priority)).slice(0, 3)
  const top5Teams = [...report.allTeams].filter((t) => !t.sampleWarning).sort((a, b) => b.avgMood - a.avgMood || b.responses - a.responses).slice(0, 5)
  const watch4 = report.watchTeams.slice(0, 5)
  const increases = report.improvingTeams.slice(0, 5)
  const declines = report.decliningTeams.slice(0, 5)
  const priorAvgMood = report.avgMoodChange !== null ? (report.avgMood - report.avgMoodChange) : null
  const priorPositive = report.positiveChange !== null ? (report.positivePct - report.positiveChange) : null

  return <div className="shell"><header className="topbar"><div className="wrap"><div className="brand"><span className="mark">lp</span><span>Prepared by Lollipop<small>Workforce intelligence platform</small></span></div><form className="controls"><label htmlFor="report-month" className="sr-only">Report month</label><select id="report-month" name="month" defaultValue={report.month} aria-label="Report month">{customer.months.map((m) => <option key={m.month} value={m.month}>{m.label}</option>)}</select><button className="btn primary">Generate Report</button><DownloadPdfButton /></form></div></header><main className="wrap pages">

<section className="exec-cover brief-section"><div><p className="eyebrow">Prepared by Lollipop</p><h1 className="client-title">{report.customerName}</h1><p className="report-subtitle">Workforce Intelligence Report · {report.label}</p><div className="dashboard-help"><a href="https://www.trylollipop.com/resources-page-hidden" target="_blank" rel="noreferrer">Watch dashboard explanation video</a><a href="mailto:support@trylollipop.com">Dashboard support: support@trylollipop.com</a></div></div><div className={`status-tile ${report.healthSummary.rating.toLowerCase()}`} aria-label={`Organizational Health: ${report.healthSummary.rating}, score ${report.healthSummary.score} of 100`}><span>Organizational Health <NoteRef n={1} /></span><strong>{report.healthSummary.rating}</strong><small>{report.healthSummary.score}/100</small></div></section>

<section className="top-kpi-row brief-section">
  <div className="top-kpi-grid">
    <KpiWithPrior label="Average Mood" value={report.avgMood.toFixed(2)} priorValue={priorAvgMood !== null ? priorAvgMood.toFixed(2) : '—'} priorChange={report.avgMoodChange} />
    <KpiWithPrior label="Positive Sentiment" value={`${report.positivePct}%`} priorValue={priorPositive !== null ? `${Math.round(priorPositive)}%` : '—'} priorChange={report.positiveChange} priorSuffix=" pts" />
    <Kpi label="Engagement" value={<span className="kpi-value-row"><span>{report.engagement.responseRate !== null ? `${report.engagement.responseRate}%` : `${report.responseCount}`}</span><InlineTrend value={report.engagement.responseRateChange} suffix=" pp" /></span>} delta={<><span className="kpi-note">{`${report.engagement.uniqueParticipants} of ${report.engagement.optedInPopulation ?? 'unknown'} opted-in`}{report.engagement.participationChange !== null ? ` · ${report.engagement.participationChange > 0 ? '+' : ''}${report.engagement.participationChange} check-ins` : ''}</span><span className="kpi-note">Unique employees checking in during the period divided by total opted-in employees.</span></>}/>
    <Kpi label="Watchlist Teams" value={`${report.watchTeams.length}`} delta={hotspots}/>
  </div>
  <div className="card top-kpi-pie"><h2>Mood Distribution</h2><PieChart slices={report.moodDistribution} /></div>
</section>

<section className="team-compare-grid brief-section">
  <TeamCompareList title="Top 5 Teams" subtitle="Highest average mood" teams={top5Teams} mode="top" />
  <TeamCompareList title="Watch Teams" subtitle="Concentrated risk signal" teams={watch4} mode="watch" />
  <TeamCompareList title="Largest Team Increases" subtitle="Biggest mood gains vs prior month" teams={increases} mode="increase" />
  <TeamCompareList title="Largest Team Declines" subtitle="Biggest mood drops vs prior month" teams={declines} mode="decline" />
</section>

<section className="card section brief-section priority-card"><div className="page-label"><strong>Suggested Leadership Actions</strong><span>Includes leadership recommendations from comment analysis</span></div><div className="priority-grid">{topPriorities.length ? topPriorities.map((r) => <div className={`priority-row urgency-${r.urgency.toLowerCase()}`} key={r.title}><span className="priority">{r.priority}</span><div><div className="priority-head"><strong>{r.title}</strong><span className="urgency-pill">{r.urgency}</span></div><p>{r.nextStep}</p><small>{r.owner} · {r.urgency} urgency · {r.impact} impact</small>{r.links && <div className="action-links">{r.links.map((l) => <a key={l.label} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>)}</div>}</div></div>) : <p className="empty-state">No suggested actions for this period.</p>}</div>
{report.commentIntelligence.leadershipRecommendations.length > 0 && <div className="leadership-recs-inline"><h3>Leadership Recommendations Based on Comment Analysis</h3><ul>{report.commentIntelligence.leadershipRecommendations.slice(0,6).map((r) => <li key={r}>{r}</li>)}</ul></div>}
</section>

<section className="card section brief-section executive-summary-wide"><p className="eyebrow">Executive Summary</p><h2>{report.strategicNarrative[0]}</h2><p>{report.strategicNarrative[1]}</p><p className="muted">{report.strategicNarrative[2]}</p></section>

<section className="card section appendix-section"><div className="page-label"><strong>Company-Wide Sentiment Trends</strong><span>Appendix detail</span></div><div className="trend" role="img" aria-label={`Monthly trend across ${report.monthlyTrend.length} months`}>{report.monthlyTrend.map((m) => <div className="trend-col" key={m.label}><i style={{ height: `${Math.max(30, (m.responses / maxResponses) * 160)}px` }} aria-hidden="true" /><strong>{m.label}</strong><span>{m.avgMood.toFixed(2)} · {m.responses}</span></div>)}</div><div className="insight-grid trend-summary"><p><strong>Trailing 3-month avg:</strong> {report.trend.threeMonthAvgMood ?? 'n/a'}</p><p><strong>Rolling positive:</strong> {report.trend.rollingPositivePct ?? 'n/a'}%</p><p><strong>Best / worst:</strong> {report.trend.bestMonth} / {report.trend.worstMonth}</p><p><strong>Persistence:</strong> {report.trend.meaningfulMovement}</p></div></section>

<section className="grid two section brief-section emotional-wellness-row"><div className="card emotional-wellness-card"><div className="page-label"><strong>Emotional Wellness Trends</strong><span>Top emotions and mood mix</span></div>{report.topEmotions.length ? report.topEmotions.slice(0,5).map((e) => <div key={e.emotion}><p>{e.emotion}: {e.count}</p><div className="bar" role="img" aria-label={`${e.emotion} ${e.pct}%`}><i style={{ width: `${e.pct}%` }} /></div></div>) : <p className="empty-state">No emotion responses recorded for this period.</p>}</div><div className="card"><h2>Key Themes</h2><ul className="theme-summary-list">{report.commentIntelligence.themes.length ? report.commentIntelligence.themes.slice(0,5).map((t) => <li key={t.theme}><strong>{t.theme}</strong><small>{t.signal}</small></li>) : <li className="empty-state">No themes detected from comments in this period.</li>}</ul></div></section>

<section className="card section brief-section comment-intelligence"><div className="page-label"><strong>COMMENT INTELLIGENCE &amp; THEMATIC ANALYSIS</strong><span>What employee comments are revealing</span></div><p className="comment-summary">{report.commentIntelligence.executiveSummary}</p>
<div className="comment-prior-section"><h3 className="comment-prior-title">Prior-Month Comment Comparison</h3><CommentPriorComparison priorComparison={report.commentIntelligence.priorComparison} /></div>
<div className="comment-table-wrap"><table className="table comment-theme-table"><thead><tr><th>Theme</th><th>Trend Direction</th><th>Sentiment</th><th>Primary Teams</th><th>Executive Interpretation</th></tr></thead><tbody>{report.commentIntelligence.themeTable.map((t) => <tr key={t.theme}><td><strong>{t.theme}</strong></td><td>{t.trendDirection}</td><td>{t.sentimentType}</td><td>{t.primaryTeams}</td><td>{t.interpretation}</td></tr>)}</tbody></table></div>
<div className="grid two comment-subgrid comment-pdf-pair"><div className="insight-card positive"><h2>Positive Drivers</h2><ul>{report.commentIntelligence.positiveDrivers.map((d) => <li key={d}>{d}</li>)}</ul></div><div className="insight-card attention"><h2>Areas Requiring Attention</h2><ul>{report.commentIntelligence.attentionAreas.map((a) => <li key={a}>{a}</li>)}</ul></div></div>
<div className="grid two comment-subgrid"><div className="insight-card"><h2>Personal vs Work-Related Stress Analysis</h2><table className="table"><tbody>{report.commentIntelligence.stressAnalysis.map((s) => <tr key={s.category}><td><strong>{s.category}</strong></td><td>{s.pct}%</td><td>{s.count}</td><td>{s.interpretation}</td></tr>)}</tbody></table></div><div className="insight-card"><h2>Representative Employee Voice</h2><div className="quote-grid">{report.commentIntelligence.voiceQuotes.slice(0,4).map((q) => <blockquote key={q}>{q}</blockquote>)}</div></div></div>
<div className="insight-card team-comment-card"><h2>Team-Specific Comment Insights</h2>{report.commentIntelligence.teamSpecificInsights.length ? report.commentIntelligence.teamSpecificInsights.map((t) => <div className="mini-insight" key={t.team}><strong>{t.team}</strong><p>{t.insight}</p></div>) : <p className="empty-state">No team-specific comment volume met the threshold this period.</p>}</div>
</section>

<section className="card section appendix-section"><h2 className="section-title-centered">Team-Level Intelligence</h2><p className="section-subtitle-centered">Ranked appendix</p>
<div className="team-legend" aria-label="Team severity legend">
  <span className="legend-pill needs-attention">Needs Attention <small>— low mood / movement; manager attention required</small></span>
  <span className="legend-pill watch-team">Watch Team <small>— softening or low-sample signal; monitor next month</small></span>
  <span className="legend-pill positive-momentum">Positive Momentum <small>— sustained gains worth preserving</small></span>
  <span className="legend-pill stable">Stable <small>— no acute signal</small></span>
</div>
<div className="team-grid">{report.teamIntelligence.map((t, index) => <div className="team-card" key={t.team}><div className="page-label"><strong>#{index + 1} {t.team}</strong><TeamSeverityBadge value={t.severity} /></div><div className="team-metrics"><div><span>Mood</span><strong>{t.avgMood.toFixed(2)}</strong><small><Delta value={t.change} /></small></div><div><span>Positive</span><strong>{t.positivePct}%</strong><small>{t.positiveCount} positive</small></div><div><span>Neutral</span><strong>{t.neutralPct}%</strong><small>{t.neutralCount} neutral</small></div><div><span>Negative</span><strong>{t.negativePct}%</strong><small>{t.negativeCount} negative</small></div><div><span>Participation</span><strong>{t.responses}</strong><small><Delta value={t.participationTrend} /> vs prior</small></div><div><span>Confidence</span><strong>{t.confidence}</strong><small>{t.sampleWarning ? <>Low sample <NoteRef n={4} /></> : 'Usable read'}</small></div></div><p><strong>Primary read:</strong> {t.keyConcernOrStrength}</p><p><strong>Manager action:</strong> {t.managerAction}</p>{t.commentThemes.length > 0 && <p className="muted"><strong>Comment themes:</strong> {t.commentThemes.join(', ')}</p>}{t.privacyNote && <p className="muted"><strong>Privacy:</strong> {t.privacyNote}</p>}</div>)}</div></section>

<section className="card section brief-section retention-risk-section"><h2 className="section-title-centered">Individual Retention Risk</h2><p className="section-subtitle-centered">Restricted manager / HR follow-up view <NoteRef n={2} /></p><p className="muted">Specific names should be shown only in authorized manager or HR views. Executive PDFs should summarize counts and teams rather than broadly distributing individual names.</p><div className="retention-grid">{report.individualRetentionRisks.length ? report.individualRetentionRisks.map((r) => <div className="retention-card" key={`${r.employeeName}-${r.team}`}><div className="priority-head"><strong>{r.employeeName}</strong><span className="urgency-pill">{r.riskLevel}</span></div><p><strong>Team:</strong> {r.team}</p><p><strong>Current mood:</strong> {r.currentMood} · <strong>Low check-ins:</strong> {r.lowCheckIns}</p><p><strong>Trend:</strong> {r.trend}</p><p><strong>Drivers:</strong> {r.drivers.join(', ')}</p><p><strong>Suggested action:</strong> {r.recommendedAction}</p><ConfidenceBadge value={r.confidence} /></div>) : <p className="empty-state">No individual retention-risk flags met the current threshold.</p>}</div></section>

<section className="grid two section brief-section"><div className="card"><p className="eyebrow">Risk / Watchlist Areas</p><div className="list">{report.riskWatchlist.length ? report.riskWatchlist.slice(0,4).map((r) => <div className="rec" key={r.title}><strong>{r.title} <SeverityBadge value={r.severity} /></strong><p>{r.signal}</p><p><strong>Action:</strong> {r.recommendedAction}</p></div>) : <p className="empty-state">No active risk signals this period.</p>}</div></div><div className="card"><p className="eyebrow">Positive Momentum / What’s Working</p><div className="list">{report.positiveMomentum.length ? report.positiveMomentum.slice(0,4).map((r) => <div className="rec" key={r.title}><strong>{r.title}</strong><p>{r.signal}</p><p><strong>Preserve:</strong> {r.recommendedAction}</p></div>) : <p className="empty-state">No standout positive-momentum signals this period.</p>}</div></div></section>

<section className="grid two section appendix-section"><div className="card"><p className="eyebrow">Manager Report Outputs</p><h2>Scoped team-only reports</h2><p>{report.managerReport.description}</p><p><strong>Eligible teams:</strong> {report.managerReport.eligibleTeams.join(', ') || 'None yet'}</p><ul className="list compact">{report.managerReport.safeguards.map((s) => <li key={s}>{s}</li>)}</ul></div><div className="card"><p className="eyebrow">Data Quality &amp; Confidence <NoteRef n={3} /></p><h2>{report.reportConfidenceScore}/100 · {report.reportConfidence}</h2><p>{report.confidenceRationale}</p><p><strong>Low-sample teams <NoteRef n={4} />:</strong> {report.lowConfidenceTeams.length ? report.lowConfidenceTeams.map((t) => t.team).join(', ') : 'None'}</p></div></section>

<section className="card section appendix-section"><div className="page-label"><strong>Explanatory Notes</strong><span>Definitions and methodology references</span></div><div className="notes-grid"><div id="note-1"><strong>Explanatory Note 1 — Organizational Health</strong><p>Organizational Health is a composite rating that summarizes overall workforce condition for the period. It synthesizes average mood, positive sentiment, engagement quality, trend direction, team consistency, risk flags, and comment signals into a practical executive read such as Strong, Healthy, Mixed, Watchlist, or At Risk.</p></div><div id="note-2"><strong>Explanatory Note 2 — Individual Retention Risk</strong><p>Individual Retention Risk is a restricted manager/HR follow-up signal, not a public performance label or a prediction that someone will resign. It looks for repeated low check-ins, current low mood, meaningful mood declines over recent check-ins, stress/burnout or workload language in comments, negative-emotion patterns, unresolved follow-up requests, and other load/capacity signals. Names should be visible only in authorized manager or HR views.</p></div><div id="note-3"><strong>Explanatory Note 3 — Confidence</strong><p>Confidence is a reliability indicator, not a performance score. It reflects response volume, team coverage, comment depth, trend consistency, and data completeness. High confidence is decision-ready; medium is directional; low/provisional should be validated before major decisions.</p></div><div id="note-4"><strong>Explanatory Note 4 — Low Sample</strong><p>Team-level findings below 5 responses should not be overinterpreted. Comment themes are suppressed or generalized below 3 comments to protect privacy and reduce over-identification risk.</p></div></div></section>

<section className="card section appendix-section"><p className="eyebrow">Appendix / Methodology Improvements</p><ul className="list">{report.improvements.map((i) => <li key={i}>{i}</li>)}</ul><p className="muted">Confirmed direction: brief PDF for executives; full report with appendices for operators and HR.</p></section>

</main></div>
}
