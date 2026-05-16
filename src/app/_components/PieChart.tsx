import React from 'react'

type Slice = { mood: string; label: string; pct: number; color: string; count: number; emoji: string }

export default function PieChart({ slices }: { slices: Slice[] }) {
  let start = 0
  const gradient = slices
    .map((s) => {
      const end = start + s.pct
      const seg = `${s.color} ${start}% ${end}%`
      start = end
      return seg
    })
    .join(', ')
  const total = slices.reduce((a, b) => a + b.count, 0)
  return (
    <div className="pie-wrap">
      <div className="pie" style={{ background: `conic-gradient(${gradient})` }}>
        <span>
          {total}
          <small>responses</small>
        </span>
      </div>
      <div className="legend">
        {slices.map((s) => (
          <div key={s.mood}>
            <img src={s.emoji} alt={`${s.label} mood`} />
            <span className="legend-label">{s.label}</span>
            <strong>{s.pct}%</strong>
            <small>{s.count}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
