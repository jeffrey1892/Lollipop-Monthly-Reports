'use client'

import React from 'react'

/**
 * Team / employee scope selectors for the interactive report. Same
 * submit-on-change pattern as TopBarControls: changing a dropdown navigates
 * immediately, so the rendered sections always match the visible selection.
 * Changing the team clears any employee selection (the employee list belongs
 * to the team).
 */
export default function ScopeControls({
  action = '/',
  customer,
  month,
  range,
  audience,
  teams,
  selectedTeam,
  employees,
  selectedEmployee,
}: {
  action?: string
  customer: string
  month: string
  range: 'month' | 'quarter'
  audience: string
  teams: Array<{ name: string; slug: string }>
  selectedTeam?: string | null
  employees?: Array<{ key: string; name: string }>
  selectedEmployee?: string | null
}) {
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.currentTarget.form?.requestSubmit()
  }
  const onTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const form = e.currentTarget.form
    const emp = form?.elements.namedItem('employee') as HTMLSelectElement | null
    if (emp) emp.value = ''
    form?.requestSubmit()
  }
  return (
    <form className="scope-controls" action={action} method="get" data-print-hidden>
      <input type="hidden" name="customer" value={customer} />
      <input type="hidden" name="month" value={month} />
      {range === 'quarter' && <input type="hidden" name="range" value="quarter" />}
      {audience === 'hr-restricted' && <input type="hidden" name="audience" value="hr-restricted" />}
      <label className="scope-label" htmlFor="scope-team">
        Team
      </label>
      <select
        id="scope-team"
        name="team"
        defaultValue={selectedTeam ?? ''}
        aria-label="Scope to team"
        onChange={onTeamChange}
      >
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
      {selectedTeam && employees && employees.length > 0 && (
        <>
          <label className="scope-label" htmlFor="scope-employee">
            Employee
          </label>
          <select
            id="scope-employee"
            name="employee"
            defaultValue={selectedEmployee ?? ''}
            aria-label="Scope to employee"
            onChange={submitOnChange}
          >
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name}
              </option>
            ))}
          </select>
        </>
      )}
    </form>
  )
}
