'use client'

import React from 'react'

type CompletionItem = { name: string; completed: number; total: number; onRoster: boolean }
type OptedOutItem = { name: string; date?: string; type?: string }

/**
 * Web-only replacement for the inline incomplete check-ins card: a summary
 * card with a button that opens the full list in a popup (native <dialog>).
 * The print/PDF path keeps the static card — dialogs don't print.
 */
export default function IncompleteCheckinsModal({
  windowLabel,
  totalDeliveries,
  items,
  optedOut,
}: {
  windowLabel: string
  totalDeliveries: number
  items: CompletionItem[]
  optedOut: OptedOutItem[]
}) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const open = () => ref.current?.showModal()
  const close = () => ref.current?.close()
  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) close()
  }
  return (
    <>
      <p className="h2-sub">Incomplete check-ins — {windowLabel}</p>
      <p className="muted completion-note">
        {items.length === 0
          ? 'Every employee completed all check-ins this period.'
          : `${items.length} employees completed fewer than the ${totalDeliveries} check-in deliveries this period.`}
      </p>
      {(items.length > 0 || optedOut.length > 0) && (
        <button className="btn completion-modal-btn" type="button" onClick={open}>
          View incomplete check-ins ({items.length}) &amp; opted out ({optedOut.length})
        </button>
      )}
      <dialog ref={ref} className="completion-dialog" onClick={onBackdropClick} aria-label="Incomplete check-ins">
        <div className="completion-dialog-inner">
          <div className="completion-dialog-head">
            <div>
              <p className="h2-sub">Incomplete check-ins — {windowLabel}</p>
              <p className="muted completion-note">
                Employees who completed fewer than the {totalDeliveries} check-in deliveries this
                period, least active first.
              </p>
            </div>
            <button className="btn completion-dialog-close" type="button" onClick={close} aria-label="Close">
              ✕ Close
            </button>
          </div>
          {items.length === 0 ? (
            <p className="muted">Every employee completed all check-ins this period.</p>
          ) : (
            <ul className="completion-list completion-dialog-list">
              {items.map((p) => (
                <li key={p.name}>
                  <span className="completion-name">
                    {p.name}
                    {!p.onRoster && <span className="sample-flag"> off-roster</span>}
                  </span>
                  <span className="completion-count">
                    {p.completed} of {p.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="completion-dialog-optedout">
            <p className="h2-sub">Opted out</p>
            <p className="muted completion-note">Roster employees who opted out of check-ins.</p>
            {optedOut.length === 0 ? (
              <p className="muted">No opted-out employees on record.</p>
            ) : (
              <ul className="opted-out-list">
                {optedOut.map((p) => (
                  <li key={p.name}>
                    <span className="completion-name">{p.name}</span>
                    {p.date && <span className="muted completion-date">{p.date}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
