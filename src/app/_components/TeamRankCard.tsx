import React from 'react'
import { Delta } from './ui'

type Team = {
  team: string
  avgMood: number
  positivePct: number
  responses: number
  change: number | null
  sampleWarning?: boolean
  history?: Array<{ month: string; label: string; avgMood: number }>
}

function Sparkline({ points, change }: { points: Array<{ avgMood: number }>; change: number | null }) {
  if (!points || points.length < 3) {
    return <span className="sparkline-empty" aria-hidden="true">—</span>
  }
  const w = 60
  const h = 20
  const pad = 2
  const values = points.map((p) => p.avgMood)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (w - pad * 2) / (points.length - 1)
  const coords = values.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (h - pad * 2) * (1 - (v - min) / range)
    return [x, y] as const
  })
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [endX, endY] = coords[coords.length - 1]
  const dotClass =
    change !== null && change >= 0.05 ? 'dot-up' : change !== null && change <= -0.05 ? 'dot-down' : 'dot-flat'
  return (
    <svg
      className="sparkline"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-label={`Mood trend over last ${points.length} months`}
      role="img"
    >
      <path d={d} fill="none" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle className={dotClass} cx={endX} cy={endY} r="2.2" />
    </svg>
  )
}

export default function TeamRankCard({
  title,
  subtitle,
  teams,
  tone = 'neutral',
  variant = 'list',
}: {
  title: string
  subtitle: string
  teams: Team[]
  tone?: 'green' | 'amber' | 'coral' | 'blue' | 'neutral'
  variant?: 'list' | 'bars'
}) {
  return (
    <div className={`team-rank-card tone-${tone}`}>
      <header>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>
      {teams.length === 0 ? (
        <p className="empty">No teams meet the threshold.</p>
      ) : variant === 'bars' ? (
        <ul className="team-bar-list">
          {teams.map((t) => {
            const pct = Math.max(2, Math.min(100, (t.avgMood / 5) * 100))
            return (
              <li key={t.team}>
                <div className="team-bar-head">
                  <strong>{t.team}</strong>
                  <span className="team-score-row">
                    <Sparkline points={t.history ?? []} change={t.change} />
                    <span className="team-score">{t.avgMood.toFixed(2)}</span>
                  </span>
                </div>
                <div className="team-bar">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <small>
                  {t.positivePct}% positive · {t.responses} responses{' '}
                  {t.change !== null && <Delta value={t.change} />}{' '}
                  {t.sampleWarning && <span className="sample-flag">low sample</span>}
                </small>
              </li>
            )
          })}
        </ul>
      ) : (
        <ol className="team-rank-ordered">
          {teams.map((t, i) => (
            <li key={t.team}>
              <span className="rank">{String(i + 1).padStart(2, '0')}</span>
              <div className="team-row">
                <div className="team-row-head">
                  <strong>{t.team}</strong>
                  <span className="team-score-row">
                    <Sparkline points={t.history ?? []} change={t.change} />
                    <span className="team-score">{t.avgMood.toFixed(2)}</span>
                  </span>
                </div>
                <small>
                  {t.positivePct}% positive · {t.responses} responses{' '}
                  {t.change !== null && <Delta value={t.change} />}{' '}
                  {t.sampleWarning && <span className="sample-flag">low sample</span>}
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
