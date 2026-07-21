'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    __REPORT_PDF_READY__?: boolean
  }
}

/**
 * Print-route readiness helper. The report is entirely server-rendered
 * synchronous SVG/HTML, so readiness is purely a font question: once
 * document.fonts.ready resolves we flag the document as PDF-ready for the
 * headless export pipeline (scripts/export-pdf.mjs) and, when ?autoprint=1,
 * invoke the browser's native print dialog exactly once.
 */
export default function PrintClient({ autoprint, debug }: { autoprint: boolean; debug: boolean }) {
  const [viewport, setViewport] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    let printed = false
    document.fonts.ready.then(() => {
      if (cancelled) return
      document.documentElement.dataset.pdfReady = 'true'
      window.__REPORT_PDF_READY__ = true
      if (autoprint && !printed) {
        printed = true
        window.print()
      }
    })
    return () => {
      cancelled = true
    }
  }, [autoprint])

  useEffect(() => {
    if (!debug) return
    const update = () => setViewport(`${window.innerWidth}×${window.innerHeight}`)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [debug])

  return (
    <>
      <div className="print-setup-note" data-print-hidden>
        Print settings: Paper size <strong>Letter (8.5×11)</strong> · Margins{' '}
        <strong>Default</strong> · Background graphics <strong>on</strong>. &ldquo;Margins:
        None&rdquo; removes the page borders entirely.
      </div>
      {debug && <div className="print-debug-banner">print debug · viewport {viewport}</div>}
    </>
  )
}
