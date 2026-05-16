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
          <strong>No prior comparison</strong>
        {detail && <small>{detail}</small>}
      </div>
    )
  const up = value >= 0
  const flat = value === 0
  return (
    <div className={`trend-delta ${flat ? 'neutral' : up ? 'up' : 'down'}`}>
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

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  accent,
  size = 'lg',
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  accent?: 'blue' | 'muted' | 'none'
  size?: 'lg' | 'sm'
}) {
  const accentClass = accent && accent !== 'none' ? ` accent-${accent}` : ''
  const sizeClass = size === 'sm' ? ' size-sm' : ''
  return (
    <header className={`section-head${accentClass}${sizeClass}`}>
      {eyebrow && <p className="h3-micro section-head-eyebrow">{eyebrow}</p>}
      <h2 className="h1-section">{title}</h2>
      {subtitle && <p className="section-head-subtitle">{subtitle}</p>}
    </header>
  )
}

export function KpiCard({
  label,
  value,
  sub,
  delta,
  tone,
  help,
  deltaCaption,
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  delta?: React.ReactNode
  tone?: 'green' | 'amber' | 'coral' | 'blue' | 'neutral'
  help?: React.ReactNode
  deltaCaption?: React.ReactNode
}) {
  return (
    <div className={`kpi-card ${tone ?? 'neutral'} ${delta ? 'kpi-split' : ''}`}>
      <p className="kpi-label">{label}</p>
      <div className="kpi-body">
        <div className="kpi-body-left">
          <div className="kpi-value">{value}</div>
          {sub && <div className="kpi-sub">{sub}</div>}
        </div>
        {delta && (
          <div className="kpi-body-right">
            <div className="kpi-delta">{delta}</div>
            <div className="kpi-delta-caption">{deltaCaption ?? 'v. prior month'}</div>
          </div>
        )}
      </div>
      {help && <div className="kpi-help">{help}</div>}
    </div>
  )
}
