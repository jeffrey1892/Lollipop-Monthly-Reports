import React from 'react'

type Point = { label: string; avgMood: number; positivePct: number; responses: number }

export default function TrendChart({ data }: { data: Point[] }) {
  if (!data.length) return null
  const w = 720
  const h = 240
  const padL = 40
  const padR = 40
  const padT = 24
  const padB = 36
  const innerW = w - padL - padR
  const innerH = h - padT - padB

  const moods = data.map((d) => d.avgMood)
  const minMood = Math.max(1, Math.floor(Math.min(...moods) - 0.3))
  const maxMood = Math.min(5, Math.ceil(Math.max(...moods) + 0.3))
  const moodRange = Math.max(0.5, maxMood - minMood)
  const maxResp = Math.max(...data.map((d) => d.responses), 1)

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0
  const x = (i: number) => padL + i * xStep
  const yMood = (m: number) => padT + innerH - ((m - minMood) / moodRange) * innerH
  const barW = Math.max(8, Math.min(40, (innerW / data.length) * 0.55))

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yMood(d.avgMood).toFixed(1)}`)
    .join(' ')
  const areaPath =
    `M ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} ` +
    data.map((d, i) => `L ${x(i).toFixed(1)} ${yMood(d.avgMood).toFixed(1)}`).join(' ') +
    ` L ${x(data.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`

  const yTicks = 4
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => minMood + (i * moodRange) / yTicks)

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Monthly mood and participation trend">
        <defs>
          <linearGradient id="moodArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => {
          const y = yMood(t)
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted)" fontWeight={700}>
                {t.toFixed(1)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const bh = (d.responses / maxResp) * (innerH * 0.55)
          const by = padT + innerH - bh
          return (
            <rect
              key={`bar-${i}`}
              x={x(i) - barW / 2}
              y={by}
              width={barW}
              height={bh}
              rx={4}
              fill="var(--blueSoft)"
              opacity={0.9}
            />
          )
        })}
        <path d={areaPath} fill="url(#moodArea)" />
        <path d={linePath} fill="none" stroke="var(--blue)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={`pt-${i}`}>
            <circle cx={x(i)} cy={yMood(d.avgMood)} r={4.5} fill="white" stroke="var(--blue)" strokeWidth={2} />
            <text x={x(i)} y={yMood(d.avgMood) - 10} textAnchor="middle" fontSize="10" fontWeight={800} fill="var(--ink)">
              {d.avgMood.toFixed(2)}
            </text>
            <text x={x(i)} y={h - padB + 16} textAnchor="middle" fontSize="10" fill="var(--muted)" fontWeight={700}>
              {d.label}
            </text>
            <text x={x(i)} y={h - padB + 28} textAnchor="middle" fontSize="9" fill="var(--muted)">
              {d.responses}
            </text>
          </g>
        ))}
      </svg>
      <div className="trend-chart-legend">
        <span><i className="dot blue" /> Average Mood</span>
        <span><i className="block softblue" /> Responses</span>
      </div>
    </div>
  )
}
