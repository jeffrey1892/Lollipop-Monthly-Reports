"use client";
// A very short "How it works" walkthrough. Opens automatically the first time someone signs in,
// and any time from the "How it works" button.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useEvent } from "./EventProvider";

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useWalkthrough = () => useContext(Ctx);

function untilLabel(date: string | null): string {
  if (!date) return "for 30 days";
  const d = new Date(`${date}T12:00:00Z`);
  return `through ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}`;
}

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const { snap } = useEvent();
  const [isOpen, setOpen] = useState(snap.viewer.showWalkthrough);
  const [step, setStep] = useState(0);
  const marked = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const first = snap.viewer.name.split(" ")[0];
  const delay = snap.event.sendDelayMinutes;

  const steps: { icon: string; title: string; body: React.ReactNode }[] = [
    {
      icon: "👋",
      title: `Welcome${snap.viewer.participantId ? `, ${first}` : ""}`,
      body: (
        <>
          Everyone shares one business need, then the room offers leads. You can change your need any time on the <b>My Need</b> tab until the session closes. It
          saves automatically.
        </>
      ),
    },
    {
      icon: "🎤",
      title: "When it's your turn",
      body: (
        <>
          The <b>Live</b> tab follows whoever is presenting. When it&apos;s you, tick the people who raise their hand and rate each lead from <b>5 (strong)</b> to{" "}
          <b>1 (weak)</b>.
        </>
      ),
    },
    {
      icon: "🙋",
      title: "Have a lead for someone?",
      body: (
        <>
          Tick <b>&ldquo;I have a lead for…&rdquo;</b> on their card, with a quick note on who or what it is. They&apos;ll see it right away. The <b>Index</b> tab lists
          every need by category.
        </>
      ),
    },
    {
      icon: "📝",
      title: "Take notes",
      body: (
        <>
          Every need has a notes box. Notes are <b>🔒 private</b> unless you switch them to Shared.
        </>
      ),
    },
    {
      icon: "📬",
      title: "Afterwards",
      body: (
        <>
          {delay} minutes after the session closes, you&apos;ll get an email with your leads, their contact details and ready-to-paste follow-up emails. You stay signed
          in {untilLabel(snap.event.signInUntil)}.
        </>
      ),
    },
  ];

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
                How it works · {step + 1} of {steps.length}
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
            <p className="mt-2 text-base leading-relaxed text-gray-700">{s.body}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-hidden>
                {steps.map((_, i) => (
                  <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-5 bg-crimson" : "w-2 bg-gray-300"}`} />
                ))}
              </div>
              <div className="flex gap-2">
                {step > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                    Back
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => (last ? close() : setStep(step + 1))}>
                  {last ? "Got it" : "Next"}
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
