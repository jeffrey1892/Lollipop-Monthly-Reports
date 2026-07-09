import React from 'react'
import DownloadPdfButton from '../DownloadPdfButton'

type Month = { month: string; label: string }
type Customer = { id: string; name: string }

export default function TopBar({
  title = 'Workforce Intelligence',
  months,
  selectedMonth,
  action = '/',
  backLink,
  singlePdf = false,
  customers,
  selectedCustomer,
}: {
  title?: string
  months?: Month[]
  selectedMonth?: string
  action?: string
  backLink?: { href: string; label: string }
  singlePdf?: boolean
  customers?: Customer[]
  selectedCustomer?: string
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
          {(months || customers) && (
            <form className="topbar-month-form" action={action} method="get">
              {customers && customers.length > 1 && (
                <select name="customer" defaultValue={selectedCustomer} aria-label="Customer">
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {months && months.length > 0 && (
                <select name="month" defaultValue={selectedMonth} aria-label="Reporting month">
                  {months.map((m) => (
                    <option key={m.month} value={m.month}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn primary" type="submit">
                Generate
              </button>
            </form>
          )}
          <DownloadPdfButton single={singlePdf} />
        </div>
      </div>
    </header>
  )
}
