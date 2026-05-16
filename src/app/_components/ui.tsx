import React from 'react'

export function NoteRef({ n }: { n: number }) {
  return (
    <a href={`#note-${n}`} className="note-ref">
      See Explanatory Note {n}
    </a>
  )
}

export function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="muted">—</span>
  const up = value >= 0
  const flat = value === 0
  return (
    <span className={`delta ${flat ? 'neutral' : up ? 'up' : 'down'}`}>
      {flat ? '→' : up ? '↑' : '↓'} {up && !flat ? '+' : ''}
      {value}
      {suffix}
    </span>
  )
}

export function TrendDelta({
  value,
  suffix = '',
  detail,
}: {
  value: number | null
  suffix?: string
  detail?: React.ReactNode
}) {
  if (value === null)
    return (
      <div className="trend-delta neutral">
        <span className="trend-label">vs prior month</span>
        <strong>No prior comparison</strong>
        {detail && <small>{detail}</small>}
      </div>
    )
  const up = value >= 0
  const flat = value === 0
  return (
    <div className={`trend-delta ${flat ? 'neutral' : up ? 'up' : 'down'}`}>
      <span className="trend-label">vs prior month</span>
      <strong>
        {flat ? '→' : up ? '↗' : '↘'} {up && !flat ? '+' : ''}
        {value}
        {suffix}
      </strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

export function InlineTrend({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="inline-trend neutral">No prior comparison</span>
  const up = value >= 0
  const flat = value === 0
  return (
    <span className={`inline-trend ${flat ? 'neutral' : up ? 'up' : 'down'}`}>
      {flat ? '→' : up ? '↗' : '↘'} {up && !flat ? '+' : ''}
      {value}
      {suffix}
    </span>
  )
}

export function ConfidenceBadge({ value }: { value: string }) {
  return (
    <span className={`badge confidence ${value.toLowerCase()}`}>
      Confidence: {value} <NoteRef n={3} />
    </span>
  )
}

export function SeverityBadge({ value }: { value: string }) {
  return (
    <span className={`badge severity ${value.toLowerCase().replace(/\s+/g, '-')}`}>{value}</span>
  )
}

export function KpiCard({
  label,
  value,
  sub,
  delta,
  tone,
  help,
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  delta?: React.ReactNode
  tone?: 'green' | 'amber' | 'coral' | 'blue' | 'neutral'
  help?: React.ReactNode
}) {
  return (
    <div className={`kpi-card ${tone ?? 'neutral'}`}>
      <p className="kpi-label">{label}</p>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {delta && <div className="kpi-delta">{delta}</div>}
      {help && <div className="kpi-help">{help}</div>}
    </div>
  )
}
