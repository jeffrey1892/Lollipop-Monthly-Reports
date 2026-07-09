import React from 'react'

type Point = { weekLabel: string; engagementRate: number; uniqueRespondents: number; effectiveRoster: number; offRosterRespondents: number }

export default function WeeklyEngagementChart({ points }: { points: Point[] }) {
  // Wide, short canvas so the rendered plot height stays close to the
  // Weekly detail table beside it; fonts sized for ~1:1 rendering at
  // typical desktop card widths.
  const width = 1100
  const height = 300
  const padL = 58
  const padR = 20
  const padT = 14
  const padB = 42
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  if (!points.length) {
    return (
      <div className="empty-chart" style={{ minHeight: 180 }}>
        No weekly engagement data available yet for this period.
      </div>
    )
  }

  const yMax = 100
  const x = (i: number) => points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW
  const y = (v: number) => padT + (1 - v / yMax) * innerH

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.engagementRate).toFixed(1)}`).join(' ')
  const areaPath = `${path} L${x(points.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weekly engagement rate">
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={padL} x2={width - padR} y1={y(tick)} y2={y(tick)} stroke="#eef1f5" strokeWidth={1} />
          <text x={padL - 10} y={y(tick) + 5} fontSize={14} fill="#7a8290" textAnchor="end" fontWeight={700}>{tick}%</text>
        </g>
      ))}
      <path d={areaPath} fill="#0A81FF" fillOpacity="0.08" />
      <path d={path} fill="none" stroke="#0A81FF" strokeWidth={2.6} strokeLinejoin="round" />
      {points.map((p, i) => {
        const dense = points.length > 8
        const showValue = !dense || i % 2 === 0 || i === points.length - 1
        return (
          <g key={p.weekLabel + i}>
            <circle cx={x(i)} cy={y(p.engagementRate)} r={dense ? 4 : 5} fill="#0A81FF" stroke="white" strokeWidth={1.8} />
            {showValue && (
              <text x={x(i)} y={y(p.engagementRate) - 12} fontSize={13} textAnchor="middle" fill="#0A81FF" fontWeight={800}>{p.engagementRate.toFixed(0)}%</text>
            )}
          </g>
        )
      })}
      {points.map((p, i) => {
        // With many weeks, label roughly every other tick; always label ends
        const dense = points.length > 8
        if (dense && i !== 0 && i !== points.length - 1 && i % 2 !== 0) return null
        const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
        return (
          <text key={`lbl-${i}`} x={x(i)} y={height - 14} fontSize={13} fill="#7a8290" textAnchor={anchor} fontWeight={700}>{p.weekLabel}</text>
        )
      })}
      {points.map((p, i) => (
        <line key={`tick-${i}`} x1={x(i)} x2={x(i)} y1={padT + innerH} y2={padT + innerH + 5} stroke="#9aa1ac" strokeWidth={1} />
      ))}
      <line x1={padL} x2={width - padR} y1={padT + innerH} y2={padT + innerH} stroke="#c8ccd3" strokeWidth={1} />
    </svg>
  )
}
