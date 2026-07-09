import React from 'react'

type Point = { weekLabel: string; engagementRate: number; uniqueRespondents: number; effectiveRoster: number; offRosterRespondents: number }

export default function WeeklyEngagementChart({ points }: { points: Point[] }) {
  const width = 700
  const height = 320
  const padL = 44
  const padR = 16
  const padT = 18
  const padB = 44
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
          <text x={padL - 8} y={y(tick) + 4} fontSize={11} fill="#7a8290" textAnchor="end" fontWeight={700}>{tick}%</text>
        </g>
      ))}
      <path d={areaPath} fill="#0A81FF" fillOpacity="0.08" />
      <path d={path} fill="none" stroke="#0A81FF" strokeWidth={2.4} strokeLinejoin="round" />
      {points.map((p, i) => {
        const dense = points.length > 8
        const showValue = !dense || i % 2 === 0 || i === points.length - 1
        return (
          <g key={p.weekLabel + i}>
            <circle cx={x(i)} cy={y(p.engagementRate)} r={dense ? 3 : 4} fill="#0A81FF" stroke="white" strokeWidth={1.6} />
            {showValue && (
              <text x={x(i)} y={y(p.engagementRate) - 10} fontSize={dense ? 9.5 : 10.5} textAnchor="middle" fill="#0A81FF" fontWeight={800}>{p.engagementRate.toFixed(0)}%</text>
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
          <text key={`lbl-${i}`} x={x(i)} y={height - 20} fontSize={dense ? 9 : 10} fill="#7a8290" textAnchor={anchor} fontWeight={700}>{p.weekLabel}</text>
        )
      })}
      {points.map((p, i) => (
        <line key={`tick-${i}`} x1={x(i)} x2={x(i)} y1={padT + innerH} y2={padT + innerH + 4} stroke="#9aa1ac" strokeWidth={1} />
      ))}
      <line x1={padL} x2={width - padR} y1={padT + innerH} y2={padT + innerH} stroke="#c8ccd3" strokeWidth={1} />
    </svg>
  )
}
