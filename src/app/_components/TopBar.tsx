import React from 'react'
import DownloadPdfButton from '../DownloadPdfButton'

type Month = { month: string; label: string }

export default function TopBar({
  title = 'Workforce Intelligence',
  months,
  selectedMonth,
  action = '/',
  backLink,
}: {
  title?: string
  months?: Month[]
  selectedMonth?: string
  action?: string
  backLink?: { href: string; label: string }
}) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <div className="brand-block">
          <div className="brand-mark">L</div>
          <div>
            <strong className="brand-name">Lollipop</strong>
            <small>{title}</small>
          </div>
        </div>
        <div className="controls">
          {backLink && (
            <a className="btn" href={backLink.href} style={{ textDecoration: 'none' }}>
              {backLink.label}
            </a>
          )}
          {months && months.length > 0 && (
            <form className="controls" action={action} method="get" style={{ display: 'contents' }}>
              <select name="month" defaultValue={selectedMonth} aria-label="Reporting month">
                {months.map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button className="btn primary" type="submit">
                Generate
              </button>
            </form>
          )}
          <DownloadPdfButton />
        </div>
      </div>
    </header>
  )
}
