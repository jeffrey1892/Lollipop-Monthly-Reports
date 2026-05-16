import React from 'react'
import { Delta } from './ui'

type Team = {
  team: string
  avgMood: number
  positivePct: number
  responses: number
  change: number | null
  sampleWarning?: boolean
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
                  <span className="team-score">{t.avgMood.toFixed(2)}</span>
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
                  <span className="team-score">{t.avgMood.toFixed(2)}</span>
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
