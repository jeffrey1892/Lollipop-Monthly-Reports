import React from 'react'

type Point = { month?: string; weekStart?: string; label: string; monthLabel?: string; avgMood: number }

export default function MiniMoodTrend({
  points,
  companyAvg,
}: {
  points: Point[]
  companyAvg?: number | null
}) {
  const width = 460
  const height = 210
  const padL = 36
  const padR = 18
  const padT = 16
  const padB = 28
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  if (!points || points.length === 0) {
    return (
      <div
        className="empty-chart"
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        No trend history available yet.
      </div>
    )
  }

  const yMin = 1
  const yMax = 5
  const x = (i: number) =>
    points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.avgMood).toFixed(1)}`)
    .join(' ')

  const companyY =
    companyAvg !== null && companyAvg !== undefined && companyAvg >= yMin && companyAvg <= yMax
      ? y(companyAvg)
      : null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Six-month team mood trend"
      style={{ display: 'block', maxHeight: '100%', maxWidth: '100%' }}
    >
      {[1, 2, 3, 4, 5].map((tick) => (
        <line
          key={tick}
          x1={padL}
          x2={width - padR}
          y1={y(tick)}
          y2={y(tick)}
          stroke="#eef1f5"
          strokeWidth={1}
        />
      ))}
      <text x={6} y={y(5) + 5} fontSize={13} fill="#7a8290" fontWeight={700}>
        5
      </text>
      <text x={6} y={y(3) + 5} fontSize={13} fill="#7a8290" fontWeight={700}>
        3
      </text>
      <text x={6} y={y(1) + 5} fontSize={13} fill="#7a8290" fontWeight={700}>
        1
      </text>

      {companyY !== null && (
        <>
          <line
            x1={padL}
            x2={width - padR}
            y1={companyY}
            y2={companyY}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
          <text
            x={width - padR}
            y={companyY - 5}
            fontSize={11}
            fill="#3b82f6"
            textAnchor="end"
            fontWeight={700}
          >
            Company {companyAvg!.toFixed(2)}
          </text>
        </>
      )}

      {/* X-axis baseline + per-month tick marks */}
      <line
        x1={padL}
        x2={width - padR}
        y1={padT + innerH}
        y2={padT + innerH}
        stroke="#c8ccd3"
        strokeWidth={1}
      />
      {points.map((p, i) => (
        <line
          key={`tick-${p.weekStart ?? p.month}-${i}`}
          x1={x(i)}
          x2={x(i)}
          y1={padT + innerH}
          y2={padT + innerH + 4}
          stroke="#9aa1ac"
          strokeWidth={1}
        />
      ))}

      <path d={path} fill="none" stroke="#1f6f4a" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={`pt-${p.weekStart ?? p.month}-${i}`} cx={x(i)} cy={y(p.avgMood)} r={3} fill="#1f6f4a" />
      ))}

      {/* Month-only x-axis labels (always label first and last) */}
      {points.map((p, i) => {
        const isFirst = i === 0
        const isLast = i === points.length - 1
        const shown = p.label || (isFirst || isLast ? p.monthLabel ?? '' : '')
        if (!shown) return null
        const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
        const short = shown.split(' ')[0]
        return (
          <text
            key={`label-${p.weekStart ?? p.month}-${i}`}
            x={x(i)}
            y={height - 8}
            fontSize={11}
            fill="#7a8290"
            textAnchor={anchor}
            fontWeight={700}
          >
            {short}
          </text>
        )
      })}
    </svg>
  )
}
