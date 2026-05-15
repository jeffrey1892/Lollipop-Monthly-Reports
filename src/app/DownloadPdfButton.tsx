'use client'

export default function DownloadPdfButton() {
  return (
    <button
      className="btn"
      type="button"
      onClick={() => window.print()}
      aria-label="Download report as PDF"
    >
      Download PDF
    </button>
  )
}
