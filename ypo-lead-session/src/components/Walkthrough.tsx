"use client";
// A very short "How it works" walkthrough. Opens automatically the first time someone signs in,
// and any time from the "How it works" button.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { walkthroughSteps } from "@/lib/walkthrough";
import { useEvent } from "./EventProvider";

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useWalkthrough = () => useContext(Ctx);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const { snap } = useEvent();
  const [isOpen, setOpen] = useState(snap.viewer.showWalkthrough);
  const [step, setStep] = useState(0);
  const marked = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const first = snap.viewer.participantId ? snap.viewer.name.split(" ")[0] : "";

  const steps = walkthroughSteps({
    sendDelayMinutes: snap.event.sendDelayMinutes,
    signInUntil: snap.event.signInUntil,
    summariesSendAt: snap.event.summariesSendAt,
    timezone: snap.event.timezone,
  });

  const open = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (!marked.current && snap.viewer.showWalkthrough) {
      marked.current = true;
      void api(`/api/e/${snap.event.slug}/walkthrough`, {}).catch(() => {});
    }
  }, [snap.viewer.showWalkthrough, snap.event.slug]);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close, steps.length]);

  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={close}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wt-title"
            style={{ outline: "none" }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {step === 0 && first ? `Welcome, ${first} · ` : "How it works · "}
                {step + 1} of {steps.length}
              </span>
              <button type="button" onClick={close} className="min-h-11 px-2 text-sm font-semibold text-gray-500 hover:text-gray-800">
                Skip
              </button>
            </div>
            <div className="mt-2 text-4xl" aria-hidden>
              {s.icon}
            </div>
            <h2 id="wt-title" className="mt-2 text-xl font-bold text-crimson">
              {s.title}
            </h2>
            <p className="mt-2 min-h-[5.5rem] text-base leading-relaxed text-gray-700">{s.body}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-hidden>
                {steps.map((_, i) => (
                  <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-5 bg-crimson" : "w-2 bg-gray-300"}`} />
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)} disabled={step === 0}>
                  ← Back
                </button>
                <button type="button" className="btn btn-primary" onClick={() => (last ? close() : setStep(step + 1))}>
                  {last ? "Done" : "Next →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** The "How it works" button. */
export function HowItWorksButton({ className = "" }: { className?: string }) {
  const { open } = useWalkthrough();
  return (
    <button type="button" onClick={open} aria-label="How it works" className={`min-h-11 whitespace-nowrap px-2 text-sm font-semibold text-crimson hover:underline ${className}`}>
      <span aria-hidden>? </span>
      <span className="sm:hidden">Help</span>
      <span className="hidden sm:inline">How it works</span>
    </button>
  );
}
