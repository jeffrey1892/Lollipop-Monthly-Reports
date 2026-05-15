import DownloadPdfButton from './DownloadPdfButton'
import { getReport, customers } from '@/lib/reportMetrics'

function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="muted">—</span>
  const up = value >= 0
  return <span className={up ? 'delta up' : 'delta down'}>{up ? '↑' : '↓'} {up ? '+' : ''}{value}{suffix}</span>
}
function Kpi({ label, value, delta, tone }: { label: string; value: string; delta?: React.ReactNode; tone?: string }) {
  return <div className={`card kpi ${tone ?? ''}`}><p className="eyebrow">{label}</p><strong>{value}</strong><div>{delta}</div></div>
}
function ConfidenceBadge({ value }: { value: string }) { return <span className={`badge confidence ${value.toLowerCase()}`}>Confidence: {value}</span> }
function SeverityBadge({ value }: { value: string }) { return <span className={`badge severity ${value.toLowerCase().replace(' ', '-')}`}>{value}</span> }
function PieChart({ slices }: { slices: Array<{ mood: string; label: string; pct: number; color: string; count: number; emoji: string }> }) {
  let start = 0
  const gradient = slices.map((s) => { const end = start + s.pct; const seg = `${s.color} ${start}% ${end}%`; start = end; return seg }).join(', ')
  return <div className="pie-wrap"><div className="pie" style={{ background: `conic-gradient(${gradient})` }}><span>{slices.reduce((a, b) => a + b.count, 0)}<small>responses</small></span></div><div className="legend">{slices.map((s) => <div key={s.mood}><img src={s.emoji} alt={`${s.label} mood`} />{s.label}: <strong>{s.pct}%</strong><small>{s.count}</small></div>)}</div></div>
}

export default function Home({ searchParams }: { searchParams?: { month?: string } }) {
  const customer = customers[0]
  const report = getReport(customer.id, searchParams?.month)
  const maxResponses = Math.max(...report.monthlyTrend.map((m) => m.responses))
  const alert = report.whatChanged[0]
  const hotspots = report.watchTeams.slice(0, 2).map((t) => t.team).join(' and ') || 'no concentrated hotspot'
  return <div className="shell"><header className="topbar"><div className="wrap"><div className="brand"><span className="mark">lp</span><span>Prepared by Lollipop<small>Workforce intelligence platform</small></span></div><form className="controls"><select name="month" defaultValue={report.month}>{customer.months.map((m) => <option key={m.month} value={m.month}>{m.label}</option>)}</select><button className="btn primary">Generate Report</button><DownloadPdfButton /></form></div></header><main className="wrap pages">

<section className="exec-cover brief-section"><div><p className="eyebrow">Prepared by Lollipop</p><h1 className="client-title">{report.customerName}</h1><p className="report-subtitle">Workforce Intelligence Report · {report.label}</p></div><div className="period-pill"><strong>{report.healthSummary.rating}</strong><span>{report.reportConfidenceScore}/100 confidence</span></div></section>

<section className="exec-dashboard brief-section"><Kpi label="Average Mood" value={report.avgMood.toFixed(2)} delta={<Delta value={report.avgMoodChange} />}/><Kpi label="Positive Sentiment" value={`${report.positivePct}%`} delta={<Delta value={report.positiveChange} suffix=" pts" />}/><Kpi label="Engagement" value={report.engagement.responseRate ? `${report.engagement.responseRate}%` : `${report.responseCount}`} delta={report.engagement.responseRate ? 'response rate' : 'responses'}/><Kpi label="Retention Risk" value={report.retentionRisk} delta={report.healthSummary.rating} tone={report.retentionRisk !== 'Low' ? 'amber' : 'green'}/><Kpi label="Watchlist Teams" value={`${report.watchTeams.length}`} delta={hotspots}/><Kpi label="Confidence" value={`${report.reportConfidenceScore}`} delta={report.reportConfidence}/></section>

<section className={`exec-alert brief-section ${alert?.severity?.toLowerCase().replace(' ', '-') ?? 'stable'}`}><div><p className="eyebrow">Executive Alert</p><h2>{alert?.detail ?? report.healthSummary.reason}</h2><p>{alert?.meaning ?? 'Monitor month-over-month movement and team concentration.'} Hotspots: {hotspots}.</p></div><SeverityBadge value={alert?.severity ?? report.healthSummary.rating} /></section>

<section className="grid two section brief-section"><div className="card priority-card"><div className="page-label"><strong>Top Leadership Priorities</strong><span>This month</span></div>{report.recommendations.slice(0,3).map((r) => <div className="priority-row" key={r.title}><span className="priority">{r.priority}</span><div><strong>{r.title}</strong><p>{r.nextStep}</p><small>{r.owner} · {r.urgency} urgency</small></div></div>)}</div><div className="card"><p className="eyebrow">Executive Summary</p><h2>{report.strategicNarrative[0]}</h2><p>{report.strategicNarrative[1]}</p><p className="muted">{report.strategicNarrative[2]}</p></div></section>

<section className="card section brief-section"><div className="page-label"><strong>What Changed This Month</strong><span>signal over noise</span></div><div className="change-grid compact-change">{report.whatChanged.slice(0,6).map((c) => <div className="change-card" key={c.title}><strong>{c.title}</strong><p>{c.detail}</p><small>{c.meaning}</small><SeverityBadge value={c.severity} /></div>)}</div></section>

<section className="grid two section appendix-section"><div className="card"><div className="page-label"><strong>Company-Wide Sentiment Trends</strong><span>Appendix detail</span></div><div className="trend">{report.monthlyTrend.map((m) => <div className="trend-col" key={m.label}><i style={{ height: `${Math.max(30, (m.responses / maxResponses) * 160)}px` }} /><strong>{m.label}</strong><span>{m.avgMood.toFixed(2)} · {m.responses}</span></div>)}</div><div className="insight-grid"><p><strong>Trailing 3-month avg:</strong> {report.trend.threeMonthAvgMood ?? 'n/a'}</p><p><strong>Rolling positive:</strong> {report.trend.rollingPositivePct ?? 'n/a'}%</p><p><strong>Best / worst:</strong> {report.trend.bestMonth} / {report.trend.worstMonth}</p><p><strong>Persistence:</strong> {report.trend.meaningfulMovement}</p></div></div><div className="card"><p className="eyebrow">Engagement Quality</p><p><strong>Unique participants:</strong> {report.engagement.uniqueParticipants}</p><p><strong>Response rate:</strong> {report.engagement.responseRate ?? 'Unavailable — eligible population not provided'}</p><p><strong>Participation change:</strong> <Delta value={report.engagement.participationChange} /> responses</p><p className="muted">{report.engagement.silentPopulationRisk}</p></div></section>

<section className="grid two section brief-section"><div className="card"><div className="page-label"><strong>AI Comment Analysis</strong><ConfidenceBadge value={report.commentIntelligence.confidence} /></div><h2>{report.commentIntelligence.revealing}</h2><div className="theme-grid"><div><strong>Work</strong><span>{report.commentIntelligence.workRelatedCount}</span></div><div><strong>Wellbeing</strong><span>{report.commentIntelligence.wellbeingCount}</span></div><div><strong>Positive</strong><span>{report.commentIntelligence.positiveCount}</span></div><div><strong>Burnout</strong><span>{report.commentIntelligence.stressBurnoutCount}</span></div></div></div><div className="card"><h2>Emotion & Mood Mix</h2>{report.topEmotions.slice(0,5).map((e) => <div key={e.emotion}><p>{e.emotion}: {e.count}</p><div className="bar"><i style={{ width: `${e.pct}%` }} /></div></div>)}<PieChart slices={report.moodDistribution} /></div></section>

<section className="card section appendix-section"><div className="page-label"><strong>Team-Level Intelligence</strong><span>Ranked appendix</span></div><div className="table-wrap"><table className="table exec-table"><thead><tr><th>Team</th><th>Mood</th><th>Δ</th><th>Positive</th><th>Participation</th><th>Risk</th><th>Primary Issue</th><th>Manager Action</th></tr></thead><tbody>{report.teamIntelligence.map((t) => <tr key={t.team}><td><strong>{t.team}</strong>{t.sampleWarning && <div className="muted">Low sample</div>}</td><td>{t.avgMood.toFixed(2)}</td><td><Delta value={t.change} /></td><td>{t.positivePct}%</td><td>{t.responses}</td><td><SeverityBadge value={t.severity} /></td><td>{t.keyConcernOrStrength}</td><td>{t.managerAction}</td></tr>)}</tbody></table></div></section>

<section className="grid two section brief-section"><div className="card"><p className="eyebrow">Risk / Watchlist Areas</p><div className="list">{report.riskWatchlist.slice(0,4).map((r) => <div className="rec" key={r.title}><strong>{r.title} <SeverityBadge value={r.severity} /></strong><p>{r.signal}</p><p><strong>Action:</strong> {r.recommendedAction}</p></div>)}</div></div><div className="card"><p className="eyebrow">Positive Momentum / What’s Working</p><div className="list">{report.positiveMomentum.slice(0,4).map((r) => <div className="rec" key={r.title}><strong>{r.title}</strong><p>{r.signal}</p><p><strong>Preserve:</strong> {r.recommendedAction}</p></div>)}</div></div></section>

<section className="card section brief-section"><div className="page-label"><strong>Recommended Leadership Actions</strong><span>practical and owner-ready</span></div><div className="action-grid">{report.recommendations.map((r) => <div className="rec action" key={r.title}><strong><span className="priority">{r.priority}</span> {r.title}</strong><p className="muted">{r.owner} · {r.urgency} urgency · {r.impact} impact</p><p>{r.nextStep}</p><small>{r.why}</small></div>)}</div></section>

<section className="grid two section appendix-section"><div className="card"><p className="eyebrow">Manager Report Outputs</p><h2>Scoped team-only reports</h2><p>{report.managerReport.description}</p><p><strong>Eligible teams:</strong> {report.managerReport.eligibleTeams.join(', ') || 'None yet'}</p><ul className="list compact">{report.managerReport.safeguards.map((s) => <li key={s}>{s}</li>)}</ul></div><div className="card"><p className="eyebrow">Data Quality & Confidence</p><h2>{report.reportConfidenceScore}/100 · {report.reportConfidence}</h2><p>{report.confidenceRationale}</p><p><strong>Low-sample teams:</strong> {report.lowConfidenceTeams.length ? report.lowConfidenceTeams.map((t) => t.team).join(', ') : 'None'}</p></div></section>

<section className="card section appendix-section"><p className="eyebrow">Appendix / Methodology Improvements</p><ul className="list">{report.improvements.map((i) => <li key={i}>{i}</li>)}</ul><p className="muted">Confirmed direction: brief PDF for executives; full report with appendices for operators and HR.</p></section>

</main></div>
}
