'use client'

/**
 * PDF export actions.
 *
 * Executive report: links open the dedicated /print route in a new tab with
 * autoprint=1, so the browser's native print-to-PDF runs against the print
 * design system (Letter landscape, see src/app/print/print.css). The old
 * body[data-print-mode] + window.print() approach is retired.
 *
 * Manager pages (single mode): still print themselves in place — their print
 * styling is scoped under .manager-page in globals.css and is unchanged.
 */
export default function DownloadPdfButton({
  single = false,
  customer,
  month,
  range = 'month',
}: {
  single?: boolean
  customer?: string
  month?: string
  range?: string
} = {}) {
  if (single) {
    return (
      <div className="pdf-actions" aria-label="PDF download">
        <button className="btn" type="button" onClick={() => window.print()}>
          Download PDF
        </button>
      </div>
    )
  }

  const base =
    `/print?customer=${encodeURIComponent(customer ?? '')}` +
    `&month=${encodeURIComponent(month ?? '')}` +
    `&range=${encodeURIComponent(range)}&autoprint=1`

  return (
    <div className="pdf-actions" aria-label="PDF download options">
      <a className="btn" href={`${base}&scope=brief`} target="_blank" rel="noreferrer">
        Download brief PDF
      </a>
      <a className="btn" href={`${base}&scope=full`} target="_blank" rel="noreferrer">
        Download full PDF
      </a>
    </div>
  )
}
