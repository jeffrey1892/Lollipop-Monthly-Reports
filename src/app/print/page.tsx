import React from 'react'
import { getReport, customers } from '@/lib/reportMetrics'
import ReportBody, { type ReportAudience } from '../_components/ReportBody'
import PrintClient from './PrintClient'
import './print.css'

export const dynamic = 'force-dynamic'

/**
 * Dedicated print route — renders the identical shared <ReportBody> tree used
 * by the web report (src/app/page.tsx) with renderMode="print" and no
 * interactive chrome. Print styling lives in ./print.css (imported here so
 * its @page Letter-landscape rule does not leak into the manager pages,
 * which still print themselves portrait via window.print()).
 *
 * URL parameters:
 *   customer   customer id (default: first customer)
 *   month      YYYY-MM (default: latest month)
 *   range      month | quarter (default: month)
 *   audience   executive | hr-restricted (default: executive — no named
 *              retention-risk cards; NOTE: no auth in this demo)
 *   scope      full | brief (default: full — brief hides appendix sections)
 *   autoprint  1 to invoke window.print() once fonts are ready
 *   debugPrint 1 to outline sections and show a viewport banner
 */
export default async function PrintPage({
  searchParams,
}: {
  searchParams?: Promise<{
    month?: string
    customer?: string
    range?: string
    audience?: string
    scope?: string
    autoprint?: string
    debugPrint?: string
  }>
}) {
  const params = (await searchParams) ?? {}
  const customer = customers.find((c) => c.id === params.customer) ?? customers[0]
  const range: 'month' | 'quarter' = params.range === 'quarter' ? 'quarter' : 'month'
  const audience: ReportAudience = params.audience === 'hr-restricted' ? 'hr-restricted' : 'executive'
  const scope: 'full' | 'brief' = params.scope === 'brief' ? 'brief' : 'full'
  const debug = params.debugPrint === '1'
  const report = getReport(customer.id, params.month, range)

  const rootClass = ['print-root', scope === 'brief' ? 'scope-brief' : 'scope-full', debug ? 'print-debug' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} data-pdf-ready="true">
      <PrintClient autoprint={params.autoprint === '1'} debug={debug} />
      {/* Print frame: @page margin is 0 (the browser print dialog's
          "Margins: None" would strip any CSS page margin anyway), so page
          margins are built into the content — thead/tfoot rows repeat at the
          top and bottom of every printed page and the cell carries the
          horizontal inset. On screen the frame is neutralized in print.css. */}
      <table className="print-frame">
        <thead>
          <tr>
            <td aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="print-frame-cell">
              <ReportBody
                report={report}
                customerId={customer.id}
                range={range}
                renderMode="print"
                audience={audience}
              />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td aria-hidden="true" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
