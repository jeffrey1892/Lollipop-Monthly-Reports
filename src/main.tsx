import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import data from './reportData.json'

type Team = { team: string; responses: number; avgMood: number; positivePct: number; lowSample: boolean }
type Month = {
  key: string; label: string; responses: number; avgMood: number; positivePct: number; negativeCount: number; neutralCount: number; positiveCount: number; comments: number; followups: number; topEmotions: [string, number][]; teams: Team[]; topResponders: [string, number][]; moodDelta: number; positiveDelta: number; healthLabel: string; retentionRisk: string; engagementScore: number; orgHealthScore: number; executiveSummary?: string; attentionItems?: string[]; recommendations?: Recommendation[]; improvementSuggestions?: string[]
}
type Recommendation = { urgency: string; impact: string; difficulty: string; title: string; reason: string; action: string }
const months = data.months as Month[]

function fmtDelta(value: number, suffix = '') { return `${value >= 0 ? '+' : ''}${value.toFixed(value % 1 ? 1 : 0)}${suffix}` }
function statusClass(label: string) { return label.toLowerCase().replaceAll(' ', '-') }

function App() {
  const [selectedKey, setSelectedKey] = useState(data.defaultMonth)
  const month = months.find((m) => m.key === selectedKey) ?? months[months.length - 1]
  const previous = months[months.findIndex((m) => m.key === month.key) - 1]
  const topTeams = [...month.teams].filter(t => !t.lowSample).sort((a,b)=>b.avgMood-a.avgMood).slice(0,4)
  const watchTeams = [...month.teams].filter(t => !t.lowSample).sort((a,b)=>a.avgMood-b.avgMood).slice(0,5)
  const lowSample = month.teams.filter(t => t.lowSample)
  const trend = months.map(m => ({ label: m.label.split(' ')[0], avgMood: m.avgMood, positivePct: m.positivePct, responses: m.responses }))

  return <main className="app">
    <header className="hero">
      <div>
        <p className="eyebrow">Lollipop Monthly Reports</p>
        <h1>Executive Workforce Intelligence</h1>
        <p className="lede">{data.customer} · {month.label} · report preview</p>
      </div>
      <div className="controls">
        <label>Report month<select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}>{months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
        <button onClick={() => window.print()}>Print / Save PDF</button>
      </div>
    </header>

    <section className="page snapshot">
      <div className="page-title"><span>Page 1</span><h2>Executive Snapshot</h2><p>30-second leadership scan. Constructive labels follow the master prompt.</p></div>
      <div className="kpi-grid">
        <Kpi title="Organizational Health Score™" value={month.orgHealthScore} suffix="/100" status={month.healthLabel} />
        <Kpi title="Avg Mood" value={month.avgMood.toFixed(2)} delta={fmtDelta(month.moodDelta)} />
        <Kpi title="Positive Sentiment" value={`${month.positivePct.toFixed(1)}%`} delta={fmtDelta(month.positiveDelta, ' pts')} />
        <Kpi title="Engagement Score™" value={month.engagementScore} suffix="/100" note={`${month.responses} responses`} />
        <Kpi title="Retention Risk Index™" value={month.retentionRisk} status={month.retentionRisk} />
      </div>
      <div className="snapshot-grid">
        <Panel title="Executive Summary"><p className="summary">{month.executiveSummary ?? `${month.label} generated ${month.responses} responses with ${month.positivePct.toFixed(1)}% positive sentiment.`}</p></Panel>
        <Panel title="Leadership Attention Required"><ol className="tight">{(month.attentionItems ?? []).map(item => <li key={item}>{item}</li>)}</ol></Panel>
        <Panel title="Recommended Next Actions"><div className="recommendations">{(month.recommendations ?? []).map(r => <RecommendationCard key={r.title} rec={r} />)}</div></Panel>
      </div>
      <div className="three-col">
        <Panel title="Mood Distribution"><Distribution month={month} /></Panel>
        <Panel title="Top Teams"><TeamList teams={topTeams} positive /></Panel>
        <Panel title="Watch Teams"><TeamList teams={watchTeams} /></Panel>
      </div>
    </section>

    <section className="page">
      <div className="page-title"><span>Page 2</span><h2>Organizational Trends</h2><p>Company-wide sentiment, participation, and monthly movement.</p></div>
      <div className="trend-grid"><TrendChart title="Avg Mood Trend" data={trend} field="avgMood" max={5} /><TrendChart title="Participation Volume" data={trend} field="responses" max={180} /><TrendChart title="Positive Sentiment %" data={trend} field="positivePct" max={100} /></div>
      <Panel title="Performance Metrics"><ul className="bullets"><li>Most recent average mood: <strong>{month.avgMood.toFixed(2)}</strong>, {month.moodDelta < 0 ? 'softened' : 'improved'} {Math.abs(month.moodDelta).toFixed(2)} from {previous?.label ?? 'prior month'}.</li><li>Positive sentiment is <strong>{month.positivePct.toFixed(1)}%</strong>, {month.positiveDelta < 0 ? 'down' : 'up'} {Math.abs(month.positiveDelta).toFixed(1)} points month-over-month.</li><li>Response volume remains above the seven-month median, supporting a credible company-level signal.</li></ul></Panel>
    </section>

    <section className="page">
      <div className="page-title"><span>Page 3</span><h2>Team Health Matrix</h2><p>Team-level averages with low-sample warnings to avoid overinterpretation.</p></div>
      <div className="matrix">{month.teams.map(team => <TeamCard key={team.team} team={team} />)}</div>
      {lowSample.length > 0 && <Panel title="Low sample-size warning"><p className="muted">The following teams have fewer than 5 responses and should be interpreted directionally only: {lowSample.map(t => t.team).join(', ')}.</p></Panel>}
    </section>

    <section className="page">
      <div className="page-title"><span>Page 4</span><h2>Leadership Responsiveness & Escalations</h2><p>Placeholder until follow-up request/resolution data is available.</p></div>
      <div className="two-col"><Panel title="Current Status"><p className="summary">Follow-up and escalation data is not yet reliable in the sample exports. Leadership Responsiveness Score™ should remain a placeholder until requested, assigned, resolved, and employee-confirmed fields are consistently captured.</p></Panel><Panel title="Recommended Data Additions"><ul className="bullets"><li>Follow-up requested timestamp</li><li>Assigned manager or owner</li><li>Resolution status</li><li>Employee-confirmed follow-up outcome</li><li>Time-to-resolution</li></ul></Panel></div>
    </section>

    <section className="page">
      <div className="page-title"><span>Page 5</span><h2>Emotional & Organizational Friction Intelligence</h2><p>Operational interpretation of emotional signal patterns.</p></div>
      <div className="two-col"><Panel title="Top Emotional Signals"><EmotionBars items={month.topEmotions} /></Panel><Panel title="Interpretation"><ul className="bullets"><li>Positive emotions remain dominant, led by {month.topEmotions.slice(0,3).map(e => e[0]).join(', ')}.</li><li>April softening appears more team-specific than organization-wide.</li><li>Comment volume is sufficient for directional review but should not be over-weighted without classification.</li></ul></Panel></div>
    </section>

    <section className="page">
      <div className="page-title"><span>Page 6</span><h2>Strategic Recommendations & Executive Talking Points</h2><p>Board-ready actions and practical improvements.</p></div>
      <div className="two-col"><Panel title="Strategic Recommendations"><div className="recommendations">{(month.recommendations ?? []).map(r => <RecommendationCard key={r.title} rec={r} />)}</div></Panel><Panel title="Product / Reporting Improvements"><ul className="bullets">{(month.improvementSuggestions ?? []).map(s => <li key={s}>{s}</li>)}</ul></Panel></div>
    </section>
  </main>
}

function Kpi({ title, value, suffix='', delta, status, note }: { title: string; value: string|number; suffix?: string; delta?: string; status?: string; note?: string }) { return <article className="kpi"><span>{title}</span><strong>{value}{suffix}</strong>{delta && <em className={delta.startsWith('-') ? 'down' : 'up'}>{delta}</em>}{status && <b className={`badge ${statusClass(status)}`}>{status}</b>}{note && <small>{note}</small>}</article> }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="panel"><h3>{title}</h3>{children}</section> }
function Distribution({ month }: { month: Month }) { const total = month.positiveCount + month.neutralCount + month.negativeCount; return <div className="dist"><div style={{width:`${month.positiveCount/total*100}%`}} className="pos"/><div style={{width:`${month.neutralCount/total*100}%`}} className="neu"/><div style={{width:`${month.negativeCount/total*100}%`}} className="neg"/><p><strong>{month.positiveCount}</strong> positive · <strong>{month.neutralCount}</strong> neutral · <strong>{month.negativeCount}</strong> negative</p></div> }
function TeamList({ teams, positive=false }: { teams: Team[]; positive?: boolean }) { return <div className="team-list">{teams.map(t => <div key={t.team}><span>{t.team}</span><strong>{t.avgMood.toFixed(2)}</strong><em className={positive ? 'up' : 'down'}>{t.responses} responses</em></div>)}</div> }
function RecommendationCard({ rec }: { rec: Recommendation }) { return <article className="rec"><div><b>{rec.title}</b><p>{rec.reason}</p></div><span>{rec.urgency} urgency</span><span>{rec.impact} impact</span><span>{rec.difficulty} difficulty</span><p className="action">Action: {rec.action}</p></article> }
function TrendChart({ title, data, field, max }: { title: string; data: {label:string; avgMood:number; responses:number; positivePct:number}[]; field: 'avgMood'|'responses'|'positivePct'; max: number }) { return <Panel title={title}><div className="bars">{data.map(d => <div key={d.label} className="bar"><i style={{height:`${Math.max(8,(d[field]/max)*100)}%`}}/><span>{d.label}</span><b>{field==='avgMood'?d[field].toFixed(2):Math.round(d[field])}</b></div>)}</div></Panel> }
function TeamCard({ team }: { team: Team }) { const risk = team.lowSample ? 'Low sample' : team.avgMood < 3.6 ? 'Watch' : team.avgMood >= 4.2 ? 'Healthy' : 'Stable'; return <article className="team-card"><h3>{team.team}</h3><strong>{team.avgMood.toFixed(2)}</strong><p>{team.positivePct.toFixed(1)}% positive · {team.responses} responses</p><span className={`badge ${statusClass(risk)}`}>{risk}</span></article> }
function EmotionBars({ items }: { items: [string, number][] }) { const max = Math.max(...items.map(i=>i[1])); return <div className="emotion-bars">{items.map(([name,count]) => <div key={name}><span>{name}</span><i><b style={{width:`${count/max*100}%`}} /></i><strong>{count}</strong></div>)}</div> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
