'use client'

import React from 'react'

type Month = { month: string; label: string }
type Customer = { id: string; name: string }

/**
 * Client-side selector form: changing either dropdown navigates immediately,
 * so the rendered report (and the Download PDF links derived from it) always
 * match the visible selection. Prevents the trap where the dropdown was
 * changed but Generate wasn't clicked and a stale customer got printed.
 */
export default function TopBarControls({
  action = '/',
  months,
  selectedMonth,
  customers,
  selectedCustomer,
}: {
  action?: string
  months?: Month[]
  selectedMonth?: string
  customers?: Customer[]
  selectedCustomer?: string
}) {
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.currentTarget.form?.requestSubmit()
  }
  return (
    <form className="topbar-month-form" action={action} method="get">
      {customers && customers.length > 1 && (
        <select
          name="customer"
          defaultValue={selectedCustomer}
          aria-label="Customer"
          onChange={submitOnChange}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {months && months.length > 0 && (
        <select
          name="month"
          defaultValue={selectedMonth}
          aria-label="Reporting month"
          onChange={submitOnChange}
        >
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
  )
}
