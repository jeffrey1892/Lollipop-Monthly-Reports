import React from 'react'
import { getReport, customers } from '@/lib/reportMetrics'
import TopBar from './_components/TopBar'
import ReportBody, { type ReportAudience } from './_components/ReportBody'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; customer?: string; range?: string; audience?: string }>
}) {
  const params = (await searchParams) ?? {}
  const customer = customers.find((c) => c.id === params.customer) ?? customers[0]
  const range: 'month' | 'quarter' = params.range === 'quarter' ? 'quarter' : 'month'
  // NOTE: there is no auth in this demo — ?audience=hr-restricted simply reveals
  // the named retention-risk cards. Default is the summarized executive view.
  const audience: ReportAudience = params.audience === 'hr-restricted' ? 'hr-restricted' : 'executive'
  const report = getReport(customer.id, params.month, range)

  return (
    <div className="shell">
      <TopBar
        months={customer.months}
        selectedMonth={report.month}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        selectedCustomer={customer.id}
        range={range}
      />
      <ReportBody
        report={report}
        customerId={customer.id}
        range={range}
        renderMode="web"
        audience={audience}
      />
    </div>
  )
}
