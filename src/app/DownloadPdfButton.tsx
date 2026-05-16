'use client'

function printWithMode(mode: 'brief' | 'full') {
  document.body.dataset.printMode = mode
  window.setTimeout(() => window.print(), 50)
  window.setTimeout(() => {
    if (document.body.dataset.printMode === mode) delete document.body.dataset.printMode
  }, 1500)
}

export default function DownloadPdfButton({ single = false }: { single?: boolean } = {}) {
  if (single) {
    return (
      <div className="pdf-actions" aria-label="PDF download">
        <button className="btn" type="button" onClick={() => printWithMode('full')}>
          Download PDF
        </button>
      </div>
    )
  }
  return (
    <div className="pdf-actions" aria-label="PDF download options">
      <button className="btn" type="button" onClick={() => printWithMode('brief')}>
        Download Brief PDF
      </button>
      <button className="btn" type="button" onClick={() => printWithMode('full')}>
        Download Full PDF
      </button>
    </div>
  )
}
