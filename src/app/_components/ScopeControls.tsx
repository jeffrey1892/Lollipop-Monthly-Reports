'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

/**
 * Team / employee scope selectors for the interactive report. Navigation is
 * client-side (router.replace with scroll:false), so changing scope swaps the
 * section data in place without a full reload or a jump back to the top.
 * Changing the team clears any employee selection (the employee list belongs
 * to the team).
 */
export default function ScopeControls({
  customer,
  month,
  range,
  audience,
  teams,
  selectedTeam,
  employees,
  selectedEmployee,
}: {
  customer: string
  month: string
  range: 'month' | 'quarter'
  audience: string
  teams: Array<{ name: string; slug: string }>
  selectedTeam?: string | null
  employees?: Array<{ key: string; name: string }>
  selectedEmployee?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const navigate = (team: string, employee: string) => {
    const p = new URLSearchParams()
    p.set('customer', customer)
    p.set('month', month)
    if (range === 'quarter') p.set('range', 'quarter')
    if (audience === 'hr-restricted') p.set('audience', 'hr-restricted')
    if (team) p.set('team', team)
    if (team && employee) p.set('employee', employee)
    startTransition(() => {
      router.replace(`/?${p.toString()}`, { scroll: false })
    })
  }

  return (
    <div className={`scope-controls${pending ? ' scope-pending' : ''}`} data-print-hidden>
      <label className="scope-label" htmlFor="scope-team">
        Team
      </label>
      <select
        id="scope-team"
        value={selectedTeam ?? ''}
        aria-label="Scope to team"
        onChange={(e) => navigate(e.target.value, '')}
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
            value={selectedEmployee ?? ''}
            aria-label="Scope to employee"
            onChange={(e) => navigate(selectedTeam, e.target.value)}
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
    </div>
  )
}
